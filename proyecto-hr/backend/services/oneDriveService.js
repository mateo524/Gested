import ExcelSyncConnection from '../models/ExcelSyncConnection.js';

export const GRAPH_SCOPES = ['Files.Read', 'offline_access', 'User.Read'];

export function getOneDriveAuthUrl(companyId) {
  const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    redirect_uri: process.env.MS_REDIRECT_URI,
    response_type: 'code',
    scope: GRAPH_SCOPES.join(' '),
    state,
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeOneDriveCode(code, state) {
  const { companyId } = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    redirect_uri: process.env.MS_REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    companyId,
  };
}

export async function refreshOneDriveToken(connection) {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (connection.msTokenExpiresAt && connection.msTokenExpiresAt > fiveMinutesFromNow) {
    return connection.msAccessToken;
  }

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: connection.msRefreshToken,
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  connection.msAccessToken = data.access_token;
  if (data.refresh_token) {
    connection.msRefreshToken = data.refresh_token;
  }
  connection.msTokenExpiresAt = expiresAt;
  await connection.save();

  return connection.msAccessToken;
}

export async function listOneDriveExcelFiles(accessToken) {
  const queries = [
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')`,
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xls')`,
  ];

  const results = await Promise.all(
    queries.map(async (url) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to list files: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];
    })
  );

  const seen = new Set();
  const files = [];

  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        files.push({
          id: item.id,
          name: item.name,
          webUrl: item.webUrl,
          lastModifiedDateTime: item.lastModifiedDateTime,
        });
      }
    }
  }

  return files;
}

export async function downloadOneDriveFile(accessToken, fileId) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getOneDriveFileMetadata(accessToken, fileId) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to get file metadata: ${response.status}`);
  }

  const item = await response.json();
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    lastModifiedDateTime: item.lastModifiedDateTime,
    size: item.size,
  };
}
