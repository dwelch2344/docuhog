import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-envelopes-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import request from 'supertest';
import { createApp } from '../../src/server';
import { initStorage } from '../../src/services/storage';
import express from 'express';

const ACCOUNT_ID = 'test-account-id';
const BASE_PATH = `/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes`;

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

// Helper to create a draft envelope
async function createDraftEnvelope(overrides?: Record<string, unknown>) {
  const body = {
    emailSubject: 'Test Document',
    emailBlurb: 'Please sign this test document',
    status: 'created',
    recipients: {
      signers: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          recipientId: '1',
          routingOrder: '1',
        },
      ],
    },
    ...overrides,
  };

  return request(app).post(BASE_PATH).send(body);
}

// Helper to create a sent envelope
async function createSentEnvelope(overrides?: Record<string, unknown>) {
  return createDraftEnvelope({ status: 'sent', ...overrides });
}

describe('Envelope API Endpoints', () => {
  describe('POST / - Create Envelope', () => {
    it('should create a draft envelope', async () => {
      const res = await createDraftEnvelope();

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('envelopeId');
      expect(res.body).toHaveProperty('uri');
      expect(res.body).toHaveProperty('status', 'created');
      expect(res.body).toHaveProperty('statusDateTime');
    });

    it('should create an envelope with sent status', async () => {
      const res = await createSentEnvelope();

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('sent');
    });

    it('should reject envelope without emailSubject or templateId', async () => {
      const res = await request(app)
        .post(BASE_PATH)
        .send({ status: 'created' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errorCode', 'INVALID_REQUEST_PARAMETER');
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('emailSubject');
    });

    it('should create envelope with multiple recipients', async () => {
      const res = await createDraftEnvelope({
        recipients: {
          signers: [
            { name: 'Signer One', email: 'signer1@example.com', recipientId: '1' },
            { name: 'Signer Two', email: 'signer2@example.com', recipientId: '2' },
          ],
          carbonCopies: [
            { name: 'CC Person', email: 'cc@example.com', recipientId: '3' },
          ],
        },
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('envelopeId');
    });

    it('should create envelope with documents', async () => {
      const res = await createDraftEnvelope({
        documents: [
          { documentId: '1', name: 'Contract.pdf', fileExtension: 'pdf' },
          { documentId: '2', name: 'Addendum.pdf', fileExtension: 'pdf' },
        ],
      });

      expect(res.status).toBe(201);
    });

    it('should create envelope with custom fields', async () => {
      const res = await createDraftEnvelope({
        customFields: {
          textCustomFields: [
            { fieldId: '1', name: 'CustomField1', value: 'Value1' },
          ],
        },
      });

      expect(res.status).toBe(201);
    });
  });

  describe('GET / - List Envelopes', () => {
    it('should list all envelopes', async () => {
      const res = await request(app).get(BASE_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resultSetSize');
      expect(res.body).toHaveProperty('startPosition', '0');
      expect(res.body).toHaveProperty('totalSetSize');
      expect(res.body).toHaveProperty('endPosition');
    });

    it('should filter by status', async () => {
      // Create both draft and sent envelopes
      await createDraftEnvelope();
      await createSentEnvelope();

      const res = await request(app)
        .get(BASE_PATH)
        .query({ status: 'created' });

      expect(res.status).toBe(200);
      if (res.body.envelopes) {
        for (const env of res.body.envelopes) {
          expect(env.status).toBe('created');
        }
      }
    });

    it('should filter by search_text matching subject', async () => {
      await createDraftEnvelope({ emailSubject: 'Unique Search Subject XYZ123' });

      const res = await request(app)
        .get(BASE_PATH)
        .query({ search_text: 'XYZ123' });

      expect(res.status).toBe(200);
      expect(parseInt(res.body.resultSetSize)).toBeGreaterThanOrEqual(1);
      if (res.body.envelopes) {
        const matched = res.body.envelopes.some(
          (e: { emailSubject: string }) => e.emailSubject.includes('XYZ123')
        );
        expect(matched).toBe(true);
      }
    });

    it('should return empty list when no envelopes match filter', async () => {
      const res = await request(app)
        .get(BASE_PATH)
        .query({ search_text: 'nonexistent_string_that_matches_nothing_987654321' });

      expect(res.status).toBe(200);
      expect(res.body.resultSetSize).toBe('0');
      expect(res.body.envelopes).toBeUndefined();
    });

    it('should filter by from_date', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const res = await request(app)
        .get(BASE_PATH)
        .query({ from_date: futureDate });

      expect(res.status).toBe(200);
      expect(res.body.resultSetSize).toBe('0');
    });
  });

  describe('GET /:envelopeId - Get Single Envelope', () => {
    it('should return the full envelope', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('envelopeId', envelopeId);
      expect(res.body).toHaveProperty('status', 'created');
      expect(res.body).toHaveProperty('emailSubject');
      expect(res.body).toHaveProperty('createdDateTime');
      expect(res.body).toHaveProperty('statusChangedDateTime');
      expect(res.body).toHaveProperty('lastModifiedDateTime');
      expect(res.body).toHaveProperty('envelopeUri');
      expect(res.body).toHaveProperty('sender');
      expect(res.body).toHaveProperty('recipients');
      expect(res.body).toHaveProperty('documents');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id-12345`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'ENVELOPE_DOES_NOT_EXIST');
      expect(res.body).toHaveProperty('message');
    });

    it('should include sender info', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}`);

      expect(res.body.sender).toHaveProperty('userName');
      expect(res.body.sender).toHaveProperty('userId');
      expect(res.body.sender).toHaveProperty('accountId');
      expect(res.body.sender).toHaveProperty('email');
    });

    it('should include recipients with correct structure', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}`);

      expect(res.body.recipients).toHaveProperty('recipientCount');
      expect(res.body.recipients).toHaveProperty('signers');
      expect(Array.isArray(res.body.recipients.signers)).toBe(true);
      expect(res.body.recipients.signers.length).toBeGreaterThan(0);

      const signer = res.body.recipients.signers[0];
      expect(signer).toHaveProperty('recipientId');
      expect(signer).toHaveProperty('recipientIdGuid');
      expect(signer).toHaveProperty('name', 'John Doe');
      expect(signer).toHaveProperty('email', 'john@example.com');
      expect(signer).toHaveProperty('status', 'created');
      expect(signer).toHaveProperty('recipientType', 'signer');
    });

    it('should include documents with correct structure', async () => {
      const createRes = await createDraftEnvelope({
        documents: [{ documentId: '1', name: 'TestDoc.pdf' }],
      });
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}`);

      expect(Array.isArray(res.body.documents)).toBe(true);
      expect(res.body.documents.length).toBeGreaterThan(0);

      const doc = res.body.documents[0];
      expect(doc).toHaveProperty('documentId', '1');
      expect(doc).toHaveProperty('documentIdGuid');
      expect(doc).toHaveProperty('name', 'TestDoc.pdf');
    });
  });

  describe('PUT /:envelopeId - Update Envelope', () => {
    it('should send a draft envelope', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}`)
        .send({ status: 'sent' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('envelopeId', envelopeId);
      expect(res.body).toHaveProperty('status', 'sent');
      expect(res.body).toHaveProperty('statusDateTime');
    });

    it('should void a sent envelope', async () => {
      const createRes = await createSentEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}`)
        .send({ status: 'voided', voidedReason: 'No longer needed' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'voided');
    });

    it('should not void a draft envelope', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}`)
        .send({ status: 'voided', voidedReason: 'Test void' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errorCode', 'ENVELOPE_CANNOT_VOID');
    });

    it('should return 404 when sending nonexistent envelope', async () => {
      const res = await request(app)
        .put(`${BASE_PATH}/nonexistent-id`)
        .send({ status: 'sent' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'ENVELOPE_DOES_NOT_EXIST');
    });

    it('should update envelope fields', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}`)
        .send({ emailSubject: 'Updated Subject' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('envelopeId', envelopeId);

      // Verify the update persisted
      const getRes = await request(app).get(`${BASE_PATH}/${envelopeId}`);
      expect(getRes.body.emailSubject).toBe('Updated Subject');
    });

    it('should return 404 when updating nonexistent envelope', async () => {
      const res = await request(app)
        .put(`${BASE_PATH}/nonexistent-id`)
        .send({ emailSubject: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:envelopeId/recipients', () => {
    it('should return recipients for an envelope', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/recipients`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recipientCount');
      expect(res.body).toHaveProperty('signers');
    });

    it('should return 404 for nonexistent envelope recipients', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id/recipients`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'ENVELOPE_DOES_NOT_EXIST');
    });
  });

  describe('PUT /:envelopeId/recipients', () => {
    it('should update recipients', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}/recipients`)
        .send({
          signers: [
            { name: 'New Signer', email: 'new@example.com', recipientId: '1' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('signers');
      expect(res.body.signers[0]).toHaveProperty('name', 'New Signer');
      expect(res.body.signers[0]).toHaveProperty('email', 'new@example.com');
    });

    it('should update carbon copy recipients', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .put(`${BASE_PATH}/${envelopeId}/recipients`)
        .send({
          carbonCopies: [
            { name: 'CC Person', email: 'cc@example.com', recipientId: '2' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('carbonCopies');
      expect(res.body.carbonCopies[0]).toHaveProperty('name', 'CC Person');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app)
        .put(`${BASE_PATH}/nonexistent-id/recipients`)
        .send({ signers: [] });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:envelopeId/documents', () => {
    it('should list documents for an envelope', async () => {
      const createRes = await createDraftEnvelope({
        documents: [
          { documentId: '1', name: 'Doc1.pdf' },
          { documentId: '2', name: 'Doc2.pdf' },
        ],
      });
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/documents`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('envelopeId', envelopeId);
      expect(res.body).toHaveProperty('envelopeDocuments');
      expect(Array.isArray(res.body.envelopeDocuments)).toBe(true);
      expect(res.body.envelopeDocuments.length).toBe(2);
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id/documents`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:envelopeId/documents/:documentId', () => {
    it('should return a PDF document', async () => {
      const createRes = await createDraftEnvelope({
        documents: [{ documentId: '1', name: 'TestContract' }],
      });
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/documents/1`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('TestContract');
    });

    it('should return 404 for nonexistent document', async () => {
      const createRes = await createDraftEnvelope({
        documents: [{ documentId: '1', name: 'Doc1.pdf' }],
      });
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/documents/999`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'DOCUMENT_DOES_NOT_EXIST');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id/documents/1`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('errorCode', 'ENVELOPE_DOES_NOT_EXIST');
    });
  });

  describe('POST /:envelopeId/views/recipient', () => {
    it('should create a recipient view URL', async () => {
      const createRes = await createSentEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .post(`${BASE_PATH}/${envelopeId}/views/recipient`)
        .send({
          returnUrl: 'http://localhost:3000/callback',
          authenticationMethod: 'none',
          email: 'john@example.com',
          userName: 'John Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toContain('signing');
      expect(res.body.url).toContain(envelopeId);
    });

    it('should use default returnUrl when not provided', async () => {
      const createRes = await createSentEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .post(`${BASE_PATH}/${envelopeId}/views/recipient`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app)
        .post(`${BASE_PATH}/nonexistent-id/views/recipient`)
        .send({ returnUrl: 'http://localhost:3000/callback' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /:envelopeId/views/sender', () => {
    it('should create a sender view URL', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app)
        .post(`${BASE_PATH}/${envelopeId}/views/sender`)
        .send({ returnUrl: 'http://localhost:3000/callback' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
      expect(res.body.url).toContain('sending');
      expect(res.body.url).toContain(envelopeId);
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app)
        .post(`${BASE_PATH}/nonexistent-id/views/sender`)
        .send({ returnUrl: 'http://localhost:3000/callback' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:envelopeId/audit_events', () => {
    it('should return audit events for a draft envelope', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/audit_events`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('auditEvents');
      expect(Array.isArray(res.body.auditEvents)).toBe(true);
      expect(res.body.auditEvents.length).toBeGreaterThan(0);

      // Each event should have eventFields
      const event = res.body.auditEvents[0];
      expect(event).toHaveProperty('eventFields');
      expect(Array.isArray(event.eventFields)).toBe(true);

      // Check eventFields shape
      const fieldNames = event.eventFields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain('logTime');
      expect(fieldNames).toContain('Action');
      expect(fieldNames).toContain('EnvelopeStatus');
    });

    it('should return more events for a sent envelope', async () => {
      const createRes = await createSentEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/audit_events`);

      expect(res.status).toBe(200);
      // Sent envelopes should have both 'Created' and 'Sent' events
      expect(res.body.auditEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id/audit_events`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /:envelopeId/notification', () => {
    it('should return notification settings', async () => {
      const createRes = await createDraftEnvelope();
      const envelopeId = createRes.body.envelopeId;

      const res = await request(app).get(`${BASE_PATH}/${envelopeId}/notification`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('useAccountDefaults');
      expect(res.body).toHaveProperty('reminders');
      expect(res.body).toHaveProperty('expirations');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get(`${BASE_PATH}/nonexistent-id/notification`);

      expect(res.status).toBe(404);
    });
  });

  describe('Response shape validation', () => {
    it('should match DocuSign EnvelopeSummary shape on create', async () => {
      const res = await createDraftEnvelope();

      // Validate all expected fields in EnvelopeSummary
      expect(Object.keys(res.body)).toEqual(
        expect.arrayContaining(['envelopeId', 'uri', 'statusDateTime', 'status'])
      );
    });

    it('should match DocuSign Envelope shape on get', async () => {
      const createRes = await createDraftEnvelope();
      const res = await request(app).get(`${BASE_PATH}/${createRes.body.envelopeId}`);

      // Check required Envelope fields
      const requiredFields = [
        'envelopeId',
        'envelopeUri',
        'status',
        'statusChangedDateTime',
        'createdDateTime',
        'lastModifiedDateTime',
        'emailSubject',
        'sender',
        'recipients',
        'documents',
      ];
      for (const field of requiredFields) {
        expect(res.body).toHaveProperty(field);
      }
    });

    it('should match DocuSign EnvelopesListResult shape on list', async () => {
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
