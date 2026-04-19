// Internal API for the DocuHog Web UI
// Simpler formats and additional endpoints for the frontend

import { Router, Request, Response } from 'express';
import { config } from '../config';
import * as storage from '../services/storage';
import { isSmtpConfigured } from '../services/smtp';

const router = Router();

// Helper: safely extract a route param as a string
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/v1/health — Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// GET /api/v1/config — Server configuration (safe to expose)
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    port: config.port,
    dataDir: config.dataDir,
    logLevel: config.logLevel,
    smtp: {
      configured: isSmtpConfigured(),
      host: config.smtpHost || null,
      port: config.smtpPort,
      secure: config.smtpSecure,
    },
  });
});

// GET /api/v1/stats — Envelope and template statistics
router.get('/stats', (_req: Request, res: Response) => {
  const envelopes = storage.listEnvelopes();
  const templates = storage.listTemplates();

  const statusCounts: Record<string, number> = {};
  for (const env of envelopes) {
    statusCounts[env.status] = (statusCounts[env.status] || 0) + 1;
  }

  res.json({
    totalEnvelopes: envelopes.length,
    totalTemplates: templates.length,
    envelopesByStatus: statusCounts,
    recentEnvelopes: envelopes.slice(0, 5).map((e) => ({
      envelopeId: e.envelopeId,
      emailSubject: e.emailSubject,
      status: e.status,
      createdDateTime: e.createdDateTime,
    })),
  });
});

// GET /api/v1/envelopes — List all envelopes (simplified for UI)
router.get('/envelopes', (req: Request, res: Response) => {
  let envelopes = storage.listEnvelopes();

  // Optional status filter
  const status = req.query.status as string | undefined;
  if (status) {
    const statuses = status.split(',').map((s) => s.trim().toLowerCase());
    envelopes = envelopes.filter((e) => statuses.includes(e.status.toLowerCase()));
  }

  const result = envelopes.map((e) => ({
    envelopeId: e.envelopeId,
    emailSubject: e.emailSubject,
    emailBlurb: e.emailBlurb,
    status: e.status,
    createdDateTime: e.createdDateTime,
    sentDateTime: e.sentDateTime,
    completedDateTime: e.completedDateTime,
    voidedDateTime: e.voidedDateTime,
    lastModifiedDateTime: e.lastModifiedDateTime,
    sender: e.sender,
    recipientCount: e.recipients?.recipientCount || '0',
    documentCount: String(e.documents?.length || 0),
    signers:
      e.recipients?.signers?.map((s) => ({
        name: s.name,
        email: s.email,
        status: s.status,
      })) || [],
  }));

  res.json({
    total: result.length,
    envelopes: result,
  });
});

// GET /api/v1/envelopes/:id — Get envelope detail
router.get('/envelopes/:id', (req: Request, res: Response) => {
  const id = param(req, 'id');
  const envelope = storage.getEnvelope(id);
  if (!envelope) {
    res.status(404).json({ error: 'Envelope not found' });
    return;
  }
  res.json(envelope);
});

// DELETE /api/v1/envelopes/:id — Delete a single envelope
router.delete('/envelopes/:id', (req: Request, res: Response) => {
  const id = param(req, 'id');
  const deleted = storage.deleteEnvelope(id);
  if (!deleted) {
    res.status(404).json({ error: 'Envelope not found' });
    return;
  }
  console.log(`[API] Deleted envelope ${id}`);
  res.json({ deleted: true, envelopeId: id });
});

// DELETE /api/v1/envelopes — Delete all envelopes
router.delete('/envelopes', (_req: Request, res: Response) => {
  const count = storage.deleteAllEnvelopes();
  console.log(`[API] Deleted all envelopes (${count} total)`);
  res.json({ deleted: true, count });
});

// GET /api/v1/templates — List templates (simplified for UI)
router.get('/templates', (_req: Request, res: Response) => {
  const templates = storage.listTemplates();

  const result = templates.map((t) => ({
    templateId: t.templateId,
    name: t.name,
    description: t.description,
    created: t.created,
    lastModified: t.lastModified,
    owner: t.owner,
    recipientCount:
      (t.recipients?.signers?.length || 0) + (t.recipients?.carbonCopies?.length || 0),
    documentCount: t.documents?.length || 0,
  }));

  res.json({
    total: result.length,
    templates: result,
  });
});

export { router as apiRouter };
