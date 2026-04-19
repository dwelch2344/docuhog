// DocuHog - MailHog-style mock server for DocuSign eSignature API
// Entry point: start the server and log startup info

import { config } from './config';
import { createApp } from './server';
import { initStorage } from './services/storage';
import { initSmtp, isSmtpConfigured } from './services/smtp';

function main(): void {
  // Initialize storage directories
  initStorage();
  console.log(`[Storage] Data directory: ${config.dataDir}`);

  // Initialize SMTP transport
  initSmtp();

  // Create and start the Express app
  const app = createApp();

  app.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║             DocuHog v1.0.0               ║');
    console.log('  ║   Mock DocuSign eSignature API Server    ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  API Server:  http://localhost:${config.port}`);
    console.log(`  Web UI:      http://localhost:${config.port}`);
    console.log(`  Base URL:    http://localhost:${config.port}/restapi`);
    console.log(`  OAuth:       http://localhost:${config.port}/oauth/token`);
    console.log('');
    console.log(`  Data Dir:    ${config.dataDir}`);
    console.log(
      `  SMTP:        ${isSmtpConfigured() ? `${config.smtpHost}:${config.smtpPort}` : 'not configured'}`
    );
    console.log(`  Log Level:   ${config.logLevel}`);
    console.log('');
    console.log('  Set DOCUSIGN_BASE_URL=http://localhost:' + config.port + '/restapi in your app');
    console.log('');
  });
}

main();
