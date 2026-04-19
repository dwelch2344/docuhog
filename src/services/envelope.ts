// Envelope business logic
// Handles creation, sending, voiding, and status management

import { v4 as uuidv4 } from 'uuid';
import {
  Envelope,
  EnvelopeDefinition,
  EnvelopeStatus,
  EnvelopeSummary,
  Recipient,
  Signer,
  CarbonCopy,
  Document,
  Recipients,
  EnvelopeAuditEvent,
} from '../types/docusign';
import * as storage from './storage';
import { sendEnvelopeNotifications } from './smtp';

const MOCK_ACCOUNT_ID = '12345678-abcd-1234-efgh-123456789012';
const MOCK_USER_ID = 'aabbccdd-1234-5678-9012-aabbccddeeff';
const MOCK_USER_NAME = 'DocuHog User';
const MOCK_USER_EMAIL = 'user@docuhog.local';

function nowIso(): string {
  return new Date().toISOString();
}

function buildRecipient(
  input: Partial<Recipient>,
  type: Recipient['recipientType'],
  index: number,
  status: Recipient['status']
): Recipient {
  return {
    recipientId: input.recipientId || String(index + 1),
    recipientIdGuid: uuidv4(),
    recipientType: type,
    routingOrder: input.routingOrder || String(index + 1),
    roleName: input.roleName,
    name: input.name || '',
    email: input.email || '',
    status,
    tabs: input.tabs,
    clientUserId: input.clientUserId,
    note: input.note,
    accessCode: input.accessCode,
    deliveryMethod: input.deliveryMethod || 'email',
    creationReason: 'sender',
  };
}

function buildRecipients(
  input: Recipients | undefined,
  envelopeStatus: EnvelopeStatus
): Recipients {
  const recipientStatus = envelopeStatus === 'sent' ? 'sent' : 'created';
  const result: Recipients = {};
  let count = 0;

  if (input?.signers && input.signers.length > 0) {
    result.signers = input.signers.map((s, i) => {
      count++;
      return buildRecipient(s, 'signer', i, recipientStatus) as Signer;
    });
  }

  if (input?.carbonCopies && input.carbonCopies.length > 0) {
    result.carbonCopies = input.carbonCopies.map((c, i) => {
      count++;
      return buildRecipient(
        c,
        'cc',
        (result.signers?.length || 0) + i,
        recipientStatus
      ) as CarbonCopy;
    });
  }

  if (input?.certifiedDeliveries && input.certifiedDeliveries.length > 0) {
    result.certifiedDeliveries = input.certifiedDeliveries.map((r, i) => {
      count++;
      return buildRecipient(
        r,
        'certifiedDelivery',
        (result.signers?.length || 0) + (result.carbonCopies?.length || 0) + i,
        recipientStatus
      );
    });
  }

  result.recipientCount = String(count);
  result.currentRoutingOrder = '1';
  return result;
}

function buildDocuments(input: Partial<Document>[] | undefined): Document[] {
  if (!input || input.length === 0) {
    return [
      {
        documentId: '1',
        documentIdGuid: uuidv4(),
        name: 'Document 1',
        fileExtension: 'pdf',
        order: '1',
        pages: '1',
        display: 'inline',
        includeInDownload: 'true',
        signerMustAcknowledge: 'no_interaction',
        containsPdfFormFields: 'false',
      },
    ];
  }

  return input.map((doc, i) => ({
    documentId: doc.documentId || String(i + 1),
    documentIdGuid: doc.documentIdGuid || uuidv4(),
    name: doc.name || `Document ${i + 1}`,
    fileExtension: doc.fileExtension || 'pdf',
    order: doc.order || String(i + 1),
    pages: doc.pages || '1',
    display: doc.display || 'inline',
    includeInDownload: doc.includeInDownload || 'true',
    signerMustAcknowledge: doc.signerMustAcknowledge || 'no_interaction',
    containsPdfFormFields: doc.containsPdfFormFields || 'false',
    type: doc.type,
    uri: doc.uri,
    documentBase64: doc.documentBase64,
  }));
}

function createAuditEvent(action: string, status: string, envelope: Envelope): EnvelopeAuditEvent {
  return {
    eventFields: [
      { name: 'logTime', value: nowIso() },
      { name: 'Source', value: 'api' },
      { name: 'UserName', value: envelope.sender?.userName || MOCK_USER_NAME },
      { name: 'UserId', value: envelope.sender?.userId || MOCK_USER_ID },
      { name: 'Action', value: action },
      { name: 'Message', value: `Envelope ${action}` },
      { name: 'EnvelopeStatus', value: status },
      { name: 'ClientIPAddress', value: '127.0.0.1' },
      { name: 'GeoLocation', value: 'N/A' },
    ],
  };
}

// --- Public API ---

export function createEnvelope(
  definition: EnvelopeDefinition,
  accountId?: string
): { envelope: Envelope; summary: EnvelopeSummary } {
  const now = nowIso();
  const envelopeId = uuidv4();
  const status: EnvelopeStatus = definition.status === 'sent' ? 'sent' : 'created';

  // Handle template-based envelope creation
  let recipients = definition.recipients;
  let documents = definition.documents;

  if (definition.templateId) {
    const template = storage.getTemplate(definition.templateId);
    if (template) {
      if (!recipients) {
        recipients = template.recipients;
      }
      if (!documents) {
        documents = template.documents;
      }
      // Apply template roles
      if (definition.templateRoles && recipients?.signers) {
        for (const role of definition.templateRoles) {
          const signer = recipients.signers.find((s) => s.roleName === role.roleName);
          if (signer) {
            signer.name = role.name;
            signer.email = role.email;
            if (role.clientUserId) signer.clientUserId = role.clientUserId;
            if (role.tabs) signer.tabs = role.tabs;
          }
        }
      }
    }
  }

  const envelope: Envelope = {
    envelopeId,
    envelopeUri: `/envelopes/${envelopeId}`,
    status,
    statusChangedDateTime: now,
    createdDateTime: now,
    lastModifiedDateTime: now,
    emailSubject: definition.emailSubject || 'Please sign this document',
    emailBlurb: definition.emailBlurb,
    sender: {
      userName: MOCK_USER_NAME,
      userId: MOCK_USER_ID,
      accountId: accountId || MOCK_ACCOUNT_ID,
      email: MOCK_USER_EMAIL,
    },
    recipients: buildRecipients(recipients, status),
    documents: buildDocuments(documents),
    customFields: definition.customFields,
    notification: definition.notification,
    brandId: definition.brandId,
    enableWetSign: definition.enableWetSign || 'true',
    allowMarkup: definition.allowMarkup || 'true',
    allowReassign: definition.allowReassign || 'true',
    allowComments: definition.allowComments || 'true',
    envelopeIdStamping: definition.envelopeIdStamping || 'true',
    purgeState: 'unpurged',
    is21CFRPart11: 'false',
    signerCanSignOnMobile: 'true',
    autoNavigation: 'true',
    isSignatureProviderEnvelope: 'false',
    messageLock: 'false',
    useDisclosure: 'false',
    allowViewHistory: 'true',
  };

  if (status === 'sent') {
    envelope.sentDateTime = now;
    envelope.initialSentDateTime = now;
  }

  // Store the envelope
  storage.saveEnvelope(envelope);

  // If sending, trigger email notifications
  if (status === 'sent') {
    sendEnvelopeNotifications(envelope).catch((err) => {
      console.error(`[Envelope] Failed to send notifications for ${envelopeId}:`, err);
    });
  }

  const summary: EnvelopeSummary = {
    envelopeId,
    uri: `/envelopes/${envelopeId}`,
    statusDateTime: now,
    status,
  };

  return { envelope, summary };
}

export function sendEnvelope(envelopeId: string): Envelope | null {
  const envelope = storage.getEnvelope(envelopeId);
  if (!envelope) return null;

  // Only envelopes in 'created' status can be sent
  if (envelope.status !== 'created') return null;

  const now = nowIso();
  envelope.status = 'sent';
  envelope.statusChangedDateTime = now;
  envelope.sentDateTime = now;
  envelope.initialSentDateTime = envelope.initialSentDateTime || now;
  envelope.lastModifiedDateTime = now;

  // Update recipient statuses
  const updateRecipientStatus = (recipients: Recipient[] | undefined) => {
    if (!recipients) return;
    for (const r of recipients) {
      if (r.status === 'created') {
        r.status = 'sent';
        r.sentDateTime = now;
      }
    }
  };

  updateRecipientStatus(envelope.recipients?.signers);
  updateRecipientStatus(envelope.recipients?.carbonCopies);
  updateRecipientStatus(envelope.recipients?.certifiedDeliveries);

  storage.saveEnvelope(envelope);

  // Trigger email notifications
  sendEnvelopeNotifications(envelope).catch((err) => {
    console.error(`[Envelope] Failed to send notifications for ${envelopeId}:`, err);
  });

  return envelope;
}

export function voidEnvelope(
  envelopeId: string,
  voidedReason: string
): { error: 'not_found' } | { error: 'invalid_status' } | { envelope: Envelope } {
  const envelope = storage.getEnvelope(envelopeId);
  if (!envelope) return { error: 'not_found' };

  if (envelope.status !== 'sent' && envelope.status !== 'delivered') {
    return { error: 'invalid_status' };
  }

  const now = nowIso();
  envelope.status = 'voided';
  envelope.statusChangedDateTime = now;
  envelope.voidedDateTime = now;
  envelope.voidedReason = voidedReason;
  envelope.lastModifiedDateTime = now;

  storage.saveEnvelope(envelope);
  return { envelope };
}

export function getEnvelope(envelopeId: string): Envelope | null {
  return storage.getEnvelope(envelopeId);
}

export function updateEnvelope(
  envelopeId: string,
  updates: Partial<EnvelopeDefinition>
): Envelope | null {
  const envelope = storage.getEnvelope(envelopeId);
  if (!envelope) return null;

  const now = nowIso();

  // Handle status change
  if (updates.status === 'sent' && envelope.status === 'created') {
    return sendEnvelope(envelopeId);
  }

  if (updates.emailSubject !== undefined) {
    envelope.emailSubject = updates.emailSubject;
  }
  if (updates.emailBlurb !== undefined) {
    envelope.emailBlurb = updates.emailBlurb;
  }
  if (updates.recipients) {
    envelope.recipients = buildRecipients(updates.recipients, envelope.status);
  }
  if (updates.documents) {
    envelope.documents = buildDocuments(updates.documents);
  }
  if (updates.notification) {
    envelope.notification = updates.notification;
  }
  if (updates.customFields) {
    envelope.customFields = updates.customFields;
  }

  envelope.lastModifiedDateTime = now;

  storage.saveEnvelope(envelope);
  return envelope;
}

export function listEnvelopes(filters?: {
  status?: string;
  fromDate?: string;
  searchText?: string;
}): Envelope[] {
  let envelopes = storage.listEnvelopes();

  if (filters?.status) {
    const statuses = filters.status.split(',').map((s) => s.trim().toLowerCase());
    envelopes = envelopes.filter((e) => statuses.includes(e.status.toLowerCase()));
  }

  if (filters?.fromDate) {
    const fromDate = new Date(filters.fromDate);
    if (!isNaN(fromDate.getTime())) {
      envelopes = envelopes.filter((e) => new Date(e.createdDateTime) >= fromDate);
    }
  }

  if (filters?.searchText) {
    const text = filters.searchText.toLowerCase();
    envelopes = envelopes.filter(
      (e) =>
        e.emailSubject.toLowerCase().includes(text) ||
        e.envelopeId.toLowerCase().includes(text) ||
        e.recipients?.signers?.some(
          (s) => s.name.toLowerCase().includes(text) || s.email.toLowerCase().includes(text)
        )
    );
  }

  return envelopes;
}

export function getAuditEvents(envelopeId: string): EnvelopeAuditEvent[] | null {
  const envelope = storage.getEnvelope(envelopeId);
  if (!envelope) return null;

  const events: EnvelopeAuditEvent[] = [];

  events.push(createAuditEvent('Created', 'created', envelope));

  if (
    envelope.status === 'sent' ||
    envelope.status === 'delivered' ||
    envelope.status === 'completed' ||
    envelope.status === 'voided'
  ) {
    events.push(createAuditEvent('Sent', 'sent', envelope));
  }

  if (envelope.status === 'delivered' || envelope.status === 'completed') {
    events.push(createAuditEvent('Delivered', 'delivered', envelope));
  }

  if (envelope.status === 'completed') {
    events.push(createAuditEvent('Completed', 'completed', envelope));
  }

  if (envelope.status === 'voided') {
    events.push(createAuditEvent('Voided', 'voided', envelope));
  }

  if (envelope.status === 'declined') {
    events.push(createAuditEvent('Declined', 'declined', envelope));
  }

  return events;
}

export function updateRecipients(
  envelopeId: string,
  recipientsUpdate: Recipients
): Recipients | null {
  const envelope = storage.getEnvelope(envelopeId);
  if (!envelope) return null;

  const now = nowIso();

  if (recipientsUpdate.signers) {
    if (!envelope.recipients) envelope.recipients = {};
    envelope.recipients.signers = recipientsUpdate.signers.map(
      (s, i) =>
        buildRecipient(s, 'signer', i, envelope.status === 'created' ? 'created' : 'sent') as Signer
    );
  }

  if (recipientsUpdate.carbonCopies) {
    if (!envelope.recipients) envelope.recipients = {};
    envelope.recipients.carbonCopies = recipientsUpdate.carbonCopies.map(
      (c, i) =>
        buildRecipient(
          c,
          'cc',
          (envelope.recipients?.signers?.length || 0) + i,
          envelope.status === 'created' ? 'created' : 'sent'
        ) as CarbonCopy
    );
  }

  // Recount
  let count = 0;
  if (envelope.recipients?.signers) count += envelope.recipients.signers.length;
  if (envelope.recipients?.carbonCopies) count += envelope.recipients.carbonCopies.length;
  if (envelope.recipients?.certifiedDeliveries)
    count += envelope.recipients.certifiedDeliveries.length;
  if (envelope.recipients) {
    envelope.recipients.recipientCount = String(count);
  }

  envelope.lastModifiedDateTime = now;
  storage.saveEnvelope(envelope);

  return envelope.recipients || {};
}
