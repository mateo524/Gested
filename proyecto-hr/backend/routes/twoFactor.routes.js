import { Router } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { auth } from '../middleware/auth.js';
import TwoFactorAuth from '../models/TwoFactorAuth.js';

const router = Router();

// Hash a value with SHA-256
function hashSHA256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Generate 8 random backup codes (8 bytes each → 16 hex chars)
function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(8).toString('hex')
  );
}

// POST /setup — generate a TOTP secret and QR code URL, does NOT enable 2FA
router.post('/setup', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const secretObj = speakeasy.generateSecret({
      name: `Gested HR (${req.user.email || userId})`,
      length: 20,
    });

    const qrCodeUrl = await qrcode.toDataURL(secretObj.otpauth_url);

    // Upsert the record with the new secret (not yet enabled)
    await TwoFactorAuth.findOneAndUpdate(
      { userId },
      {
        userId,
        secret: secretObj.base32,
        enabled: false,
        backupCodes: [],
        verifiedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      secret: secretObj.base32,
      qrCodeUrl,
      manualEntryKey: secretObj.base32,
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    return res.status(500).json({ message: 'Error setting up 2FA' });
  }
});

// POST /verify — verify TOTP token, enable 2FA, generate & store hashed backup codes
router.post('/verify', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const record = await TwoFactorAuth.findOne({ userId });
    if (!record) {
      return res.status(404).json({ message: '2FA not set up. Call /setup first.' });
    }

    const isValid = speakeasy.totp.verify({
      secret: record.secret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid TOTP token' });
    }

    const plainBackupCodes = generateBackupCodes(8);
    const hashedBackupCodes = plainBackupCodes.map(hashSHA256);

    record.enabled = true;
    record.verifiedAt = new Date();
    record.backupCodes = hashedBackupCodes;
    await record.save();

    return res.json({
      enabled: true,
      backupCodes: plainBackupCodes,
    });
  } catch (err) {
    console.error('2FA verify error:', err);
    return res.status(500).json({ message: 'Error verifying 2FA token' });
  }
});

// POST /disable — verify TOTP before disabling 2FA
router.post('/disable', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const record = await TwoFactorAuth.findOne({ userId });
    if (!record || !record.enabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    const isValid = speakeasy.totp.verify({
      secret: record.secret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid TOTP token' });
    }

    record.enabled = false;
    record.verifiedAt = null;
    record.backupCodes = [];
    await record.save();

    return res.json({ enabled: false });
  } catch (err) {
    console.error('2FA disable error:', err);
    return res.status(500).json({ message: 'Error disabling 2FA' });
  }
});

// GET /status — return current 2FA status
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const record = await TwoFactorAuth.findOne({ userId });

    if (!record) {
      return res.json({ enabled: false, verifiedAt: null });
    }

    return res.json({
      enabled: record.enabled,
      verifiedAt: record.verifiedAt ?? null,
    });
  } catch (err) {
    console.error('2FA status error:', err);
    return res.status(500).json({ message: 'Error fetching 2FA status' });
  }
});

export default router;
