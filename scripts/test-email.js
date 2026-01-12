#!/usr/bin/env node
/**
 * Email Test Script
 * Tests the email configuration using environment variables
 * Usage: node scripts/test-email.js [recipient-email]
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🔌 Testing email configuration...\n');

  // Get configuration from environment
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // Get recipient from command line argument or use sender as default
  const recipient = process.argv[2] || user;

  console.log('Configuration:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  User: ${user}`);
  console.log(`  Recipient: ${recipient}`);
  console.log('');

  if (!user || !pass) {
    console.error('❌ Error: Missing email configuration!');
    console.error('Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS in your .env file');
    process.exit(1);
  }

  // Determine secure based on port
  const secure = port === 465;

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
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

    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Send test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: `"PTGR Test" <${user}>`,
      to: recipient,
      subject: 'Test Email from PTGR API',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 8px;
            }
            .success {
              background-color: #d4edda;
              color: #155724;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">
              <h2>✅ Email Configuration Test Successful!</h2>
            </div>
            <p>This is a test email from your PTGR API email configuration.</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li><strong>SMTP Host:</strong> ${host}</li>
              <li><strong>SMTP Port:</strong> ${port}</li>
              <li><strong>Email User:</strong> ${user}</li>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
            <p>If you received this email, your email configuration is working correctly! 🎉</p>
          </div>
        </body>
        </html>
      `,
      text: `
Email Configuration Test Successful!

This is a test email from your PTGR API email configuration.

Configuration Details:
- SMTP Host: ${host}
- SMTP Port: ${port}
- Email User: ${user}
- Test Time: ${new Date().toLocaleString()}

If you received this email, your email configuration is working correctly!
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log(`📨 Message ID: ${info.messageId}`);
    console.log(`📬 Email sent to: ${recipient}\n`);
    console.log('✅ Email test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Email test failed!');
    console.error(`Error: ${error.message}\n`);

    if (error.code === 'EAUTH') {
      console.error('💡 Authentication failed. Possible issues:');
      console.error('  - Incorrect email or password');
      console.error('  - For Gmail: Make sure you\'re using an "App Password" not your regular password');
      console.error('  - Enable "Less secure app access" or use OAuth2');
    } else if (error.code === 'ECONNECTION') {
      console.error('💡 Connection failed. Possible issues:');
      console.error('  - Incorrect SMTP host or port');
      console.error('  - Firewall blocking the connection');
      console.error('  - SMTP server is down');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('💡 Connection timeout. Possible issues:');
      console.error('  - Network connectivity problems');
      console.error('  - SMTP server is not responding');
    }

    process.exit(1);
  }
}

testEmail();

