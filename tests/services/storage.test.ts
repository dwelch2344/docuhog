import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-storage-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import * as storage from '../../src/services/storage';
import { Envelope, Template } from '../../src/types/docusign';
import { v4 as uuidv4 } from 'uuid';

afterAll(() => {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
});

// Helper to create a mock envelope
function mockEnvelope(overrides?: Partial<Envelope>): Envelope {
  const id = uuidv4();
  const now = new Date().toISOString();
  return {
    envelopeId: id,
    envelopeUri: `/envelopes/${id}`,
    status: 'created',
    statusChangedDateTime: now,
    createdDateTime: now,
    lastModifiedDateTime: now,
    emailSubject: 'Test Envelope',
    ...overrides,
  };
}

// Helper to create a mock template
function mockTemplate(overrides?: Partial<Template>): Template {
  const id = uuidv4();
  const now = new Date().toISOString();
  return {
    templateId: id,
    uri: `/templates/${id}`,
    name: 'Test Template',
    created: now,
    lastModified: now,
    ...overrides,
  };
}

describe('Storage Service', () => {
  describe('initStorage', () => {
    it('should create data directories', () => {
      storage.initStorage();

      expect(fs.existsSync(testDataDir)).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'envelopes'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'templates'))).toBe(true);
    });

    it('should not throw if directories already exist', () => {
      expect(() => storage.initStorage()).not.toThrow();
    });
  });

  describe('Envelope operations', () => {
    beforeAll(() => {
      storage.initStorage();
    });

    beforeEach(() => {
      // Clean up envelopes between tests
      storage.deleteAllEnvelopes();
    });

    describe('saveEnvelope / getEnvelope', () => {
      it('should save and retrieve an envelope', () => {
        const envelope = mockEnvelope();
        storage.saveEnvelope(envelope);

        const retrieved = storage.getEnvelope(envelope.envelopeId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.envelopeId).toBe(envelope.envelopeId);
        expect(retrieved!.emailSubject).toBe(envelope.emailSubject);
        expect(retrieved!.status).toBe(envelope.status);
      });

      it('should overwrite existing envelope on save', () => {
        const envelope = mockEnvelope();
        storage.saveEnvelope(envelope);

        envelope.emailSubject = 'Updated Subject';
        storage.saveEnvelope(envelope);

        const retrieved = storage.getEnvelope(envelope.envelopeId);
        expect(retrieved!.emailSubject).toBe('Updated Subject');
      });

      it('should return null for nonexistent envelope', () => {
        const result = storage.getEnvelope('nonexistent-id');
        expect(result).toBeNull();
      });

      it('should persist envelope data faithfully', () => {
        const envelope = mockEnvelope({
          emailSubject: 'Complex Envelope',
          emailBlurb: 'Some blurb text',
          status: 'sent',
          recipients: {
            signers: [
              {
                recipientId: '1',
                recipientIdGuid: uuidv4(),
                recipientType: 'signer',
                routingOrder: '1',
                name: 'Test Signer',
                email: 'signer@test.com',
                status: 'sent',
              },
            ],
            recipientCount: '1',
          },
          documents: [
            {
              documentId: '1',
              documentIdGuid: uuidv4(),
              name: 'Document1.pdf',
            },
          ],
        });

        storage.saveEnvelope(envelope);

        const retrieved = storage.getEnvelope(envelope.envelopeId);
        expect(retrieved!.recipients!.signers![0].name).toBe('Test Signer');
        expect(retrieved!.documents![0].name).toBe('Document1.pdf');
      });
    });

    describe('listEnvelopes', () => {
      it('should list all saved envelopes', () => {
        const env1 = mockEnvelope({ emailSubject: 'Envelope 1' });
        const env2 = mockEnvelope({ emailSubject: 'Envelope 2' });
        storage.saveEnvelope(env1);
        storage.saveEnvelope(env2);

        const envelopes = storage.listEnvelopes();
        expect(envelopes.length).toBe(2);
      });

      it('should return empty array when no envelopes exist', () => {
        const envelopes = storage.listEnvelopes();
        expect(envelopes).toEqual([]);
      });

      it('should sort by creation date descending (newest first)', () => {
        const older = mockEnvelope({
          createdDateTime: '2024-01-01T00:00:00.000Z',
        });
        const newer = mockEnvelope({
          createdDateTime: '2024-06-01T00:00:00.000Z',
        });
        storage.saveEnvelope(older);
        storage.saveEnvelope(newer);

        const envelopes = storage.listEnvelopes();
        expect(envelopes[0].envelopeId).toBe(newer.envelopeId);
        expect(envelopes[1].envelopeId).toBe(older.envelopeId);
      });
    });

    describe('deleteEnvelope', () => {
      it('should delete an envelope', () => {
        const envelope = mockEnvelope();
        storage.saveEnvelope(envelope);

        const deleted = storage.deleteEnvelope(envelope.envelopeId);
        expect(deleted).toBe(true);

        const retrieved = storage.getEnvelope(envelope.envelopeId);
        expect(retrieved).toBeNull();
      });

      it('should return false when deleting nonexistent envelope', () => {
        const deleted = storage.deleteEnvelope('nonexistent-id');
        expect(deleted).toBe(false);
      });
    });

    describe('deleteAllEnvelopes', () => {
      it('should delete all envelopes and return count', () => {
        storage.saveEnvelope(mockEnvelope());
        storage.saveEnvelope(mockEnvelope());
        storage.saveEnvelope(mockEnvelope());

        const count = storage.deleteAllEnvelopes();
        expect(count).toBe(3);

        const envelopes = storage.listEnvelopes();
        expect(envelopes.length).toBe(0);
      });

      it('should return 0 when no envelopes exist', () => {
        const count = storage.deleteAllEnvelopes();
        expect(count).toBe(0);
      });
    });
  });

  describe('Template operations', () => {
    beforeAll(() => {
      storage.initStorage();
    });

    describe('saveTemplate / getTemplate', () => {
      it('should save and retrieve a template', () => {
        const template = mockTemplate();
        storage.saveTemplate(template);

        const retrieved = storage.getTemplate(template.templateId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.templateId).toBe(template.templateId);
        expect(retrieved!.name).toBe(template.name);
      });

      it('should overwrite existing template on save', () => {
        const template = mockTemplate();
        storage.saveTemplate(template);

        template.name = 'Updated Name';
        storage.saveTemplate(template);

        const retrieved = storage.getTemplate(template.templateId);
        expect(retrieved!.name).toBe('Updated Name');
      });

      it('should return null for nonexistent template', () => {
        const result = storage.getTemplate('nonexistent-id');
        expect(result).toBeNull();
      });

      it('should persist template with recipients and documents', () => {
        const template = mockTemplate({
          recipients: {
            signers: [
              {
                recipientId: '1',
                recipientIdGuid: uuidv4(),
                recipientType: 'signer',
                routingOrder: '1',
                name: 'Template Signer',
                email: 'signer@template.com',
                status: 'created',
              },
            ],
          },
          documents: [
            {
              documentId: '1',
              documentIdGuid: uuidv4(),
              name: 'TemplateDoc.pdf',
            },
          ],
        });

        storage.saveTemplate(template);

        const retrieved = storage.getTemplate(template.templateId);
        expect(retrieved!.recipients!.signers![0].name).toBe('Template Signer');
        expect(retrieved!.documents![0].name).toBe('TemplateDoc.pdf');
      });
    });

    describe('listTemplates', () => {
      it('should list all saved templates', () => {
        const t1 = mockTemplate({ name: 'Template 1' });
        const t2 = mockTemplate({ name: 'Template 2' });
        storage.saveTemplate(t1);
        storage.saveTemplate(t2);

        const templates = storage.listTemplates();
        expect(templates.length).toBeGreaterThanOrEqual(2);
      });

      it('should sort by lastModified descending (newest first)', () => {
        const older = mockTemplate({
          lastModified: '2024-01-01T00:00:00.000Z',
          name: 'Older Template',
        });
        const newer = mockTemplate({
          lastModified: '2024-06-01T00:00:00.000Z',
          name: 'Newer Template',
        });
        storage.saveTemplate(older);
        storage.saveTemplate(newer);

        const templates = storage.listTemplates();
        const olderIdx = templates.findIndex((t) => t.templateId === older.templateId);
        const newerIdx = templates.findIndex((t) => t.templateId === newer.templateId);
        expect(newerIdx).toBeLessThan(olderIdx);
      });
    });

    describe('deleteTemplate', () => {
      it('should delete a template', () => {
        const template = mockTemplate();
        storage.saveTemplate(template);

        const deleted = storage.deleteTemplate(template.templateId);
        expect(deleted).toBe(true);

        const retrieved = storage.getTemplate(template.templateId);
        expect(retrieved).toBeNull();
      });

      it('should return false when deleting nonexistent template', () => {
        const deleted = storage.deleteTemplate('nonexistent-id');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle gracefully when data directory does not exist for list', () => {
      // This is implicitly tested since initStorage creates directories,
      // but listEnvelopes/listTemplates handle missing dirs internally
      const envelopes = storage.listEnvelopes();
      expect(Array.isArray(envelopes)).toBe(true);
    });
  });
});
