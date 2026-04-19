// DocuHog configuration — loaded from environment variables

export interface Config {
  port: number;
  smtpHost: string | undefined;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  dataDir: string;
  logLevel: string;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function envInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export function loadConfig(): Config {
  return {
    port: envInt(process.env.PORT, 8025),
    smtpHost: process.env.SMTP_HOST || undefined,
    smtpPort: envInt(process.env.SMTP_PORT, 1025),
    smtpSecure: envBool(process.env.SMTP_SECURE, false),
    smtpUser: process.env.SMTP_USER || undefined,
    smtpPass: process.env.SMTP_PASS || undefined,
    dataDir: process.env.DATA_DIR || './data',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

export const config = loadConfig();
