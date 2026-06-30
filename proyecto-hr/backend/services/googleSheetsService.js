import { google } from "googleapis";
import ExcelSyncConnection from "../models/ExcelSyncConnection.js";

export function getGoogleAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(companyId) {
  const oauth2Client = getGoogleAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    state: JSON.stringify({ companyId }),
  });
  return url;
}

export async function exchangeGoogleCode(code, state) {
  const oauth2Client = getGoogleAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  const { companyId } = JSON.parse(state);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    companyId,
  };
}

export async function refreshGoogleToken(connection) {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (
    connection.googleTokenExpiresAt &&
    connection.googleTokenExpiresAt > fiveMinutesFromNow
  ) {
    return connection.googleAccessToken;
  }

  const oauth2Client = getGoogleAuthClient();
  oauth2Client.setCredentials({
    refresh_token: connection.googleRefreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  connection.googleAccessToken = credentials.access_token;
  if (credentials.expiry_date) {
    connection.googleTokenExpiresAt = new Date(credentials.expiry_date);
  }
  if (credentials.refresh_token) {
    connection.googleRefreshToken = credentials.refresh_token;
  }
  await connection.save();

  return connection.googleAccessToken;
}

export async function listGoogleSheets(accessToken) {
  const oauth2Client = getGoogleAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const mimeTypes = [
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const query = mimeTypes.map((m) => `mimeType='${m}'`).join(" or ");

  const response = await drive.files.list({
    q: query,
    fields: "files(id, name, webViewLink, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 100,
  });

  return (response.data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime,
  }));
}

export async function readGoogleSheet(spreadsheetId, sheetName, accessToken) {
  const oauth2Client = getGoogleAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const range = sheetName || "Sheet1";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const values = response.data.values || [];

  if (values.length === 0 || values[0].length === 0) {
    throw new Error("First row is empty or sheet has no data");
  }

  const headers = values[0].map((h) => String(h));
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? row[index] : null;
    });
    return obj;
  });

  return { headers, rows };
}

export async function getGoogleSpreadsheetSheets(spreadsheetId, accessToken) {
  const oauth2Client = getGoogleAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  return (response.data.sheets || []).map((s) => s.properties.title);
}
