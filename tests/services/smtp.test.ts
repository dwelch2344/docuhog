import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up isolated test data directory before any source imports
const testDataDir = path.join(os.tmpdir(), `docuhog-test-smtp-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = testDataDir;
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
delete process.env.SMTP_HOST;

import { initSmtp, isSmtpConfigured, sendEnvelopeNotifications } from '../../src/services/smtp';
import { Envelope } from '../../src/types/docusign';

afterAll(() => {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
});

function mockEnvelope(overrides?: Partial<Envelope>): Envelope {
  return {
    envelopeId: 'test-envelope-id',
    envelopeUri: '/envelopes/test-envelope-id',
    status: 'sent',
    statusChangedDateTime: new Date().toISOString(),
    createdDateTime: new Date().toISOString(),
    lastModifiedDateTime: new Date().toISOString(),
    emailSubject: 'Test Document',
    sender: {
      userName: 'Test Sender',
      userId: 'sender-id',
      accountId: 'account-id',
      email: 'sender@test.com',
    },
    recipients: {
      signers: [
        {
          recipientId: '1',
          recipientIdGuid: 'signer-guid',
          recipientType: 'signer',
          routingOrder: '1',
          name: 'Test Signer',
          email: 'signer@test.com',
          status: 'sent',
        },
      ],
      carbonCopies: [
        {
          recipientId: '2',
          recipientIdGuid: 'cc-guid',
          recipientType: 'cc',
          routingOrder: '2',
          name: 'Test CC',
          email: 'cc@test.com',
          status: 'sent',
        },
      ],
      recipientCount: '2',
    },
    documents: [
      {
        documentId: '1',
        documentIdGuid: 'doc-guid',
        name: 'TestDocument.pdf',
      },
    ],
    ...overrides,
  };
}

describe('SMTP Service', () => {
  describe('when SMTP is not configured', () => {
    it('should report SMTP as not configured', () => {
      // SMTP_HOST is not set, so initSmtp should not configure it
      initSmtp();
      expect(isSmtpConfigured()).toBe(false);
    });

    it('should skip sending notifications gracefully', async () => {
      const envelope = mockEnvelope();

      // Should not throw
      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });

    it('should handle envelope with no recipients gracefully', async () => {
      const envelope = mockEnvelope({
        recipients: { recipientCount: '0' },
      });

      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });

    it('should handle envelope with recipients missing email', async () => {
      const envelope = mockEnvelope({
        recipients: {
          signers: [
            {
              recipientId: '1',
              recipientIdGuid: 'guid',
              recipientType: 'signer',
              routingOrder: '1',
              name: 'No Email',
              email: '',
              status: 'sent',
            },
          ],
        },
      });

      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });
  });

  describe('isSmtpConfigured', () => {
    it('should return false when no SMTP host is set', () => {
      expect(isSmtpConfigured()).toBe(false);
    });
  });

  describe('sendEnvelopeNotifications content', () => {
    it('should handle envelope with no sender', async () => {
      const envelope = mockEnvelope();
      delete envelope.sender;

      // Should not throw even without sender info
      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });

    it('should handle envelope with no documents', async () => {
      const envelope = mockEnvelope();
      delete envelope.documents;

      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });

    it('should handle envelope with certified deliveries', async () => {
      const envelope = mockEnvelope({
        recipients: {
          certifiedDeliveries: [
            {
              recipientId: '3',
              recipientIdGuid: 'cert-guid',
              recipientType: 'certifiedDelivery',
              routingOrder: '3',
              name: 'Certified Person',
              email: 'certified@test.com',
              status: 'sent',
            },
          ],
          recipientCount: '1',
        },
      });

      await expect(
        sendEnvelopeNotifications(envelope)
      ).resolves.toBeUndefined();
    });
  });
});
