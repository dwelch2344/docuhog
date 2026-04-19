import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-accounts-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import request from 'supertest';
import { createApp } from '../../src/server';
import { initStorage } from '../../src/services/storage';
import express from 'express';

const ACCOUNT_ID = '12345678-abcd-1234-efgh-123456789012';

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

describe('Account API Endpoints', () => {
  describe('GET /restapi/v2.1/accounts/:accountId', () => {
    it('should return account info', async () => {
      const res = await request(app).get(`/restapi/v2.1/accounts/${ACCOUNT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accountId', ACCOUNT_ID);
      expect(res.body).toHaveProperty('accountName', 'DocuHog Test Account');
      expect(res.body).toHaveProperty('accountIdGuid', ACCOUNT_ID);
      expect(res.body).toHaveProperty('baseUri');
      expect(res.body).toHaveProperty('isDefault', 'true');
    });

    it('should include plan information', async () => {
      const res = await request(app).get(`/restapi/v2.1/accounts/${ACCOUNT_ID}`);

      expect(res.body).toHaveProperty('planId');
      expect(res.body).toHaveProperty('planName', 'DocuHog Mock Plan');
      expect(res.body).toHaveProperty('planStartDate');
    });

    it('should include billing information', async () => {
      const res = await request(app).get(`/restapi/v2.1/accounts/${ACCOUNT_ID}`);

      expect(res.body).toHaveProperty('billingPeriodStartDate');
      expect(res.body).toHaveProperty('billingPeriodEndDate');
      expect(res.body).toHaveProperty('billingPeriodEnvelopesAllowed', 'unlimited');
      expect(res.body).toHaveProperty('billingPeriodEnvelopesSent', '0');
      expect(res.body).toHaveProperty('billingPeriodDaysRemaining');
    });

    it('should work with any account ID (it echoes back the param)', async () => {
      const customAccountId = 'custom-account-id-xyz';
      const res = await request(app).get(`/restapi/v2.1/accounts/${customAccountId}`);

      expect(res.status).toBe(200);
      expect(res.body.accountId).toBe(customAccountId);
      expect(res.body.accountIdGuid).toBe(customAccountId);
    });

    it('should match DocuSign AccountInfo shape', async () => {
      const res = await request(app).get(`/restapi/v2.1/accounts/${ACCOUNT_ID}`);

      const requiredFields = [
        'accountId',
        'accountName',
        'accountIdGuid',
        'baseUri',
        'isDefault',
      ];
      for (const field of requiredFields) {
        expect(res.body).toHaveProperty(field);
      }
    });
  });

  describe('GET /restapi/v2.1/login_information', () => {
    it('should return login information', async () => {
      const res = await request(app).get('/restapi/v2.1/login_information');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('loginAccounts');
      expect(Array.isArray(res.body.loginAccounts)).toBe(true);
      expect(res.body.loginAccounts.length).toBeGreaterThan(0);
    });

    it('should include correct login account details', async () => {
      const res = await request(app).get('/restapi/v2.1/login_information');

      const account = res.body.loginAccounts[0];
      expect(account).toHaveProperty('accountId');
      expect(account).toHaveProperty('accountIdGuid');
      expect(account).toHaveProperty('name', 'DocuHog Test Account');
      expect(account).toHaveProperty('baseUrl');
      expect(account).toHaveProperty('isDefault', 'true');
      expect(account).toHaveProperty('userName', 'DocuHog User');
      expect(account).toHaveProperty('userId');
      expect(account).toHaveProperty('email', 'user@docuhog.local');
      expect(account).toHaveProperty('siteDescription', 'DocuHog Mock Server');
    });

    it('should match DocuSign LoginInformation shape', async () => {
      const res = await request(app).get('/restapi/v2.1/login_information');

      expect(res.body).toHaveProperty('loginAccounts');
      const account = res.body.loginAccounts[0];
      const requiredFields = [
        'accountId',
        'accountIdGuid',
        'name',
        'baseUrl',
        'isDefault',
        'userName',
        'userId',
        'email',
        'siteDescription',
      ];
      for (const field of requiredFields) {
        expect(account).toHaveProperty(field);
      }
    });
  });
});
