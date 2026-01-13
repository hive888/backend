const logger = require('./logger');
require('dotenv').config();

// Import email utilities (same pattern as sendPasswordResetEmail)
function getTransporter() {
  const nodemailer = require('nodemailer');
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!user || !pass) {
    throw new Error('Email configuration missing: EMAIL_USER and EMAIL_PASS must be set in environment variables');
  }

  const secure = port === 465;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: {
      user: user,
      pass: pass
    },
    logger: false,
    debug: false,
    tls: {
      rejectUnauthorized: false
    }
  });
}

function getFromAddress(name = 'PTGR HUB') {
  const emailUser = process.env.EMAIL_USER || 'notification@ptgr.org';
  return `"${name}" <${emailUser}>`;
}

/**
 * Send verification code email for Telegram account linking
 */
async function sendTelegramVerificationCode(email, code) {
  const logoUrl = 'https://ptgr-bucket.s3.us-east-1.amazonaws.com/hive888/logohive888.png';
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Account Linking Verification</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header {
        background-color: #0b1b32;
        padding: 32px 20px;
        text-align: center;
      }
      .header img {
        max-width: 200px;
        height: auto;
        display: block;
        margin: 0 auto 12px;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 22px;
        font-weight: 600;
      }
      .content {
        padding: 32px 26px;
      }
      .content p {
        color: #4a4a4a;
        font-size: 15px;
        margin: 0 0 14px 0;
        line-height: 1.7;
      }
      .code-box {
        font-size: 36px;
        font-weight: bold;
        color: #0b1b32;
        background: #f3f4f6;
        padding: 24px;
        text-align: center;
        border-radius: 10px;
        margin: 24px 0;
        letter-spacing: 12px;
        font-family: 'Courier New', monospace;
        border: 2px solid #e5e7eb;
      }
      .small {
        font-size: 12px;
        color: #6b7280;
      }
      .footer {
        padding: 18px 26px 26px;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="${logoUrl}" alt="PTGR HUB (HIVE888)" />
        <h1>Telegram Account Linking</h1>
      </div>
      <div class="content">
        <p>You requested to link your Telegram account to your <b>PTGR HUB (HIVE888)</b> account.</p>
        <p>Please use the following verification code in your Telegram bot:</p>
        <div class="code-box">${code}</div>
        <p class="small"><strong>This code will expire in 10 minutes.</strong></p>
        <p class="small">If you didn't request this, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        PTGR HUB (HIVE888) — blockchain-based & Web3-enabled ecosystem connecting education, talent, innovation, and opportunity.
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `PTGR HUB (HIVE888) - Telegram Account Linking Verification

You requested to link your Telegram account to your PTGR HUB account.

Verification Code: ${code}

This code will expire in 10 minutes.

If you didn't request this, ignore this email.`;

  const mailOptions = {
    from: getFromAddress('PTGR HUB (HIVE888)'),
    to: email,
    subject: 'PTGR HUB (HIVE888) - Telegram Account Linking Verification',
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    logger.info('Telegram verification code email sent successfully', { email });
    return true;
  } catch (error) {
    logger.error('Telegram verification code email sending error:', {
      email: email,
      error: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response
    });
    console.error('Telegram verification code email sending error details:', error);
    throw new Error(`Failed to send verification code email: ${error.message}`);
  }
}

module.exports = {
  sendTelegramVerificationCode
};

