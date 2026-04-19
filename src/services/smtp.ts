// SMTP email service using nodemailer
// Sends DocuSign-style notification emails when envelopes are sent

import * as nodemailer from 'nodemailer';
import { config } from '../config';
import { Envelope, Recipient } from '../types/docusign';

let transporter: nodemailer.Transporter | null = null;
let smtpConfigured = false;

export function initSmtp(): void {
  if (!config.smtpHost) {
    console.warn('[SMTP] No SMTP_HOST configured — email notifications will be skipped');
    return;
  }

  const transportOptions: nodemailer.TransportOptions & {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  } = {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
  };

  if (config.smtpUser && config.smtpPass) {
    transportOptions.auth = {
      user: config.smtpUser,
      pass: config.smtpPass,
    };
  }

  transporter = nodemailer.createTransport(transportOptions);
  smtpConfigured = true;
  console.log(
    `[SMTP] Configured — ${config.smtpHost}:${config.smtpPort} (secure: ${config.smtpSecure})`
  );
}

export function isSmtpConfigured(): boolean {
  return smtpConfigured;
}

function buildSigningEmailHtml(envelope: Envelope, recipient: Recipient): string {
  const senderName = envelope.sender?.userName || 'DocuHog Sender';
  const senderEmail = envelope.sender?.email || 'noreply@docuhog.local';
  const subject = envelope.emailSubject || 'Please sign this document';
  const blurb = envelope.emailBlurb || '';
  const documentList =
    envelope.documents?.map((doc) => `<li>${doc.name || 'Document'}</li>`).join('') ||
    '<li>Document</li>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4c00b0; padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px;">DocuHog</span>
                    <span style="font-size: 12px; color: #d4b3ff; margin-left: 8px;">mock DocuSign</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px; color: #333; font-size: 20px;">
                ${senderName} sent you a document to review and sign
              </h2>
              <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
                From: ${senderName} &lt;${senderEmail}&gt;
              </p>

              <div style="background-color: #f8f5ff; border-left: 4px solid #4c00b0; padding: 16px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
                <p style="margin: 0 0 4px; color: #333; font-weight: 600; font-size: 14px;">
                  ${subject}
                </p>
                ${blurb ? `<p style="margin: 0; color: #666; font-size: 14px;">${blurb}</p>` : ''}
              </div>

              <p style="margin: 0 0 12px; color: #333; font-size: 14px; font-weight: 600;">
                Documents to review:
              </p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #555; font-size: 14px;">
                ${documentList}
              </ul>

              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background-color: #4c00b0; border-radius: 6px; padding: 14px 32px;">
                    <span style="color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">
                      REVIEW DOCUMENT
                    </span>
                  </td>
                </tr>
              </table>

              <div style="border-top: 1px solid #eee; padding-top: 16px;">
                <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                  This is a mock notification from <strong>DocuHog</strong>, a local DocuSign mock server.
                  <br>
                  No actual signing is required. Envelope ID: ${envelope.envelopeId}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 16px 32px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 11px; text-align: center;">
                Recipient: ${recipient.name} &lt;${recipient.email}&gt;
                <br>
                This message was sent by DocuHog for testing purposes only.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCcEmailHtml(envelope: Envelope, recipient: Recipient): string {
  const senderName = envelope.sender?.userName || 'DocuHog Sender';
  const subject = envelope.emailSubject || 'Document sent for signature';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #4c00b0; padding: 24px 32px;">
              <span style="font-size: 24px; font-weight: bold; color: #ffffff;">DocuHog</span>
              <span style="font-size: 12px; color: #d4b3ff; margin-left: 8px;">mock DocuSign</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #333; font-size: 18px;">
                You were CC'd on a document
              </h2>
              <p style="margin: 0 0 8px; color: #666; font-size: 14px;">
                <strong>${senderName}</strong> sent a document: <strong>${subject}</strong>
              </p>
              <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
                You have been added as a Carbon Copy recipient and will receive a copy when signing is complete.
              </p>
              <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                This is a mock notification from DocuHog. Envelope ID: ${envelope.envelopeId}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 16px 32px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 11px; text-align: center;">
                Recipient: ${recipient.name} &lt;${recipient.email}&gt;
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEnvelopeNotifications(envelope: Envelope): Promise<void> {
  if (!smtpConfigured || !transporter) {
    console.log(
      `[SMTP] Skipping notifications for envelope ${envelope.envelopeId} — SMTP not configured`
    );
    return;
  }

  const senderEmail = envelope.sender?.email || 'noreply@docuhog.local';
  const senderName = envelope.sender?.userName || 'DocuHog';
  const subject = envelope.emailSubject || 'Please review and sign';

  const allRecipients: Recipient[] = [];
  if (envelope.recipients?.signers) {
    allRecipients.push(...envelope.recipients.signers);
  }
  if (envelope.recipients?.carbonCopies) {
    allRecipients.push(...envelope.recipients.carbonCopies);
  }
  if (envelope.recipients?.certifiedDeliveries) {
    allRecipients.push(...envelope.recipients.certifiedDeliveries);
  }

  for (const recipient of allRecipients) {
    if (!recipient.email) continue;

    const isSigner = recipient.recipientType === 'signer';
    const html = isSigner
      ? buildSigningEmailHtml(envelope, recipient)
      : buildCcEmailHtml(envelope, recipient);

    const emailSubject = isSigner
      ? `${senderName} sent you a document to sign: ${subject}`
      : `CC: ${subject}`;

    try {
      await transporter.sendMail({
        from: `"${senderName} via DocuHog" <${senderEmail}>`,
        to: `"${recipient.name}" <${recipient.email}>`,
        subject: emailSubject,
        html,
      });
      console.log(
        `[SMTP] Sent notification to ${recipient.email} for envelope ${envelope.envelopeId}`
      );
    } catch (err) {
      console.error(
        `[SMTP] Failed to send to ${recipient.email}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
