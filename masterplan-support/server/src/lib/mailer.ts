/**
 * CT Bakery — Mailer utility
 *
 * Thin wrapper around nodemailer. Configure via environment variables:
 *
 *   SMTP_HOST   — e.g. smtp.office365.com
 *   SMTP_PORT   — e.g. 587
 *   SMTP_USER   — the sending account, e.g. noreply@ctbakery.com
 *   SMTP_PASS   — app password / SMTP password for that account
 *   SMTP_FROM   — display name + address, e.g. "CT Bakery ERP <noreply@ctbakery.com>"
 *
 * If SMTP_HOST is not set the mailer logs to console instead of sending,
 * so the rest of the app keeps working in local dev without an SMTP server.
 */

import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // No SMTP config — return a null transport that just logs
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? 'CT Bakery ERP <noreply@ctbakery.com>';

  if (!transport) {
    // Dev fallback — print to console
    console.log('[mailer] SMTP not configured — would have sent:');
    console.log(`  To:      ${Array.isArray(opts.to) ? opts.to.join(', ') : opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body:    ${opts.text ?? '(html only)'}`);
    return;
  }

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

// ── Pre-built email templates ──────────────────────────────────────────────

export function itemCreatedEmailHtml(opts: {
  requesterName: string;
  requestNumber: string;
  proposedName: string;
  masterplanCode: string;
  creationPath: string;
  timestamp: string;
}): { subject: string; html: string; text: string } {
  const subject = `[CT Bakery ERP] New item created — ${opts.masterplanCode}`;

  const pathLabel = opts.creationPath === 'copy' ? 'Copy from existing item' : 'New blank item';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #c0392b; color: #fff; padding: 20px 28px; font-size: 18px; font-weight: bold; }
    .header span { font-size: 13px; font-weight: normal; opacity: 0.85; margin-left: 8px; }
    .body { padding: 24px 28px; }
    .body p { margin: 0 0 16px 0; line-height: 1.55; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { text-align: left; color: #666; font-weight: 600; padding: 6px 10px 6px 0; width: 40%; font-size: 13px; }
    td { color: #1a1a1a; font-weight: 500; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    .footer { padding: 16px 28px; background: #fafafa; border-top: 1px solid #eee; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">🍞 Item Creation Alert <span>CT Bakery ERP</span></div>
    <div class="body">
      <p>A new item has been posted to Masterplan inventory.</p>
      <table>
        <tr><th>Masterplan Code</th> <td><strong>${opts.masterplanCode}</strong></td></tr>
        <tr><th>Item Name</th>       <td>${opts.proposedName}</td></tr>
        <tr><th>Request #</th>       <td>${opts.requestNumber}</td></tr>
        <tr><th>Created by</th>      <td>${opts.requesterName}</td></tr>
        <tr><th>Creation method</th> <td>${pathLabel}</td></tr>
        <tr><th>Timestamp</th>       <td>${opts.timestamp}</td></tr>
      </table>
      <p style="color:#666; font-size:13px;">
        This is an automated notification. Log in to the CT Bakery portal to view the full request details.
      </p>
    </div>
    <div class="footer">
      CT Bakery — Masterplan Support Layer &nbsp;|&nbsp; ERP: tobi.awonuga@ctbakery.com
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = [
    'CT Bakery — New Item Created in Masterplan',
    '',
    `Masterplan Code : ${opts.masterplanCode}`,
    `Item Name       : ${opts.proposedName}`,
    `Request #       : ${opts.requestNumber}`,
    `Created by      : ${opts.requesterName}`,
    `Creation method : ${pathLabel}`,
    `Timestamp       : ${opts.timestamp}`,
    '',
    'Log in to the CT Bakery portal to view the full request details.',
  ].join('\n');

  return { subject, html, text };
}
