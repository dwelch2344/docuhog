import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-oauth-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import request from 'supertest';
import { createApp } from '../../src/server';
import { initStorage } from '../../src/services/storage';
import express from 'express';

let app: express.Application;

beforeAll(() => {
  initStorage();
  app = createApp();
});

afterAll(() => {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
});

describe('OAuth Endpoints', () => {
  describe('POST /oauth/token', () => {
    it('should return a valid token response', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({ grant_type: 'authorization_code', code: 'mock-code' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('token_type', 'Bearer');
      expect(res.body).toHaveProperty('expires_in', 3600);
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.length).toBeGreaterThan(0);
    });

    it('should return a token with scope', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({ grant_type: 'authorization_code', scope: 'signature' });

      expect(res.status).toBe(200);
      expect(res.body.scope).toBe('signature');
    });

    it('should use default scope when none provided', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({ grant_type: 'authorization_code' });

      expect(res.status).toBe(200);
      expect(res.body.scope).toBe('signature impersonation');
    });

    it('should accept JWT bearer grant type', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: 'some-jwt-assertion',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body.token_type).toBe('Bearer');
    });

    it('should accept client_credentials grant type', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'my-integration-key',
          client_secret: 'my-secret',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
    });

    it('should accept an empty body', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
    });

    it('should return a JWT-formatted access token', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({});

      // JWT tokens have 3 dot-separated segments
      const parts = res.body.access_token.split('.');
      expect(parts.length).toBe(3);
    });
  });

  describe('GET /oauth/userinfo', () => {
    it('should return user info', async () => {
      const res = await request(app).get('/oauth/userinfo');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sub');
      expect(res.body).toHaveProperty('name', 'DocuHog User');
      expect(res.body).toHaveProperty('given_name', 'DocuHog');
      expect(res.body).toHaveProperty('family_name', 'User');
      expect(res.body).toHaveProperty('email', 'user@docuhog.local');
      expect(res.body).toHaveProperty('created');
    });

    it('should include accounts array', async () => {
      const res = await request(app).get('/oauth/userinfo');

      expect(res.body).toHaveProperty('accounts');
      expect(Array.isArray(res.body.accounts)).toBe(true);
      expect(res.body.accounts.length).toBeGreaterThan(0);

      const account = res.body.accounts[0];
      expect(account).toHaveProperty('account_id');
      expect(account).toHaveProperty('account_name', 'DocuHog Test Account');
      expect(account).toHaveProperty('base_uri');
      expect(account).toHaveProperty('is_default', true);
    });
  });

  describe('Auth Middleware', () => {
    it('should accept requests with Bearer token', async () => {
      const res = await request(app)
        .get('/restapi/v2.1/accounts/test-account-id')
        .set('Authorization', 'Bearer some-mock-token');

      expect(res.status).toBe(200);
    });

    it('should accept requests without any token (permissive)', async () => {
      const res = await request(app)
        .get('/restapi/v2.1/accounts/test-account-id');

      expect(res.status).toBe(200);
    });

    it('should accept requests with invalid Authorization header', async () => {
      const res = await request(app)
        .get('/restapi/v2.1/accounts/test-account-id')
        .set('Authorization', 'InvalidScheme token-value');

      expect(res.status).toBe(200);
    });
  });
});
