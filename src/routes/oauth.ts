// Mock OAuth endpoints
// Accepts any credentials and returns mock tokens

import { Router, Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { OAuthToken, UserInfo } from '../types/docusign';

const router = Router();

const MOCK_SECRET = 'docuhog-mock-secret-key';
const MOCK_ACCOUNT_ID = '12345678-abcd-1234-efgh-123456789012';
const MOCK_USER_ID = 'aabbccdd-1234-5678-9012-aabbccddeeff';

// POST /oauth/token — Issue a mock JWT access token
router.post('/token', (req: Request, res: Response) => {
  const now = Math.floor(Date.now() / 1000);

  const tokenPayload = {
    sub: MOCK_USER_ID,
    accountId: MOCK_ACCOUNT_ID,
    iss: 'docuhog.local',
    aud: req.body?.client_id || 'mock-integration-key',
    iat: now,
    exp: now + 3600,
    scope: req.body?.scope || 'signature impersonation',
  };

  const accessToken = jwt.sign(tokenPayload, MOCK_SECRET);

  const response: OAuthToken = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: tokenPayload.scope,
  };

  console.log('[OAuth] Issued mock access token');
  res.json(response);
});

// GET /oauth/userinfo — Return mock user info
router.get('/userinfo', (_req: Request, res: Response) => {
  const response: UserInfo = {
    sub: MOCK_USER_ID,
    name: 'DocuHog User',
    given_name: 'DocuHog',
    family_name: 'User',
    email: 'user@docuhog.local',
    created: '2024-01-01T00:00:00.000Z',
    accounts: [
      {
        account_id: MOCK_ACCOUNT_ID,
        account_name: 'DocuHog Test Account',
        base_uri: '/restapi',
        is_default: true,
      },
    ],
  };

  res.json(response);
});

// Auth middleware — accepts any Bearer token (permissive)
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // We accept any token (or no token) — DocuHog is permissive.
  // Just log if a token is present for debugging.
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
      // Token present — we accept it regardless of validity
      (req as Request & { docuhogAuth?: { token: string } }).docuhogAuth = {
        token: parts[1],
      };
    }
  }
  next();
}

export { router as oauthRouter };
