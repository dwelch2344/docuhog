// DocuSign Template REST API routes
// Mounted at /restapi/v2.1/accounts/:accountId/templates

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Template,
  TemplateSummary,
  TemplateListResult,
  TemplateDefinition,
} from '../types/docusign';
import * as storage from '../services/storage';

const router = Router({ mergeParams: true });

const MOCK_USER_ID = 'aabbccdd-1234-5678-9012-aabbccddeeff';
const MOCK_USER_NAME = 'DocuHog User';
const MOCK_USER_EMAIL = 'user@docuhog.local';

// Helper: safely extract a route param as a string
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// POST / — Create template
router.post('/', (req: Request, res: Response) => {
  const body: TemplateDefinition = req.body;
  const now = new Date().toISOString();
  const templateId = uuidv4();

  if (!body.name) {
    res.status(400).json({
      errorCode: 'INVALID_REQUEST_PARAMETER',
      message: 'The request contained at least one invalid parameter. name is required.',
    });
    return;
  }

  const template: Template = {
    templateId,
    uri: `/templates/${templateId}`,
    name: body.name,
    description: body.description,
    created: now,
    lastModified: now,
    shared: body.shared || 'false',
    owner: {
      userName: MOCK_USER_NAME,
      userId: MOCK_USER_ID,
      email: MOCK_USER_EMAIL,
    },
    emailSubject: body.emailSubject,
    emailBlurb: body.emailBlurb,
    recipients: body.recipients,
    documents: body.documents as Template['documents'],
    customFields: body.customFields,
    notification: body.notification,
    status: 'created',
  };

  storage.saveTemplate(template);

  console.log(`[Templates] Created template ${templateId}: "${body.name}"`);

  const summary: TemplateSummary = {
    templateId,
    uri: `/templates/${templateId}`,
    name: body.name,
  };

  res.status(201).json(summary);
});

// GET / — List templates
router.get('/', (req: Request, res: Response) => {
  let templates = storage.listTemplates();

  // Filter by search_text if provided
  const searchText = req.query.search_text as string | undefined;
  if (searchText) {
    const text = searchText.toLowerCase();
    templates = templates.filter(
      (t) => t.name.toLowerCase().includes(text) || t.description?.toLowerCase().includes(text)
    );
  }

  const result: TemplateListResult = {
    resultSetSize: String(templates.length),
    startPosition: '0',
    endPosition: String(Math.max(0, templates.length - 1)),
    totalSetSize: String(templates.length),
    envelopeTemplates: templates.length > 0 ? templates : undefined,
  };

  res.json(result);
});

// GET /:templateId — Get template
router.get('/:templateId', (req: Request, res: Response) => {
  const templateId = param(req, 'templateId');
  const template = storage.getTemplate(templateId);
  if (!template) {
    res.status(404).json({
      errorCode: 'TEMPLATE_DOES_NOT_EXIST',
      message: `The template ${templateId} does not exist.`,
    });
    return;
  }
  res.json(template);
});

// PUT /:templateId — Update template
router.put('/:templateId', (req: Request, res: Response) => {
  const templateId = param(req, 'templateId');
  const template = storage.getTemplate(templateId);
  if (!template) {
    res.status(404).json({
      errorCode: 'TEMPLATE_DOES_NOT_EXIST',
      message: `The template ${templateId} does not exist.`,
    });
    return;
  }

  const body: TemplateDefinition = req.body;
  const now = new Date().toISOString();

  if (body.name !== undefined) template.name = body.name;
  if (body.description !== undefined) template.description = body.description;
  if (body.emailSubject !== undefined) template.emailSubject = body.emailSubject;
  if (body.emailBlurb !== undefined) template.emailBlurb = body.emailBlurb;
  if (body.recipients !== undefined) template.recipients = body.recipients;
  if (body.documents !== undefined) template.documents = body.documents as Template['documents'];
  if (body.customFields !== undefined) template.customFields = body.customFields;
  if (body.notification !== undefined) template.notification = body.notification;
  if (body.shared !== undefined) template.shared = body.shared;

  template.lastModified = now;

  storage.saveTemplate(template);

  console.log(`[Templates] Updated template ${templateId}: "${template.name}"`);

  const summary: TemplateSummary = {
    templateId: template.templateId,
    uri: template.uri,
    name: template.name,
  };

  res.json(summary);
});

// DELETE /:templateId — Delete template
router.delete('/:templateId', (req: Request, res: Response) => {
  const templateId = param(req, 'templateId');
  const deleted = storage.deleteTemplate(templateId);
  if (!deleted) {
    res.status(404).json({
      errorCode: 'TEMPLATE_DOES_NOT_EXIST',
      message: `The template ${templateId} does not exist.`,
    });
    return;
  }

  console.log(`[Templates] Deleted template ${templateId}`);
  res.status(200).json({});
});

export { router as templatesRouter };
