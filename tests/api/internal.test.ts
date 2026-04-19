import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-internal-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import request from 'supertest';
import { createApp } from '../../src/server';
import { initStorage } from '../../src/services/storage';
import * as envelopeService from '../../src/services/envelope';
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

// Helper to create an envelope directly via service
function createTestEnvelope(status: 'created' | 'sent' = 'created') {
  return envelopeService.createEnvelope(
    {
      emailSubject: 'Internal API Test',
      status,
      recipients: {
        signers: [
          {
            name: 'Test Signer',
            email: 'test@example.com',
            recipientId: '1',
            recipientIdGuid: '',
            recipientType: 'signer',
            routingOrder: '1',
            status: 'created',
          },
        ],
      },
    },
    'test-account-id'
  );
}

describe('Internal API Endpoints', () => {
  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('version', '1.0.0');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('should return a valid ISO timestamp', async () => {
      const res = await request(app).get('/api/v1/health');

      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('GET /api/v1/config', () => {
    it('should return server configuration', async () => {
      const res = await request(app).get('/api/v1/config');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('port');
      expect(res.body).toHaveProperty('dataDir');
      expect(res.body).toHaveProperty('logLevel');
      expect(res.body).toHaveProperty('smtp');
    });

    it('should include SMTP configuration', async () => {
      const res = await request(app).get('/api/v1/config');

      expect(res.body.smtp).toHaveProperty('configured');
      expect(res.body.smtp).toHaveProperty('port');
      expect(res.body.smtp).toHaveProperty('secure');
      expect(typeof res.body.smtp.configured).toBe('boolean');
    });

    it('should show SMTP as not configured when no host set', async () => {
      const res = await request(app).get('/api/v1/config');

      expect(res.body.smtp.configured).toBe(false);
    });
  });

  describe('GET /api/v1/stats', () => {
    it('should return statistics', async () => {
      const res = await request(app).get('/api/v1/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalEnvelopes');
      expect(res.body).toHaveProperty('totalTemplates');
      expect(res.body).toHaveProperty('envelopesByStatus');
      expect(res.body).toHaveProperty('recentEnvelopes');
      expect(typeof res.body.totalEnvelopes).toBe('number');
      expect(typeof res.body.totalTemplates).toBe('number');
      expect(Array.isArray(res.body.recentEnvelopes)).toBe(true);
    });

    it('should reflect envelope counts after creation', async () => {
      const before = await request(app).get('/api/v1/stats');
      const beforeCount = before.body.totalEnvelopes;

      createTestEnvelope();

      const after = await request(app).get('/api/v1/stats');
      expect(after.body.totalEnvelopes).toBe(beforeCount + 1);
    });

    it('should include recent envelopes with correct shape', async () => {
      createTestEnvelope();

      const res = await request(app).get('/api/v1/stats');

      if (res.body.recentEnvelopes.length > 0) {
        const recent = res.body.recentEnvelopes[0];
        expect(recent).toHaveProperty('envelopeId');
        expect(recent).toHaveProperty('emailSubject');
        expect(recent).toHaveProperty('status');
        expect(recent).toHaveProperty('createdDateTime');
      }
    });
  });

  describe('GET /api/v1/envelopes', () => {
    it('should list all envelopes', async () => {
      const res = await request(app).get('/api/v1/envelopes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('envelopes');
      expect(Array.isArray(res.body.envelopes)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('should return simplified envelope objects', async () => {
      createTestEnvelope();

      const res = await request(app).get('/api/v1/envelopes');

      if (res.body.envelopes.length > 0) {
        const env = res.body.envelopes[0];
        expect(env).toHaveProperty('envelopeId');
        expect(env).toHaveProperty('emailSubject');
        expect(env).toHaveProperty('status');
        expect(env).toHaveProperty('createdDateTime');
        expect(env).toHaveProperty('sender');
        expect(env).toHaveProperty('recipientCount');
        expect(env).toHaveProperty('documentCount');
        expect(env).toHaveProperty('signers');
      }
    });

    it('should filter by status', async () => {
      createTestEnvelope('created');
      createTestEnvelope('sent');

      const res = await request(app)
        .get('/api/v1/envelopes')
        .query({ status: 'created' });

      expect(res.status).toBe(200);
      for (const env of res.body.envelopes) {
        expect(env.status).toBe('created');
      }
    });
  });

  describe('GET /api/v1/envelopes/:id', () => {
    it('should return envelope detail', async () => {
      const { summary } = createTestEnvelope();

      const res = await request(app).get(`/api/v1/envelopes/${summary.envelopeId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('envelopeId', summary.envelopeId);
      expect(res.body).toHaveProperty('emailSubject');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('recipients');
      expect(res.body).toHaveProperty('documents');
    });

    it('should return 404 for nonexistent envelope', async () => {
      const res = await request(app).get('/api/v1/envelopes/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Envelope not found');
    });
  });

  describe('DELETE /api/v1/envelopes/:id', () => {
    it('should delete a single envelope', async () => {
      const { summary } = createTestEnvelope();

      const res = await request(app).delete(`/api/v1/envelopes/${summary.envelopeId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deleted', true);
      expect(res.body).toHaveProperty('envelopeId', summary.envelopeId);

      // Verify it's gone
      const getRes = await request(app).get(`/api/v1/envelopes/${summary.envelopeId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting nonexistent envelope', async () => {
      const res = await request(app).delete('/api/v1/envelopes/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Envelope not found');
    });
  });

  describe('DELETE /api/v1/envelopes', () => {
    it('should delete all envelopes', async () => {
      // Create a few envelopes
      createTestEnvelope();
      createTestEnvelope();

      const res = await request(app).delete('/api/v1/envelopes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deleted', true);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');

      // Verify they're gone
      const listRes = await request(app).get('/api/v1/envelopes');
      expect(listRes.body.total).toBe(0);
    });

    it('should return count 0 when no envelopes exist', async () => {
      // Delete all first
      await request(app).delete('/api/v1/envelopes');

      const res = await request(app).delete('/api/v1/envelopes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deleted', true);
      expect(res.body.count).toBe(0);
    });
  });

  describe('GET /api/v1/templates', () => {
    it('should list templates in simplified format', async () => {
      const res = await request(app).get('/api/v1/templates');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });
  });
});
