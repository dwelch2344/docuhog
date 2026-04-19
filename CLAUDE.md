# DocuHog

## What is this?

DocuHog is a MailHog-style mock server for the DocuSign eSignature REST API. It lets developers test DocuSign integrations locally by capturing envelope/signing requests and making them inspectable via a web UI.

## Architecture

- **TypeScript/Node.js** with Express
- **Storage**: JSON files written to `./data/` directory (ephemeral unless Docker volume mounted)
- **SMTP**: Configurable SMTP backend (e.g. MailHog) for delivering notification emails via nodemailer
- **Web UI**: Served from the same Express server, browse captured envelopes
- **Auth**: Mock OAuth token endpoints — apps just swap their base URL and it works
- **Single container**: One Dockerfile, plus a docker-compose example with MailHog

## Key Design Principles

1. **Drop-in replacement**: Apps should only need to change `DOCUSIGN_BASE_URL` and credentials to point at DocuHog
2. **Comprehensive API surface**: Mock as many DocuSign eSignature API endpoints as possible
3. **No signing ceremony**: Accept and mark envelopes as complete (no interactive signing UI)
4. **Configurable SMTP**: When an envelope is "sent", forward notification emails via a configurable SMTP provider
5. **Disk persistence**: Write captured data to disk, but assume temporary unless volume-mounted

## Project Structure

```
src/
  index.ts           - App entry point
  config.ts          - Configuration from env vars
  server.ts          - Express app setup
  routes/            - API route handlers
    oauth.ts         - OAuth/token endpoints
    envelopes.ts     - Envelope CRUD + lifecycle
    templates.ts     - Template management
    recipients.ts    - Recipient views
    accounts.ts      - Account info endpoints
    ui.ts            - Web UI routes
  services/
    storage.ts       - Disk-based JSON storage
    smtp.ts          - SMTP email delivery
    envelope.ts      - Envelope business logic
  types/
    docusign.ts      - DocuSign API type definitions
  ui/                - Web UI static assets (HTML/CSS/JS)
```

## Environment Variables

- `PORT` (default: 8025) - HTTP server port
- `SMTP_HOST` - SMTP server host (e.g. mailhog)
- `SMTP_PORT` (default: 1025) - SMTP server port
- `SMTP_SECURE` (default: false) - Use TLS
- `SMTP_USER` - SMTP auth user (optional)
- `SMTP_PASS` - SMTP auth password (optional)
- `DATA_DIR` (default: ./data) - Directory for persisted data
- `LOG_LEVEL` (default: info) - Logging level
- `UI_PORT` (default: same as PORT) - Web UI port (if separate)

## Commands

- `npm run dev` - Start dev server with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled server
- `npm test` - Run tests with coverage
- `npm run lint` - Lint code
