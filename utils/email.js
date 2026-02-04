const logger = require('./logger');
require('dotenv').config();

// Email configuration
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

function getFromAddress(name = 'Hive888') {
  const emailUser = process.env.EMAIL_USER || 'notification@ptgr.org';
  return `"${name}" <${emailUser}>`;
}

const sendWelcomeEmail = async (email, firstName, usersource) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Hive888</title>
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
        padding: 40px 20px;
        text-align: center;
      }
      .header img {
        max-width: 200px;
        height: auto;
        display: block;
        margin: 0 auto 20px;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.5px;
      }
      .content {
        padding: 40px 30px;
      }
      .welcome-message {
        margin-bottom: 30px;
      }
      .welcome-message h2 {
        color: #1e3a5f;
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 24px;
        font-weight: 600;
      }
      .welcome-message p {
        color: #4a4a4a;
        font-size: 16px;
        margin-bottom: 16px;
        line-height: 1.7;
      }
      .highlight-box {
        background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
        border-radius: 8px;
        padding: 25px;
        margin: 30px 0;
        text-align: center;
      }
      .highlight-box h3 {
        color: #1e3a5f;
        margin: 0 0 15px 0;
        font-size: 20px;
        font-weight: 600;
      }
      .highlight-box p {
        color: #1e3a5f;
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
      }
      .features {
        margin: 30px 0;
      }
      .features h3 {
        color: #1e3a5f;
        font-size: 18px;
        margin-bottom: 15px;
        font-weight: 600;
      }
      .feature-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .feature-list li {
        color: #4a4a4a;
        font-size: 15px;
        margin-bottom: 12px;
        padding-left: 25px;
        position: relative;
        line-height: 1.6;
      }
      .feature-list li:before {
        content: "→";
        position: absolute;
        left: 0;
        color: #ffa500;
        font-weight: bold;
        font-size: 18px;
      }
      .footer {
        text-align: center;
        padding: 30px 20px;
        background-color: #f8f9fa;
        font-size: 13px;
        color: #666666;
        border-top: 1px solid #e0e0e0;
      }
      .footer p {
        margin: 8px 0;
        color: #666666;
      }
      .footer a {
        color: #1e3a5f;
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://ptgr-bucket.s3.us-east-1.amazonaws.com/hive888/logohive888.png" alt="Hive888 Logo">
        <h1>Welcome to Hive888</h1>
      </div>
      
      <div class="content">
        <div class="welcome-message">
          <h2>Dear ${firstName},</h2>
          <p>Welcome to <strong>Hive888</strong>! We're thrilled to have you join our platform.</p>
          
          <p>HIVE888 is an emerging interactive platform that brings together talent, enterprises, and institutions to collaborate within a trusted Web3 ecosystem.</p>
        </div>
        
        <div class="highlight-box">
          <h3>Our Mission</h3>
          <p>Closing critical structural gaps in Africa's digital economy</p>
        </div>
        
        <div class="features">
          <h3>What We Connect:</h3>
          <ul class="feature-list">
            <li><strong>Education-to-Skills:</strong> Transform learning into practical, market-ready capabilities</li>
            <li><strong>Talent-to-Opportunity:</strong> Bridge the gap between skilled professionals and meaningful opportunities</li>
            <li><strong>Innovation-to-Impact:</strong> Turn innovative ideas into real-world solutions</li>
          </ul>
        </div>
        
        <div class="welcome-message">
          <p>We're excited to have you on board and look forward to supporting your journey in the Web3 space. Your account is now active, and you can start exploring the platform to discover courses, connect with opportunities, and be part of Africa's digital transformation.</p>
        </div>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Hive888. All rights reserved.</p>
        <p>If you have any questions, please contact us at <a href="mailto:info@hive888.org">info@hive888.org</a></p>
        <p>Hive888 - An emerging interactive platform that brings together talent, enterprises, and institutions to collaborate within a trusted Web3 ecosystem.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Welcome to Hive888!\n\n
Dear ${firstName},\n\n
Welcome to Hive888! We're thrilled to have you join our platform.\n\n
HIVE888 is an emerging interactive platform that brings together talent, enterprises, and institutions to collaborate within a trusted Web3 ecosystem.\n\n
We're excited to have you on board and look forward to supporting your journey in the Web3 space. Your account is now active, and you can start exploring the platform.\n\n
© ${new Date().getFullYear()} Hive888. All rights reserved.\n
Contact us at info@hive888.org if you have any questions.\n
Hive888 - An emerging interactive platform that brings together talent, enterprises, and institutions to collaborate within a trusted Web3 ecosystem.`;

  const mailOptions = {
    from: getFromAddress('Hive888'),
    to: email,
    subject: `Welcome to Hive888, ${firstName}!`,
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error('Welcome email sending error', {
      email: email,
      error: error.message
    });
    throw error;
  }
};

const sendCourseRegistrationWelcomeEmail = async (email, firstName) => {
  const imageUrl = 'https://ptgr-bucket.s3.us-east-1.amazonaws.com/Resources/PurchasedMessage.webp';

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome — Your PTGR × IETSA Blockchain Journey Begins</title>
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
        background-color: transparent;
        padding: 0;
        margin: 0;
        text-align: center;
      }
      .header img {
        width: 100%;
        max-width: 600px;
        height: auto;
        display: block;
        margin: 0;
        padding: 0;
      }
      .content {
        padding: 40px 30px;
      }
      .welcome-message {
        margin-bottom: 30px;
      }
      .welcome-message h2 {
        color: #ce9021;
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 24px;
        font-weight: 600;
      }
      .welcome-message h3 {
        color: #ce9021;
        margin-top: 30px;
        margin-bottom: 15px;
        font-size: 20px;
        font-weight: 600;
      }
      .welcome-message p {
        color: #4a4a4a;
        font-size: 16px;
        margin-bottom: 16px;
        line-height: 1.7;
        text-align: left;
      }
      .footer {
        text-align: center;
        padding: 30px 20px;
        background-color: #f8f9fa;
        font-size: 13px;
        color: #666666;
        border-top: 1px solid #e0e0e0;
      }
      .footer p {
        margin: 8px 0;
        color: #666666;
      }
      .footer a {
        color: #1e3a5f;
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="${imageUrl}" alt="Welcome Header">
      </div>
      
      <div class="content">
        <div class="welcome-message">
          
          <p style="text-align: left;">Dear ${firstName},</p>
          <p>Welcome, and congratulations on joining the IETSA Global Partner Spotlight Program. As part of IETSA's commitment to education that leads to real opportunity, you now have access to an international learning environment focused on practical blockchain and Web3 knowledge.</p>
          
          <h3>📘 Your Learning Journey</h3>
          <p>This self-paced program is designed to help you build clear, foundational understanding through structured lessons, quizzes, and exercises. We encourage you to take each activity seriously, as they prepare you for the next step.</p>
          
          <h3>🎓 Co-Branded Certification</h3>
          <p>After completing the program, you will be eligible to receive an official co-branded certification issued jointly by PTGR AG (Switzerland) and IETSA, along with the option to receive an NFT credential as a verified digital record of your achievement.</p>
          
          <h3>❓ Need Support?</h3>
          <p>You can reply to this email or contact:</p>
          <p>contact@hive888.org<br>partnerspotlight@ietsa.org.za</p>
          
          <p>We're proud to support your journey into the future of digital skills.</p>
          
          <p><strong>Education Support Team</strong><br>Powered by PTGR AG (Switzerland) × IETSA</p>
        </div>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Hive888. All rights reserved.</p>
        <p>If you have any questions, please contact us at <a href="mailto:info@hive888.org">info@hive888.org</a></p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Welcome — Your PTGR × IETSA Blockchain Journey Begins

Dear ${firstName},

Welcome, and congratulations on joining the IETSA Global Partner Spotlight Program. As part of IETSA's commitment to education that leads to real opportunity, you now have access to an international learning environment focused on practical blockchain and Web3 knowledge.

📘 Your Learning Journey
This self-paced program is designed to help you build clear, foundational understanding through structured lessons, quizzes, and exercises. We encourage you to take each activity seriously, as they prepare you for the next step.

🎓 Co-Branded Certification
After completing the program, you will be eligible to receive an official co-branded certification issued jointly by PTGR AG (Switzerland) and IETSA, along with the option to receive an NFT credential as a verified digital record of your achievement.

❓ Need Support?
You can reply to this email or contact:
contact@hive888.org
partnerspotlight@ietsa.org.za

We're proud to support your journey into the future of digital skills.

Education Support Team
Powered by PTGR AG (Switzerland) × IETSA

© ${new Date().getFullYear()} Hive888. All rights reserved.`;

  const mailOptions = {
    from: getFromAddress('PTGR × IETSA'),
    to: email,
    subject: `Welcome — Your PTGR × IETSA Blockchain Journey Begins`,
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    logger.info('Course registration welcome email sent successfully', { email, firstName });
    return true;
  } catch (error) {
    logger.error('Course registration welcome email sending error', {
      email: email,
      error: error.message
    });
    throw error;
  }
};

// Placeholder functions for other email types (to be implemented as needed)
const sendPasswordResetEmail = async (email, resetToken) => {
  // Implementation needed
  logger.warn('sendPasswordResetEmail not yet implemented');
  return true;
};

const sendVerificationEmail = async (email, verificationCode) => {
  // Implementation needed
  logger.warn('sendVerificationEmail not yet implemented');
  return true;
};

const sendNewsletterThankYouEmail = async (email, firstName) => {
  // Implementation needed
  logger.warn('sendNewsletterThankYouEmail not yet implemented');
  return true;
};

const sendTokenInterestEmail = async (email, data) => {
  // Implementation needed
  logger.warn('sendTokenInterestEmail not yet implemented');
  return true;
};

module.exports = {
  sendWelcomeEmail,
  sendCourseRegistrationWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendNewsletterThankYouEmail,
  sendTokenInterestEmail
};

