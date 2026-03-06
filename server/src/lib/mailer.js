'use strict';
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587', 10),
    secure: parseInt(SMTP_PORT ?? '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn('[mailer] SMTP not configured — email sending disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM to enable.');
}

/**
 * Send an email. No-op if SMTP is not configured.
 * @param {{ to: string, subject: string, html: string }} opts
 */
async function sendMail({ to, subject, html }) {
  if (!transporter) return;
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}

module.exports = { sendMail };
