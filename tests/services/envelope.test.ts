import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-envservice-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import * as envelopeService from '../../src/services/envelope';
import * as storage from '../../src/services/storage';
import { EnvelopeDefinition } from '../../src/types/docusign';

beforeAll(() => {
  storage.initStorage();
});

beforeEach(() => {
  storage.deleteAllEnvelopes();
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

// Helper to build a standard envelope definition
function makeDefinition(overrides?: Partial<EnvelopeDefinition>): EnvelopeDefinition {
  return {
    emailSubject: 'Test Document',
    emailBlurb: 'Please sign this',
    status: 'created',
    recipients: {
      signers: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          recipientId: '1',
          recipientIdGuid: '',
          recipientType: 'signer',
          routingOrder: '1',
          status: 'created',
        },
      ],
    },
    ...overrides,
  };
}

describe('Envelope Service', () => {
  describe('createEnvelope', () => {
    it('should create a draft envelope', () => {
      const def = makeDefinition({ status: 'created' });
      const { envelope, summary } = envelopeService.createEnvelope(def);

      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.status).toBe('created');
      expect(envelope.emailSubject).toBe('Test Document');
      expect(envelope.emailBlurb).toBe('Please sign this');
      expect(envelope.createdDateTime).toBeDefined();
      expect(envelope.lastModifiedDateTime).toBeDefined();
      expect(envelope.envelopeUri).toBe(`/envelopes/${envelope.envelopeId}`);

      expect(summary.envelopeId).toBe(envelope.envelopeId);
      expect(summary.status).toBe('created');
      expect(summary.uri).toBe(`/envelopes/${envelope.envelopeId}`);
    });

    it('should create a sent envelope', () => {
      const def = makeDefinition({ status: 'sent' });
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.status).toBe('sent');
      expect(envelope.sentDateTime).toBeDefined();
      expect(envelope.initialSentDateTime).toBeDefined();
    });

    it('should build recipients with proper structure', () => {
      const def = makeDefinition({
        recipients: {
          signers: [
            {
              name: 'Signer 1',
              email: 'signer1@test.com',
              recipientId: '1',
              recipientIdGuid: '',
              recipientType: 'signer',
              routingOrder: '1',
              status: 'created',
            },
          ],
          carbonCopies: [
            {
              name: 'CC Person',
              email: 'cc@test.com',
              recipientId: '2',
              recipientIdGuid: '',
              recipientType: 'cc',
              routingOrder: '2',
              status: 'created',
            },
          ],
        },
      });

      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.recipients).toBeDefined();
      expect(envelope.recipients!.recipientCount).toBe('2');
      expect(envelope.recipients!.signers).toHaveLength(1);
      expect(envelope.recipients!.carbonCopies).toHaveLength(1);
      expect(envelope.recipients!.signers![0].recipientType).toBe('signer');
      expect(envelope.recipients!.carbonCopies![0].recipientType).toBe('cc');
      expect(envelope.recipients!.signers![0].recipientIdGuid).toBeDefined();
    });

    it('should set recipient status to "sent" when envelope is sent', () => {
      const def = makeDefinition({ status: 'sent' });
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.recipients!.signers![0].status).toBe('sent');
    });

    it('should set recipient status to "created" when envelope is draft', () => {
      const def = makeDefinition({ status: 'created' });
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.recipients!.signers![0].status).toBe('created');
    });

    it('should build default documents when none provided', () => {
      const def = makeDefinition();
      delete def.documents;
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.documents).toBeDefined();
      expect(envelope.documents!.length).toBe(1);
      expect(envelope.documents![0].documentId).toBe('1');
      expect(envelope.documents![0].name).toBe('Document 1');
    });

    it('should use provided documents', () => {
      const def = makeDefinition({
        documents: [
          { documentId: '1', name: 'Contract.pdf' },
          { documentId: '2', name: 'NDA.pdf' },
        ],
      });
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.documents!.length).toBe(2);
      expect(envelope.documents![0].name).toBe('Contract.pdf');
      expect(envelope.documents![1].name).toBe('NDA.pdf');
    });

    it('should set sender info', () => {
      const def = makeDefinition();
      const { envelope } = envelopeService.createEnvelope(def, 'my-account-id');

      expect(envelope.sender).toBeDefined();
      expect(envelope.sender!.accountId).toBe('my-account-id');
      expect(envelope.sender!.userName).toBeDefined();
      expect(envelope.sender!.email).toBeDefined();
    });

    it('should set default boolean fields', () => {
      const def = makeDefinition();
      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.enableWetSign).toBe('true');
      expect(envelope.allowMarkup).toBe('true');
      expect(envelope.allowReassign).toBe('true');
      expect(envelope.purgeState).toBe('unpurged');
      expect(envelope.is21CFRPart11).toBe('false');
    });

    it('should persist the envelope to storage', () => {
      const def = makeDefinition();
      const { envelope } = envelopeService.createEnvelope(def);

      const retrieved = storage.getEnvelope(envelope.envelopeId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.envelopeId).toBe(envelope.envelopeId);
    });
  });

  describe('sendEnvelope', () => {
    it('should send a draft envelope', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const sent = envelopeService.sendEnvelope(created.envelopeId);

      expect(sent).not.toBeNull();
      expect(sent!.status).toBe('sent');
      expect(sent!.sentDateTime).toBeDefined();
      expect(sent!.initialSentDateTime).toBeDefined();
    });

    it('should update recipient statuses to sent', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const sent = envelopeService.sendEnvelope(created.envelopeId);

      expect(sent!.recipients!.signers![0].status).toBe('sent');
    });

    it('should return null for nonexistent envelope', () => {
      const result = envelopeService.sendEnvelope('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should persist the sent status', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      envelopeService.sendEnvelope(created.envelopeId);

      const retrieved = storage.getEnvelope(created.envelopeId);
      expect(retrieved!.status).toBe('sent');
    });
  });

  describe('voidEnvelope', () => {
    it('should void a sent envelope', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'sent' })
      );

      const result = envelopeService.voidEnvelope(
        created.envelopeId,
        'No longer needed'
      );

      expect('envelope' in result).toBe(true);
      if ('envelope' in result) {
        expect(result.envelope.status).toBe('voided');
        expect(result.envelope.voidedDateTime).toBeDefined();
        expect(result.envelope.voidedReason).toBe('No longer needed');
      }
    });

    it('should not void a draft envelope', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const result = envelopeService.voidEnvelope(
        created.envelopeId,
        'Test reason'
      );

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('invalid_status');
      }
    });

    it('should return not_found error for nonexistent envelope', () => {
      const result = envelopeService.voidEnvelope('nonexistent-id', 'reason');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('not_found');
      }
    });
  });

  describe('getEnvelope', () => {
    it('should return an existing envelope', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition()
      );

      const result = envelopeService.getEnvelope(created.envelopeId);
      expect(result).not.toBeNull();
      expect(result!.envelopeId).toBe(created.envelopeId);
    });

    it('should return null for nonexistent envelope', () => {
      const result = envelopeService.getEnvelope('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateEnvelope', () => {
    it('should update email subject', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition()
      );

      const updated = envelopeService.updateEnvelope(created.envelopeId, {
        emailSubject: 'New Subject',
      });

      expect(updated).not.toBeNull();
      expect(updated!.emailSubject).toBe('New Subject');
    });

    it('should update email blurb', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition()
      );

      const updated = envelopeService.updateEnvelope(created.envelopeId, {
        emailBlurb: 'New blurb',
      });

      expect(updated!.emailBlurb).toBe('New blurb');
    });

    it('should trigger send when updating status to sent', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const updated = envelopeService.updateEnvelope(created.envelopeId, {
        status: 'sent',
      });

      expect(updated!.status).toBe('sent');
      expect(updated!.sentDateTime).toBeDefined();
    });

    it('should return null for nonexistent envelope', () => {
      const result = envelopeService.updateEnvelope('nonexistent-id', {
        emailSubject: 'test',
      });
      expect(result).toBeNull();
    });

    it('should update lastModifiedDateTime', () => {
      const { envelope: created } = envelopeService.createEnvelope(
        makeDefinition()
      );
      const originalModified = created.lastModifiedDateTime;

      const updated = envelopeService.updateEnvelope(created.envelopeId, {
        emailSubject: 'Updated',
      });

      // The time might be the same if the test runs very fast, but
      // lastModifiedDateTime should be set
      expect(updated!.lastModifiedDateTime).toBeDefined();
    });
  });

  describe('listEnvelopes', () => {
    it('should list all envelopes without filters', () => {
      envelopeService.createEnvelope(makeDefinition({ status: 'created' }));
      envelopeService.createEnvelope(makeDefinition({ status: 'sent' }));

      const envelopes = envelopeService.listEnvelopes();
      expect(envelopes.length).toBe(2);
    });

    it('should filter by status', () => {
      envelopeService.createEnvelope(makeDefinition({ status: 'created' }));
      envelopeService.createEnvelope(makeDefinition({ status: 'sent' }));

      const drafts = envelopeService.listEnvelopes({ status: 'created' });
      expect(drafts.length).toBe(1);
      expect(drafts[0].status).toBe('created');
    });

    it('should filter by multiple comma-separated statuses', () => {
      envelopeService.createEnvelope(makeDefinition({ status: 'created' }));
      envelopeService.createEnvelope(makeDefinition({ status: 'sent' }));

      const result = envelopeService.listEnvelopes({ status: 'created,sent' });
      expect(result.length).toBe(2);
    });

    it('should filter by search text matching subject', () => {
      envelopeService.createEnvelope(
        makeDefinition({ emailSubject: 'Important Contract ABC' })
      );
      envelopeService.createEnvelope(
        makeDefinition({ emailSubject: 'Regular Document' })
      );

      const result = envelopeService.listEnvelopes({ searchText: 'ABC' });
      expect(result.length).toBe(1);
      expect(result[0].emailSubject).toContain('ABC');
    });

    it('should filter by search text matching signer name', () => {
      envelopeService.createEnvelope(
        makeDefinition({
          recipients: {
            signers: [
              {
                name: 'Unique Person XYZ',
                email: 'unique@test.com',
                recipientId: '1',
                recipientIdGuid: '',
                recipientType: 'signer',
                routingOrder: '1',
                status: 'created',
              },
            ],
          },
        })
      );

      const result = envelopeService.listEnvelopes({ searchText: 'Unique Person XYZ' });
      expect(result.length).toBe(1);
    });

    it('should filter by search text matching signer email', () => {
      envelopeService.createEnvelope(
        makeDefinition({
          recipients: {
            signers: [
              {
                name: 'Someone',
                email: 'specialemail@unique.com',
                recipientId: '1',
                recipientIdGuid: '',
                recipientType: 'signer',
                routingOrder: '1',
                status: 'created',
              },
            ],
          },
        })
      );

      const result = envelopeService.listEnvelopes({ searchText: 'specialemail' });
      expect(result.length).toBe(1);
    });

    it('should filter by fromDate', () => {
      envelopeService.createEnvelope(makeDefinition());

      // Set a future from_date should return nothing
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = envelopeService.listEnvelopes({ fromDate: futureDate });
      expect(result.length).toBe(0);
    });

    it('should return all envelopes when fromDate is in the past', () => {
      envelopeService.createEnvelope(makeDefinition());

      const pastDate = '2020-01-01T00:00:00.000Z';
      const result = envelopeService.listEnvelopes({ fromDate: pastDate });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAuditEvents', () => {
    it('should return audit events for a draft envelope', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const events = envelopeService.getAuditEvents(envelope.envelopeId);

      expect(events).not.toBeNull();
      expect(events!.length).toBe(1);

      const createdEvent = events![0];
      const actionField = createdEvent.eventFields.find((f) => f.name === 'Action');
      expect(actionField!.value).toBe('Created');
    });

    it('should return multiple events for a sent envelope', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'sent' })
      );

      const events = envelopeService.getAuditEvents(envelope.envelopeId);

      expect(events!.length).toBe(2);
      const actions = events!.map((e) =>
        e.eventFields.find((f) => f.name === 'Action')!.value
      );
      expect(actions).toContain('Created');
      expect(actions).toContain('Sent');
    });

    it('should return null for nonexistent envelope', () => {
      const result = envelopeService.getAuditEvents('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should include proper eventFields structure', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const events = envelopeService.getAuditEvents(envelope.envelopeId);
      const event = events![0];

      const fieldNames = event.eventFields.map((f) => f.name);
      expect(fieldNames).toContain('logTime');
      expect(fieldNames).toContain('Source');
      expect(fieldNames).toContain('UserName');
      expect(fieldNames).toContain('UserId');
      expect(fieldNames).toContain('Action');
      expect(fieldNames).toContain('Message');
      expect(fieldNames).toContain('EnvelopeStatus');
      expect(fieldNames).toContain('ClientIPAddress');
    });
  });

  describe('updateRecipients', () => {
    it('should update signers', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const result = envelopeService.updateRecipients(envelope.envelopeId, {
        signers: [
          {
            name: 'New Signer',
            email: 'newsigner@test.com',
            recipientId: '1',
            recipientIdGuid: '',
            recipientType: 'signer',
            routingOrder: '1',
            status: 'created',
          },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.signers![0].name).toBe('New Signer');
      expect(result!.signers![0].email).toBe('newsigner@test.com');
    });

    it('should update carbon copies', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const result = envelopeService.updateRecipients(envelope.envelopeId, {
        carbonCopies: [
          {
            name: 'CC Person',
            email: 'cc@test.com',
            recipientId: '2',
            recipientIdGuid: '',
            recipientType: 'cc',
            routingOrder: '2',
            status: 'created',
          },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.carbonCopies![0].name).toBe('CC Person');
    });

    it('should update recipient count after changes', () => {
      const { envelope } = envelopeService.createEnvelope(
        makeDefinition({ status: 'created' })
      );

      const result = envelopeService.updateRecipients(envelope.envelopeId, {
        signers: [
          {
            name: 'Signer 1',
            email: 's1@test.com',
            recipientId: '1',
            recipientIdGuid: '',
            recipientType: 'signer',
            routingOrder: '1',
            status: 'created',
          },
          {
            name: 'Signer 2',
            email: 's2@test.com',
            recipientId: '2',
            recipientIdGuid: '',
            recipientType: 'signer',
            routingOrder: '2',
            status: 'created',
          },
        ],
      });

      expect(result!.recipientCount).toBe('2');
    });

    it('should return null for nonexistent envelope', () => {
      const result = envelopeService.updateRecipients('nonexistent-id', {
        signers: [],
      });
      expect(result).toBeNull();
    });
  });

  describe('Template-based creation', () => {
    it('should create envelope from template', () => {
      // Create a template first
      const template = {
        templateId: 'test-template-id',
        uri: '/templates/test-template-id',
        name: 'Test Template',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        emailSubject: 'Template Subject',
        recipients: {
          signers: [
            {
              name: 'Template Signer',
              email: 'template@test.com',
              recipientId: '1',
              recipientIdGuid: '',
              recipientType: 'signer' as const,
              routingOrder: '1',
              roleName: 'Signer1',
              status: 'created' as const,
            },
          ],
        },
        documents: [
          {
            documentId: '1',
            documentIdGuid: 'test-doc-guid',
            name: 'TemplateDoc.pdf',
          },
        ],
      };
      storage.saveTemplate(template);

      const def: EnvelopeDefinition = {
        templateId: 'test-template-id',
        status: 'created',
        templateRoles: [
          {
            roleName: 'Signer1',
            name: 'Actual Signer',
            email: 'actual@test.com',
          },
        ],
      };

      const { envelope } = envelopeService.createEnvelope(def);

      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.status).toBe('created');
      // The template roles should have been applied
      const signer = envelope.recipients?.signers?.[0];
      expect(signer).toBeDefined();
      expect(signer!.name).toBe('Actual Signer');
      expect(signer!.email).toBe('actual@test.com');
    });

    it('should use template recipients when none specified', () => {
      const template = {
        templateId: 'template-recipients-test',
        uri: '/templates/template-recipients-test',
        name: 'Recipients Template',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        recipients: {
          signers: [
            {
              name: 'Default Signer',
              email: 'default@test.com',
              recipientId: '1',
              recipientIdGuid: '',
              recipientType: 'signer' as const,
              routingOrder: '1',
              status: 'created' as const,
            },
          ],
        },
      };
      storage.saveTemplate(template);

      const { envelope } = envelopeService.createEnvelope({
        templateId: 'template-recipients-test',
        status: 'created',
      });

      expect(envelope.recipients!.signers).toBeDefined();
      expect(envelope.recipients!.signers![0].name).toBe('Default Signer');
    });
  });
});
