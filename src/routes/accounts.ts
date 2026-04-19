// Mock DocuSign Account info endpoints

import { Router, Request, Response } from 'express';
import { AccountInfo, LoginInformation } from '../types/docusign';
import { config } from '../config';

const router = Router();

const MOCK_ACCOUNT_ID = '12345678-abcd-1234-efgh-123456789012';
const MOCK_USER_ID = 'aabbccdd-1234-5678-9012-aabbccddeeff';
const MOCK_USER_NAME = 'DocuHog User';
const MOCK_USER_EMAIL = 'user@docuhog.local';

// Helper: safely extract a route param as a string
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /restapi/v2.1/accounts/:accountId — Return mock account info
router.get('/restapi/v2.1/accounts/:accountId', (req: Request, res: Response) => {
  const accountId = param(req, 'accountId');

  const accountInfo: AccountInfo = {
    accountId,
    accountName: 'DocuHog Test Account',
    accountIdGuid: accountId,
    baseUri: `http://localhost:${config.port}/restapi`,
    isDefault: 'true',
    planId: 'docuhog-mock-plan',
    currentPlanId: 'docuhog-mock-plan',
    planName: 'DocuHog Mock Plan',
    planStartDate: '2024-01-01T00:00:00.000Z',
    canUpgrade: 'false',
    billingPeriodStartDate: '2024-01-01T00:00:00.000Z',
    billingPeriodEndDate: '2099-12-31T23:59:59.000Z',
    billingPeriodEnvelopesAllowed: 'unlimited',
    billingPeriodEnvelopesSent: '0',
    billingPeriodDaysRemaining: '99999',
  };

  res.json(accountInfo);
});

// GET /restapi/v2.1/login_information — Return mock login info
router.get('/restapi/v2.1/login_information', (_req: Request, res: Response) => {
  const loginInfo: LoginInformation = {
    loginAccounts: [
      {
        accountId: MOCK_ACCOUNT_ID,
        accountIdGuid: MOCK_ACCOUNT_ID,
        name: 'DocuHog Test Account',
        baseUrl: `http://localhost:${config.port}/restapi/v2.1`,
        isDefault: 'true',
        userName: MOCK_USER_NAME,
        userId: MOCK_USER_ID,
        email: MOCK_USER_EMAIL,
        siteDescription: 'DocuHog Mock Server',
      },
    ],
  };

  res.json(loginInfo);
});

export { router as accountsRouter };
