// DocuSign Envelope REST API routes
// Mounted at /restapi/v2.1/accounts/:accountId/envelopes

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  EnvelopeDefinition,
  EnvelopesListResult,
  ViewUrl,
  EnvelopeAuditEventsResult,
} from '../types/docusign';
import * as envelopeService from '../services/envelope';
import { config } from '../config';

const router = Router({ mergeParams: true });

// Helper: safely extract a route param as a string
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// Minimal valid PDF (a single blank page)
const PLACEHOLDER_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF',
  'utf-8'
);

// POST / — Create envelope
router.post('/', (req: Request, res: Response) => {
  const definition: EnvelopeDefinition = req.body;
  const accountId = param(req, 'accountId');

  if (!definition.emailSubject && !definition.templateId) {
    res.status(400).json({
      errorCode: 'INVALID_REQUEST_PARAMETER',
      message:
        'The request contained at least one invalid parameter. emailSubject is required.',
    });
    return;
  }

  const { summary } = envelopeService.createEnvelope(definition, accountId);

  console.log(
    `[Envelopes] Created envelope ${summary.envelopeId} (status: ${summary.status})`
  );

  res.status(201).json(summary);
});

// GET / — List envelopes
router.get('/', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const fromDate = req.query.from_date as string | undefined;
  const searchText = req.query.search_text as string | undefined;

  const envelopes = envelopeService.listEnvelopes({
    status,
    fromDate,
    searchText,
  });

  const result: EnvelopesListResult = {
    resultSetSize: String(envelopes.length),
    startPosition: '0',
    endPosition: String(Math.max(0, envelopes.length - 1)),
    totalSetSize: String(envelopes.length),
    envelopes: envelopes.length > 0 ? envelopes : undefined,
  };

  res.json(result);
});

// GET /:envelopeId — Get envelope
router.get('/:envelopeId', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }
  res.json(envelope);
});

// PUT /:envelopeId — Update envelope (send, void, etc.)
router.put('/:envelopeId', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const body = req.body;

  // Handle void
  if (body.status === 'voided') {
    const voidedReason = body.voidedReason || 'Voided by user';
    const envelope = envelopeService.voidEnvelope(envelopeId, voidedReason);
    if (!envelope) {
      res.status(400).json({
        errorCode: 'ENVELOPE_CANNOT_VOID',
        message:
          'Only envelopes in "sent" or "delivered" status can be voided.',
      });
      return;
    }
    console.log(`[Envelopes] Voided envelope ${envelopeId}`);
    res.json({
      envelopeId: envelope.envelopeId,
      envelopeUri: envelope.envelopeUri,
      status: envelope.status,
      statusDateTime: envelope.statusChangedDateTime,
    });
    return;
  }

  // Handle send
  if (body.status === 'sent') {
    const envelope = envelopeService.sendEnvelope(envelopeId);
    if (!envelope) {
      res.status(404).json({
        errorCode: 'ENVELOPE_DOES_NOT_EXIST',
        message: `The envelope ${envelopeId} does not exist.`,
      });
      return;
    }
    console.log(`[Envelopes] Sent envelope ${envelopeId}`);
    res.json({
      envelopeId: envelope.envelopeId,
      envelopeUri: envelope.envelopeUri,
      status: envelope.status,
      statusDateTime: envelope.statusChangedDateTime,
    });
    return;
  }

  // General update
  const envelope = envelopeService.updateEnvelope(envelopeId, body);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }
  console.log(`[Envelopes] Updated envelope ${envelopeId}`);
  res.json({
    envelopeId: envelope.envelopeId,
    envelopeUri: envelope.envelopeUri,
    status: envelope.status,
    statusDateTime: envelope.statusChangedDateTime,
  });
});

// GET /:envelopeId/recipients — Get recipients
router.get('/:envelopeId/recipients', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }
  res.json(envelope.recipients || { recipientCount: '0' });
});

// PUT /:envelopeId/recipients — Update recipients
router.put('/:envelopeId/recipients', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const recipients = envelopeService.updateRecipients(envelopeId, req.body);
  if (!recipients) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }
  res.json(recipients);
});

// GET /:envelopeId/documents — List documents
router.get('/:envelopeId/documents', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }

  res.json({
    envelopeId: envelope.envelopeId,
    envelopeDocuments: envelope.documents || [],
  });
});

// GET /:envelopeId/documents/:documentId — Get document content
router.get(
  '/:envelopeId/documents/:documentId',
  (req: Request, res: Response) => {
    const envelopeId = param(req, 'envelopeId');
    const documentId = param(req, 'documentId');
    const envelope = envelopeService.getEnvelope(envelopeId);
    if (!envelope) {
      res.status(404).json({
        errorCode: 'ENVELOPE_DOES_NOT_EXIST',
        message: `The envelope ${envelopeId} does not exist.`,
      });
      return;
    }

    const doc = envelope.documents?.find(
      (d) => d.documentId === documentId
    );
    if (!doc) {
      res.status(404).json({
        errorCode: 'DOCUMENT_DOES_NOT_EXIST',
        message: `The document ${documentId} does not exist in envelope ${envelopeId}.`,
      });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.name || 'document'}.pdf"`
    );
    res.send(PLACEHOLDER_PDF);
  }
);

// POST /:envelopeId/views/recipient — Create recipient view (embedded signing URL)
router.post('/:envelopeId/views/recipient', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }

  const returnUrl = req.body.returnUrl || 'http://localhost:3000/signing/complete';

  // Generate a mock signing URL that points back to the return URL
  const signingToken = uuidv4();
  const port = config.port;
  const mockSigningUrl = `http://localhost:${port}/signing/${envelopeId}?token=${signingToken}&returnUrl=${encodeURIComponent(returnUrl)}`;

  const response: ViewUrl = {
    url: mockSigningUrl,
  };

  console.log(
    `[Envelopes] Created recipient view for envelope ${envelopeId}`
  );
  res.status(201).json(response);
});

// POST /:envelopeId/views/sender — Create sender view
router.post('/:envelopeId/views/sender', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }

  const returnUrl = req.body.returnUrl || 'http://localhost:3000/sending/complete';
  const port = config.port;
  const mockSenderUrl = `http://localhost:${port}/sending/${envelopeId}?returnUrl=${encodeURIComponent(returnUrl)}`;

  const response: ViewUrl = {
    url: mockSenderUrl,
  };

  console.log(
    `[Envelopes] Created sender view for envelope ${envelopeId}`
  );
  res.status(201).json(response);
});

// GET /:envelopeId/audit_events — Get audit events
router.get('/:envelopeId/audit_events', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const events = envelopeService.getAuditEvents(envelopeId);
  if (!events) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }

  const result: EnvelopeAuditEventsResult = {
    auditEvents: events,
  };

  res.json(result);
});

// GET /:envelopeId/notification — Get notification settings
router.get('/:envelopeId/notification', (req: Request, res: Response) => {
  const envelopeId = param(req, 'envelopeId');
  const envelope = envelopeService.getEnvelope(envelopeId);
  if (!envelope) {
    res.status(404).json({
      errorCode: 'ENVELOPE_DOES_NOT_EXIST',
      message: `The envelope ${envelopeId} does not exist.`,
    });
    return;
  }

  res.json(
    envelope.notification || {
      useAccountDefaults: 'true',
      reminders: {
        reminderEnabled: 'false',
        reminderDelay: '0',
        reminderFrequency: '0',
      },
      expirations: {
        expireEnabled: 'true',
        expireAfter: '120',
        expireWarn: '3',
      },
    }
  );
});

export { router as envelopesRouter };
