import express from "express";
import { auth as authenticate } from "../middleware/auth.js";

const router = express.Router();

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI,
  FRONTEND_URL,
} = process.env;

// In-memory token store — replace with DB field on User model for production
const linkedinTokens = new Map();

// Step 1 — redirect user to LinkedIn consent screen
router.get("/auth", authenticate, (req, res) => {
  const state = `${req.user.userId}_${Date.now()}`;
  const scope = "openid profile email w_member_social";
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scope);
  res.redirect(url.toString());
});

// Step 2 — LinkedIn redirects back with ?code=...&state=...
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendBase = FRONTEND_URL || "http://localhost:5173";

  if (error || !code) {
    return res.redirect(`${frontendBase}/?linkedin_error=${encodeURIComponent(error || "no_code")}`);
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.redirect(`${frontendBase}/?linkedin_error=token_failed`);
    }

    // Extract userId from state (format: userId_timestamp)
    const userId = state?.split("_")[0];
    if (userId) linkedinTokens.set(userId, tokenData.access_token);

    res.redirect(`${frontendBase}/?linkedin_connected=1`);
  } catch {
    res.redirect(`${frontendBase}/?linkedin_error=server_error`);
  }
});

// GET /api/linkedin/status — check if the current user has a token
router.get("/status", authenticate, (req, res) => {
  const connected = linkedinTokens.has(String(req.user.userId));
  res.json({ connected });
});

// POST /api/linkedin/post — publish a text post as the authenticated LinkedIn user
router.post("/post", authenticate, async (req, res) => {
  const token = linkedinTokens.get(String(req.user.userId));
  if (!token) return res.status(401).json({ error: "LinkedIn not connected" });

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text is required" });

  try {
    // Get LinkedIn member URN
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileRes.json();
    const urn = `urn:li:person:${profile.sub}`;

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: urn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.json();
      return res.status(postRes.status).json({ error: err });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/linkedin/disconnect — remove stored token
router.delete("/disconnect", authenticate, (req, res) => {
  linkedinTokens.delete(String(req.user.userId));
  res.json({ ok: true });
});

export default router;
