import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-templates-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import request from 'supertest';
import { createApp } from '../../src/server';
import { initStorage } from '../../src/services/storage';
import express from 'express';

const ACCOUNT_ID = 'test-account-id';
const BASE_PATH = `/restapi/v2.1/accounts/${ACCOUNT_ID}/templates`;

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

// Helper to create a template
async function createTemplate(overrides?: Record<string, unknown>) {
  const body = {
    name: 'Test Template',
    description: 'A test template',
    emailSubject: 'Please sign {{document}}',
    recipients: {
      signers: [
        {
          name: 'Signer Role',
          email: 'signer@example.com',
          recipientId: '1',
          roleName: 'Signer',
        },
      ],
    },
    ...overrides,
  };

  return request(app).post(BASE_PATH).send(body);
}

describe('Template API Endpoints', () => {
  describe('POST / - Create Template', () => {
    it('should create a template', async () => {
      const res = await createTemplate();

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('templateId');
      expect(res.body).toHaveProperty('uri');
      expect(res.body).toHaveProperty('name', 'Test Template');
    });

    it('should reject template without name', async () => {
      const res = await request(app)
        .post(BASE_PATH)
        .send({ description: 'No name template' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errorCode', 'INVALID_REQUEST_PARAMETER');
      expect(res.body.message).toContain('name');
    });

    it('should create template with documents', async () => {
      const res = await createTemplate({
        documents: [
          { documentId: '1', name: 'ContractTemplate.pdf' },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('templateId');
    });

    it('should create template with shared flag', async () => {
      const res = await createTemplate({ shared: 'true' });

      expect(res.status).toBe(201);

      // Verify the shared flag persisted
      const getRes = await request(app).get(`${BASE_PATH}/${res.body.templateId}`);
      expect(getRes.body.shared).toBe('true');
    });

    it('should create template with notification settings', async () => {
      const res = await createTemplate({
        notification: {
          useAccountDefaults: 'false',
          reminders: {
            reminderEnabled: 'true',
            reminderDelay: '3',
            reminderFrequency: '2',
          },
          expirations: {
            expireEnabled: 'true',
            expireAfter: '30',
            expireWarn: '5',
          },
        },
      });

      expect(res.status).toBe(201);
    });
  });

  describe('GET / - List Templates', () => {
    it('should list all templates', async () => {
      const res = await request(app).get(BASE_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resultSetSize');
      expect(res.body).toHaveProperty('startPosition', '0');
      expect(res.body).toHaveProperty('totalSetSize');
      expect(res.body).toHaveProperty('endPosition');
    });

    it('should filter by search_text', async () => {
      await createTemplate({ name: 'Unique Template Name QQQ999' });

      const res = await request(app)
        .get(BASE_PATH)
        .query({ search_text: 'QQQ999' });

      expect(res.status).toBe(200);
      expect(parseInt(res.body.resultSetSize)).toBeGreaterThanOrEqual(1);
      if (res.body.envelopeTemplates) {
        const matched = res.body.envelopeTemplates.some(
          (t: { name: string }) => t.name.includes('QQQ999')
        );
        expect(matched).toBe(true);
      }
    });

    it('should filter by search_text in description', async () => {
      await createTemplate({
        name: 'Regular Name',
        description: 'Special description marker ZZZXXX',
      });

      const res = await request(app)
        .get(BASE_PATH)
        .query({ search_text: 'ZZZXXX' });

      expect(res.status).toBe(200);
      expect(parseInt(res.body.resultSetSize)).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list when no templates match', async () => {
      const res = await request(app)
        .get(BASE_PATH)
        .query({ search_text: 'absolutely_nothing_matches_this_12345' });

      expect(res.status).toBe(200);
      expect(res.body.resultSetSize).toBe('0');
      expect(res.body.envelopeTemplates).toBeUndefined();
    });
  });

  describe('GET /:templateId - Get Single Template', () => {
    it('should return the full template', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const res = await request(app).get(`${BASE_PATH}/${templateId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('templateId', templateId);
      expect(res.body).toHaveProperty('name', 'Test Template');
      expect(res.body).toHaveProperty('description', 'A test template');
      expect(res.body).toHaveProperty('uri');
      expect(res.body).toHaveProperty('created');
      expect(res.body).toHaveProperty('lastModified');
      expect(res.body).toHaveProperty('owner');
      expect(res.body).toHaveProperty('status', 'created');
    });

    it('should return 404 for nonexistent template', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-template-id`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'TEMPLATE_DOES_NOT_EXIST');
    });

    it('should include owner info', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const res = await request(app).get(`${BASE_PATH}/${templateId}`);

      expect(res.body.owner).toHaveProperty('userName');
      expect(res.body.owner).toHaveProperty('userId');
      expect(res.body.owner).toHaveProperty('email');
    });

    it('should include recipients', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const res = await request(app).get(`${BASE_PATH}/${templateId}`);

      expect(res.body).toHaveProperty('recipients');
      expect(res.body.recipients).toHaveProperty('signers');
      expect(res.body.recipients.signers.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /:templateId - Update Template', () => {
    it('should update template name', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const res = await request(app)
        .put(`${BASE_PATH}/${templateId}`)
        .send({ name: 'Updated Template Name' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('templateId', templateId);
      expect(res.body).toHaveProperty('name', 'Updated Template Name');

      // Verify the update persisted
      const getRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      expect(getRes.body.name).toBe('Updated Template Name');
    });

    it('should update template description', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      await request(app)
        .put(`${BASE_PATH}/${templateId}`)
        .send({ description: 'Updated description' });

      const getRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      expect(getRes.body.description).toBe('Updated description');
    });

    it('should update template email subject', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      await request(app)
        .put(`${BASE_PATH}/${templateId}`)
        .send({ emailSubject: 'New email subject' });

      const getRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      expect(getRes.body.emailSubject).toBe('New email subject');
    });

    it('should update lastModified timestamp', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const getBeforeRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      const originalLastModified = getBeforeRes.body.lastModified;

      // Brief delay to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app)
        .put(`${BASE_PATH}/${templateId}`)
        .send({ name: 'Updated' });

      const getAfterRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      expect(getAfterRes.body.lastModified).not.toBe(originalLastModified);
    });

    it('should return 404 for nonexistent template', async () => {
      const res = await request(app)
        .put(`${BASE_PATH}/nonexistent-template-id`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'TEMPLATE_DOES_NOT_EXIST');
    });
  });

  describe('DELETE /:templateId - Delete Template', () => {
    it('should delete a template', async () => {
      const createRes = await createTemplate();
      const templateId = createRes.body.templateId;

      const res = await request(app).delete(`${BASE_PATH}/${templateId}`);

      expect(res.status).toBe(200);

      // Verify it's gone
      const getRes = await request(app).get(`${BASE_PATH}/${templateId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for nonexistent template', async () => {
      const res = await request(app).delete(`${BASE_PATH}/nonexistent-template-id`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'TEMPLATE_DOES_NOT_EXIST');
    });

    it('should not affect other templates when deleting', async () => {
      const res1 = await createTemplate({ name: 'Template A' });
      const res2 = await createTemplate({ name: 'Template B' });

      await request(app).delete(`${BASE_PATH}/${res1.body.templateId}`);

      // Template B should still exist
      const getRes = await request(app).get(`${BASE_PATH}/${res2.body.templateId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Template B');
    });
  });

  describe('Response shape validation', () => {
    it('should match TemplateSummary shape on create', async () => {
      const res = await createTemplate();

      expect(Object.keys(res.body)).toEqual(
        expect.arrayContaining(['templateId', 'uri', 'name'])
      );
    });

    it('should match TemplateListResult shape on list', async () => {
      const res = await request(app).get(BASE_PATH);

      const requiredFields = [
        'resultSetSize',
        'startPosition',
        'endPosition',
        'totalSetSize',
      ];
      for (const field of requiredFields) {
        expect(res.body).toHaveProperty(field);
      }
    });
  });
});
