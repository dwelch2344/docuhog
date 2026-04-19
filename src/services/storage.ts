// Disk-based JSON storage service
// Stores envelopes and templates as individual JSON files under DATA_DIR

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { Envelope, Template } from '../types/docusign';

const ENVELOPES_DIR = 'envelopes';
const TEMPLATES_DIR = 'templates';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function envelopesDir(): string {
  return path.join(config.dataDir, ENVELOPES_DIR);
}

function templatesDir(): string {
  return path.join(config.dataDir, TEMPLATES_DIR);
}

function envelopePath(envelopeId: string): string {
  return path.join(envelopesDir(), `${envelopeId}.json`);
}

function templatePath(templateId: string): string {
  return path.join(templatesDir(), `${templateId}.json`);
}

// Initialize storage directories
export function initStorage(): void {
  ensureDir(config.dataDir);
  ensureDir(envelopesDir());
  ensureDir(templatesDir());
}

// --- Envelopes ---

export function saveEnvelope(envelope: Envelope): void {
  const filePath = envelopePath(envelope.envelopeId);
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf-8');
}

export function getEnvelope(envelopeId: string): Envelope | null {
  const filePath = envelopePath(envelopeId);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Envelope;
}

export function listEnvelopes(): Envelope[] {
  const dir = envelopesDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const envelopes: Envelope[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    try {
      envelopes.push(JSON.parse(raw) as Envelope);
    } catch {
      // Skip malformed files
    }
  }
  // Sort by creation date descending (newest first)
  envelopes.sort(
    (a, b) =>
      new Date(b.createdDateTime).getTime() -
      new Date(a.createdDateTime).getTime()
  );
  return envelopes;
}

export function deleteEnvelope(envelopeId: string): boolean {
  const filePath = envelopePath(envelopeId);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function deleteAllEnvelopes(): number {
  const dir = envelopesDir();
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(dir, file));
  }
  return files.length;
}

// --- Templates ---

export function saveTemplate(template: Template): void {
  const filePath = templatePath(template.templateId);
  fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
}

export function getTemplate(templateId: string): Template | null {
  const filePath = templatePath(templateId);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Template;
}

export function listTemplates(): Template[] {
  const dir = templatesDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const templates: Template[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    try {
      templates.push(JSON.parse(raw) as Template);
    } catch {
      // Skip malformed files
    }
  }
  templates.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );
  return templates;
}

export function deleteTemplate(templateId: string): boolean {
  const filePath = templatePath(templateId);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
