# DocuHog Configuration

DocuHog is configured entirely through environment variables. Every variable has a sensible default, so you can run DocuHog with zero configuration for basic use. This document covers each variable in detail along with examples for common setups.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8025` | HTTP server port for the API and web UI |
| `SMTP_HOST` | *(none)* | SMTP server hostname |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for the SMTP connection |
| `SMTP_USER` | *(none)* | SMTP authentication username |
| `SMTP_PASS` | *(none)* | SMTP authentication password |
| `DATA_DIR` | `./data` | Directory where envelope and template JSON files are stored |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, or `error` |
| `UI_PORT` | same as `PORT` | Port for the web UI (if you want it separate from the API) |

---

## SMTP Configuration

When DocuHog "sends" an envelope, it delivers notification emails to the configured SMTP server. If no `SMTP_HOST` is set, emails are silently skipped.

### MailHog (recommended for local development)

[MailHog](https://github.com/mailhog/MailHog) catches all outgoing emails and displays them in a web UI. This is the default setup in `docker-compose.yml`.

```bash
# Using docker-compose.yml (already configured):
docker compose up

# Or set manually:
SMTP_HOST=localhost
SMTP_PORT=1025
```

When using Docker Compose, the SMTP host is `mailhog` (the service name):

```yaml
environment:
  - SMTP_HOST=mailhog
  - SMTP_PORT=1025
```

MailHog's web UI is available at [http://localhost:8026](http://localhost:8026) (mapped in `docker-compose.yml` to avoid conflicting with DocuHog on 8025).

### Mailtrap

[Mailtrap](https://mailtrap.io/) is a hosted email testing service. It catches emails like MailHog but runs in the cloud.

```bash
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

### Gmail SMTP

You can use Gmail's SMTP server to send real emails during testing. You will need an [App Password](https://support.google.com/accounts/answer/185833) (not your regular Gmail password).

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Warning:** This sends real emails. Only use this if you intentionally want notification emails delivered to actual inboxes.

### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Amazon SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

### Disabling Email

If you do not want any emails sent, simply omit `SMTP_HOST`. DocuHog will skip email delivery and log a message at the `debug` level.

---

## Storage Configuration

DocuHog stores all captured envelopes and templates as JSON files on disk.

### Default (ephemeral)

```bash
DATA_DIR=./data
```

When running locally with Node.js, data is written to `./data/` relative to the project root. When running in Docker, the default is `/data`.

**Docker volumes:**

By default, Docker containers have ephemeral storage. Data is lost when the container is removed. To persist data across container restarts, mount a volume:

```yaml
# In docker-compose.yml:
services:
  docuhog:
    volumes:
      - docuhog-data:/data

volumes:
  docuhog-data:
```

Or with `docker run`:

```bash
docker run -p 8025:8025 -v docuhog-data:/data docuhog
```

### Custom directory

```bash
DATA_DIR=/tmp/docuhog-data
```

The directory is created automatically if it does not exist. Ensure the process has write permissions.

### Clearing data

To reset all captured data, stop DocuHog and delete the data directory:

```bash
# Local:
rm -rf ./data

# Docker volume:
docker volume rm docuhog-data
```

---

## Logging

DocuHog uses structured logging to stdout.

### Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Verbose output including every incoming request, SMTP connection details, and storage operations. Useful for troubleshooting. |
| `info` | Default. Logs server startup, envelope creation, and email delivery. |
| `warn` | Only warnings (e.g., SMTP connection failures that are non-fatal). |
| `error` | Only errors (e.g., storage write failures, uncaught exceptions). |

### Examples

```bash
# See everything (useful when debugging integrations):
LOG_LEVEL=debug npm run dev

# Quiet mode (production-like):
LOG_LEVEL=error npm start
```

In Docker:

```yaml
environment:
  - LOG_LEVEL=debug
```

---

## Server Port

### Single port (default)

By default, the API and web UI are served on the same port:

```bash
PORT=8025
```

### Separate UI port

If you want the web UI on a different port from the API (e.g., for firewall rules or reverse proxy setups):

```bash
PORT=3000        # API
UI_PORT=8025     # Web UI
```

---

## Complete Examples

### Local development with MailHog

```bash
# Terminal 1: start MailHog
docker run -p 8026:8025 -p 1025:1025 mailhog/mailhog

# Terminal 2: start DocuHog
SMTP_HOST=localhost SMTP_PORT=1025 npm run dev
```

### Docker Compose with persistent storage

```yaml
# docker-compose.yml
services:
  docuhog:
    build: .
    ports:
      - "8025:8025"
    environment:
      - SMTP_HOST=mailhog
      - SMTP_PORT=1025
      - LOG_LEVEL=debug
    volumes:
      - docuhog-data:/data
    depends_on:
      - mailhog

  mailhog:
    image: mailhog/mailhog
    ports:
      - "8026:8025"
      - "1025:1025"

volumes:
  docuhog-data:
```

### CI/CD pipeline

In CI, you typically want ephemeral storage and no SMTP:

```bash
docker run -d \
  --name docuhog \
  -p 8025:8025 \
  -e LOG_LEVEL=warn \
  docuhog
```

No SMTP configuration means emails are silently skipped. The container will clean up its data when removed.

### Production-like setup with Mailtrap

```bash
docker run -d \
  --name docuhog \
  -p 8025:8025 \
  -e SMTP_HOST=sandbox.smtp.mailtrap.io \
  -e SMTP_PORT=2525 \
  -e SMTP_USER=your-username \
  -e SMTP_PASS=your-password \
  -e LOG_LEVEL=info \
  -v docuhog-data:/data \
  docuhog
```
