# DocuHog API Reference

This document covers every endpoint DocuHog exposes. Endpoints are organized into two groups:

1. **DocuSign-compatible endpoints** -- these mirror the real DocuSign eSignature REST API so your app can use them as a drop-in replacement.
2. **Internal endpoints** -- these power the DocuHog web UI and are not part of the DocuSign API.

All DocuSign-compatible endpoints live under `/restapi/v2.1/`. The `{accountId}` parameter is accepted but not validated -- you can use any value.

---

## Authentication

### POST /oauth/token

Issue a mock OAuth access token. Accepts any credentials and returns a JWT-shaped response matching the DocuSign OAuth format.

**Request:**

```http
POST /oauth/token HTTP/1.1
Host: localhost:8025
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=your-jwt-assertion
```

**Response:**

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "signature impersonation"
}
```

**Notes:**
- Any `grant_type` is accepted.
- Any `assertion` or `code` value is accepted.
- The returned `access_token` is a real JWT signed with a throwaway key. It is not validated on subsequent requests -- DocuHog accepts any `Authorization` header.

---

## Envelopes

### POST /restapi/v2.1/accounts/{accountId}/envelopes

Create a new envelope. This is the primary endpoint your app will call to send documents for signature.

**Request:**

```http
POST /restapi/v2.1/accounts/12345/envelopes HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
Content-Type: application/json
```

```json
{
  "emailSubject": "Please sign this document",
  "emailBlurb": "Here is the document for your review and signature.",
  "status": "sent",
  "recipients": {
    "signers": [
      {
        "email": "signer@example.com",
        "name": "Jane Doe",
        "recipientId": "1",
        "routingOrder": "1",
        "tabs": {
          "signHereTabs": [
            {
              "documentId": "1",
              "pageNumber": "1",
              "xPosition": "200",
              "yPosition": "400"
            }
          ]
        }
      }
    ],
    "carbonCopies": [
      {
        "email": "cc@example.com",
        "name": "John Smith",
        "recipientId": "2",
        "routingOrder": "2"
      }
    ]
  },
  "documents": [
    {
      "documentId": "1",
      "name": "Contract.pdf",
      "fileExtension": "pdf",
      "documentBase64": "JVBERi0xLjQK..."
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "uri": "/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "statusDateTime": "2024-01-15T10:30:00.000Z",
  "status": "sent"
}
```

**Notes:**
- If `status` is `"sent"`, DocuHog will send notification emails via SMTP (if configured).
- If `status` is `"created"`, the envelope is saved as a draft.
- The `documentBase64` field is accepted and stored but not processed -- DocuHog does not parse or render PDF content.

### GET /restapi/v2.1/accounts/{accountId}/envelopes

List envelopes for an account.

**Request:**

```http
GET /restapi/v2.1/accounts/12345/envelopes HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
```

**Response (200 OK):**

```json
{
  "envelopes": [
    {
      "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "sent",
      "emailSubject": "Please sign this document",
      "sentDateTime": "2024-01-15T10:30:00.000Z",
      "statusChangedDateTime": "2024-01-15T10:30:00.000Z"
    },
    {
      "envelopeId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "status": "created",
      "emailSubject": "Draft agreement",
      "createdDateTime": "2024-01-15T09:00:00.000Z",
      "statusChangedDateTime": "2024-01-15T09:00:00.000Z"
    }
  ],
  "resultSetSize": "2",
  "totalSetSize": "2",
  "startPosition": "0",
  "endPosition": "1"
}
```

### GET /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}

Get details for a specific envelope.

**Request:**

```http
GET /restapi/v2.1/accounts/12345/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
```

**Response (200 OK):**

```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "emailSubject": "Please sign this document",
  "emailBlurb": "Here is the document for your review and signature.",
  "sentDateTime": "2024-01-15T10:30:00.000Z",
  "createdDateTime": "2024-01-15T10:30:00.000Z",
  "statusChangedDateTime": "2024-01-15T10:30:00.000Z",
  "recipients": {
    "signers": [
      {
        "email": "signer@example.com",
        "name": "Jane Doe",
        "recipientId": "1",
        "status": "sent"
      }
    ],
    "carbonCopies": [
      {
        "email": "cc@example.com",
        "name": "John Smith",
        "recipientId": "2",
        "status": "sent"
      }
    ]
  },
  "documents": [
    {
      "documentId": "1",
      "name": "Contract.pdf"
    }
  ]
}
```

### PUT /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}

Update an existing envelope. Commonly used to change status (e.g., send a draft).

**Request:**

```http
PUT /restapi/v2.1/accounts/12345/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
Content-Type: application/json
```

```json
{
  "status": "sent"
}
```

**Response (200 OK):**

```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "statusChangedDateTime": "2024-01-15T10:45:00.000Z"
}
```

---

## Templates

### POST /restapi/v2.1/accounts/{accountId}/templates

Create a new template.

**Request:**

```http
POST /restapi/v2.1/accounts/12345/templates HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
Content-Type: application/json
```

```json
{
  "name": "Standard NDA",
  "description": "Non-disclosure agreement template",
  "emailSubject": "Please sign the NDA",
  "recipients": {
    "signers": [
      {
        "roleName": "Signer",
        "recipientId": "1",
        "routingOrder": "1"
      }
    ]
  },
  "documents": [
    {
      "documentId": "1",
      "name": "NDA.pdf",
      "fileExtension": "pdf"
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "templateId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "name": "Standard NDA",
  "uri": "/templates/c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

### GET /restapi/v2.1/accounts/{accountId}/templates

List all templates.

**Request:**

```http
GET /restapi/v2.1/accounts/12345/templates HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
```

**Response (200 OK):**

```json
{
  "envelopeTemplates": [
    {
      "templateId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "name": "Standard NDA",
      "description": "Non-disclosure agreement template",
      "created": "2024-01-10T08:00:00.000Z",
      "lastModified": "2024-01-10T08:00:00.000Z"
    }
  ],
  "resultSetSize": "1",
  "totalSetSize": "1",
  "startPosition": "0",
  "endPosition": "0"
}
```

### GET /restapi/v2.1/accounts/{accountId}/templates/{templateId}

Get details for a specific template.

**Request:**

```http
GET /restapi/v2.1/accounts/12345/templates/c3d4e5f6-a7b8-9012-cdef-123456789012 HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
```

**Response (200 OK):**

```json
{
  "templateId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "name": "Standard NDA",
  "description": "Non-disclosure agreement template",
  "emailSubject": "Please sign the NDA",
  "created": "2024-01-10T08:00:00.000Z",
  "lastModified": "2024-01-10T08:00:00.000Z",
  "recipients": {
    "signers": [
      {
        "roleName": "Signer",
        "recipientId": "1",
        "routingOrder": "1"
      }
    ]
  },
  "documents": [
    {
      "documentId": "1",
      "name": "NDA.pdf"
    }
  ]
}
```

---

## Recipients

### POST /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/views/recipient

Create a recipient view (embedded signing URL). In the real DocuSign API, this returns a URL that opens the signing ceremony. DocuHog returns a URL, but it points to a placeholder page since interactive signing is not implemented.

**Request:**

```http
POST /restapi/v2.1/accounts/12345/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/views/recipient HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
Content-Type: application/json
```

```json
{
  "authenticationMethod": "none",
  "email": "signer@example.com",
  "userName": "Jane Doe",
  "returnUrl": "https://myapp.example.com/signing-complete",
  "clientUserId": "user-123"
}
```

**Response (201 Created):**

```json
{
  "url": "http://localhost:8025/signing/a1b2c3d4-e5f6-7890-abcd-ef1234567890?token=mock-token"
}
```

**Notes:**
- The returned URL does not open a real signing ceremony.
- Your app can still use the URL to verify its integration flow works correctly.

---

## Accounts

### GET /restapi/v2.1/accounts/{accountId}

Get account information. Returns mock account data.

**Request:**

```http
GET /restapi/v2.1/accounts/12345 HTTP/1.1
Host: localhost:8025
Authorization: Bearer any-token-works
```

**Response (200 OK):**

```json
{
  "accountId": "12345",
  "accountName": "DocuHog Mock Account",
  "billingPeriodStartDate": "2024-01-01T00:00:00.000Z",
  "billingPeriodEndDate": "2024-12-31T23:59:59.000Z",
  "planName": "DocuHog Development",
  "currentPlanId": "mock-plan-001"
}
```

---

## Internal / UI Endpoints

These endpoints are used by DocuHog's web UI. They are not part of the DocuSign API and should not be relied on by your application.

### GET /api/v1/health

Health check endpoint. Used by Docker `HEALTHCHECK` and monitoring tools.

**Response (200 OK):**

```json
{
  "status": "ok",
  "uptime": 12345.678
}
```

### GET /api/v1/envelopes

List all captured envelopes. Used by the web UI to display the envelope list.

**Response (200 OK):**

```json
{
  "envelopes": [
    {
      "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "emailSubject": "Please sign this document",
      "status": "sent",
      "createdDateTime": "2024-01-15T10:30:00.000Z",
      "recipients": {
        "signers": [
          {
            "email": "signer@example.com",
            "name": "Jane Doe"
          }
        ]
      }
    }
  ],
  "totalCount": 1
}
```

---

## Differences from the Real DocuSign API

DocuHog aims to be a useful approximation, not a perfect replica. Here are the key differences:

| Area | Real DocuSign | DocuHog |
|------|---------------|---------|
| **Authentication** | OAuth 2.0 with real credentials, JWT grant, authorization code grant | Accepts anything, returns mock tokens |
| **Account IDs** | Must match your real account | Any value accepted, not validated |
| **Signing ceremony** | Full interactive signing UI | Not implemented -- signing URLs are placeholders |
| **PDF processing** | Renders, merges, and stamps PDFs | Stores `documentBase64` as-is, no processing |
| **Webhooks (Connect)** | Sends HTTP callbacks on status changes | Not implemented |
| **Status transitions** | Complex lifecycle with voiding, declining, correcting | Simplified: `created` -> `sent` -> `completed` |
| **Envelope expiration** | Envelopes expire after configurable time | No expiration |
| **Bulk operations** | Bulk send, bulk envelope APIs | Not implemented |
| **Conditional routing** | Recipients can be conditional | Not implemented |
| **Document download** | Download signed/combined documents | Not implemented |
| **Error responses** | Detailed error codes matching DocuSign error format | Best-effort error format matching |
| **Pagination** | Full cursor-based pagination | Basic pagination |
| **Rate limiting** | Per-endpoint rate limits | No rate limiting |
