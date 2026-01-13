const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const fs = require('fs');
const fetch = require('node-fetch'); 
const path = require('path');
require('dotenv').config();

/**
 * Get email transporter configured from environment variables
 * Returns a single transporter instance that can be reused
 */
function getTransporter() {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!user || !pass) {
    throw new Error('Email configuration missing: EMAIL_USER and EMAIL_PASS must be set in environment variables');
  }

  // Gmail uses port 587 with secure: false (STARTTLS)
  // Port 465 uses secure: true (SSL/TLS)
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
      rejectUnauthorized: false // Allow self-signed certificates if needed
    }
  });
}

/**
 * Get the "from" email address using environment variable
 * @param {string} name - Display name for the sender
 * @returns {string} Formatted from address
 */
function getFromAddress(name = 'PTGR') {
  const emailUser = process.env.EMAIL_USER || 'notification@ptgr.org';
  return `"${name}" <${emailUser}>`;
}
  const logoPath = path.join(__dirname, 'logo.png');
  const compressedLogo = logoPath.toString('base64');
  const PTGR_LOGO_BASE64 = `data:image/png;base64,${compressedLogo}`;
  // 2. PDF Generation Function
 const generateInvoicePDF = async (email, firstName, amount, currency, token, phone, registrationId) => {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
  
      try {
        // Invoice details
        const invoiceNumber = `CH_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const today = new Date();
        const currentDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
        const tokenPrice = (parseFloat(amount) / parseInt(token)).toFixed(3);
        const discount = (parseFloat(amount) * 0.1).toFixed(2);
        const vatAmount = ((parseFloat(amount) - parseFloat(discount)) * 0.081).toFixed(2);
        const grandTotal = amount;
  
        // Header with logo
        const headerY = 40;
            const logoUrl = 'https://ptgr-bucket.s3.us-east-1.amazonaws.com/Resources/logo.png';
            const logoPath = path.join(__dirname, 'actual_logo.png');
            const fileExists = fs.existsSync(logoPath);
            
            console.log(`Logo file exists at ${logoPath}:`, fileExists);
            if (fileExists) {
                console.log('Logo file stats:', fs.statSync(logoPath));
            }

            let logoLoaded = false;

            // 1. Try fetching from URL first
            try {
                const response = await fetch(logoUrl);
                if (response.ok) {
                  const buffer = Buffer.from(await response.arrayBuffer());
                  
                  // Get image dimensions to calculate aspect ratio
                  const imageSize = sizeOf(buffer);
                  const aspectRatio = imageSize.width / imageSize.height;
                  
                  // Set fixed height and calculate width proportionally
                  const maxHeight = 60;
                  const autoWidth = maxHeight * aspectRatio;
                  
                  doc.image(buffer, 40, headerY, { 
                      width: 100,  // Auto-calculated width
                      height: 50, // Fixed maximum height
                      align: 'left',
                      valign: 'top'
                  });
                  
                  logoLoaded = true;
                  console.log(`Successfully loaded logo (${Math.round(autoWidth)}×${maxHeight}) from URL`);
              }
            } catch (urlError) {
                console.log('URL logo fetch failed:', urlError.message);
            }

            // 2. Try local file if URL failed
            if (!logoLoaded && fileExists) {
                try {
                    // First try direct file path
                    doc.image(logoPath, 50, headerY, {
                        width: 120,
                        height: 46,
                        align: 'left',
                        valign: 'top',
                        cover: [120, 46] 
                    });
                    logoLoaded = true;
                    console.log('Successfully loaded logo from local file');
                } catch (fileError) {
                    console.log('Direct file load failed, trying base64:', fileError.message);
                    
                    // 3. Try base64 conversion if direct load fails
                    try {
                        const fileBuffer = fs.readFileSync(logoPath);
                        const base64Logo = `data:image/png;base64,${fileBuffer.toString('base64')}`;
                        doc.image(base64Logo, 50, headerY, {
                            width: 60,
                            height: 60,
                            align: 'left',
                            valign: 'top'
                        });
                        logoLoaded = true;
                        console.log('Successfully loaded logo from base64');
                    } catch (base64Error) {
                        console.log('Base64 conversion failed:', base64Error.message);
                    }
                }
            }
        // If both failed, use placeholder
        if (!logoLoaded) {
            doc.rect(50, headerY, 60, 60)
               .fill('#000000')
               .fontSize(8)
               .fillColor('#ffffff')
               .text('PTGR', 55, headerY + 25, { width: 50, align: 'center' });
        }

  
        // "The Invoice" text (right side)
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('The Invoice', 400, headerY + 15, { align: 'right' });
  
        // Horizontal line
        doc.rect(50, headerY + 70, 500, 2)
           .fill('#000000');
  
        // Company info
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#000000')
           .text('PTGR AG | Ibelweg 18a | 6300 Zug', 50, headerY + 80);
  
        // Customer information
        doc.text(`${firstName}`, 50, 150)
           .text(email, 50, 165)
           .text(phone, 50, 180)
           .text(`Reference: ${registrationId}`, 50, 210)
           .text(`Date: ${currentDate}`, 50, 225);
  
        // Invoice table
// Invoice table// Invoice table settings
const tableTop = 260;
const descriptionX = 50; // Left margin
const amountX = 400;    // Position for amount column
const lineHeight = 30;
const pageWidth = 595;  // A4 width in points (PDF units)
const tableWidth = pageWidth - (descriptionX * 2); // Full width minus margins
const firstColWidth = tableWidth - 150; // Most space for description
const secondColWidth = 150; // Fixed width for amount

// Draw cell borders for all rows
for (let row = 0; row < 3; row++) { // 3 rows: header, item, total
    const y = tableTop + (row * lineHeight);
    
    // Horizontal lines (full width)
    doc.moveTo(descriptionX, y)
       .lineTo(descriptionX + tableWidth, y)
       .stroke('#000000');
    
    // Vertical lines
    doc.moveTo(descriptionX, y)
       .lineTo(descriptionX, y + lineHeight)
       .stroke('#000000');
       
    doc.moveTo(descriptionX + firstColWidth, y)
       .lineTo(descriptionX + firstColWidth, y + lineHeight)
       .stroke('#000000');
       
    doc.moveTo(descriptionX + tableWidth, y)
       .lineTo(descriptionX + tableWidth, y + lineHeight)
       .stroke('#000000');
}

// Header row
doc.font('Helvetica-Bold')
   .text('', descriptionX + 10, tableTop + 8) // Empty first column
   .text('Amount', descriptionX + firstColWidth + 10, tableTop + 8);

// Item row
doc.font('Helvetica')
   .text(`${token} PTGR Token a ${tokenPrice} ${currency}`, 
         descriptionX + 10, 
         tableTop + lineHeight + 8,
         { width: firstColWidth - 20 })
   .text(`${parseFloat(amount).toFixed(2)} ${currency}`, 
         descriptionX + firstColWidth + 10, 
         tableTop + lineHeight + 8,
         { width: secondColWidth - 20 });

// Total row
doc.font('Helvetica-Bold')
   .text('Total', 
         descriptionX + 10, 
         tableTop + (lineHeight * 2) + 8,
         { width: firstColWidth - 20, align: 'right' })
   .text(`${grandTotal} ${currency}`, 
         descriptionX + firstColWidth + 10, 
         tableTop + (lineHeight * 2) + 8,
         { width: secondColWidth - 20 });

// Final bottom border
doc.moveTo(descriptionX, tableTop + (lineHeight * 3))
   .lineTo(descriptionX + tableWidth, tableTop + (lineHeight * 3))
   .stroke('#000000');
  
        // Payment info
        const paymentTop = tableTop + (lineHeight * 5);
        doc.font('Helvetica')
           .text('Thank you for your token purchase. Please transfer the amount to the PostFinance account within 5 business days:', 50, paymentTop, { width: 500 })
           .text('Bank: PostFinance', 50, paymentTop + 40)
           .text('Account holder: PTGR AG', 50, paymentTop + 55)
           .text('BIC: POFICHBEXXX', 50, paymentTop + 70)
           .text('IBAN: CH34 0900 0000 1556 0906 8', 50, paymentTop + 85)
           .text('Please provide reference number', 50, paymentTop + 100);
  
        // Footer
        const footerTop = 700;
        doc.text('Besten Dank,', 50, footerTop)
           .text('Ihre PTGR AG', 50, footerTop + 15)
           .text('PTGR AG Ibelweg 18a, 6300 Zug | E-Mail: info@ptgr.ch', 50, footerTop + 40)
           .text('Bank: PostFinance Account holder: PTGR AG BIC: POFICHBEXXX IBAN: CH91 0900 0000 8076 3253 6', 50, footerTop + 55)
           .text('Website: www.ptgr.ch', 50, footerTop + 70);
  
        doc.end();
      } catch (error) {
        console.error('PDF generation failed:', error);
        reject(error);
      }
    });
  };
const generateConfirmationNumber = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const sendConfirmationEmail = async (email, confirmationNumber) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .confirmation-number { 
        font-size: 24px; 
        font-weight: bold; 
        color: #2563eb;
        margin: 20px 0;
        padding: 10px;
        background: #f0f7ff;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Your Confirmation Number</h2>
      <p>Here is your confirmation number:</p>
      <div class="confirmation-number">${confirmationNumber}</div>
      <p>Please keep this number for your records.</p>
    </div>
  </body>
  </html>
  `;

  const textContent = `Your confirmation number is: ${confirmationNumber}\n\nPlease keep this number for your records.`;

  const mailOptions = {
    from: getFromAddress('PTGR AG'),
    to: email,
    subject: 'Your Confirmation Number',
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send confirmation email');
  }
};
const sendPurchaseConfirmationEmail = async ({ email, name, orderId, items, totalAmount, paymentMethod, transactionId }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const itemRows = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const htmlContent = `
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
        border: 1px solid #e1e1e1;
        border-radius: 8px;
      }
      .header {
        color: #2563eb;
        border-bottom: 1px solid #e1e1e1;
        padding-bottom: 10px;
      }
      .thank-you {
        font-size: 18px;
        margin: 20px 0;
      }
      .order-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      .order-table th {
        background-color: #f5f5f5;
        text-align: left;
        padding: 8px;
        border-bottom: 2px solid #ddd;
      }
      .order-table td {
        padding: 8px;
        border-bottom: 1px solid #eee;
      }
      .total-row {
        font-weight: bold;
        background-color: #f9f9f9;
      }
      .details-box {
        background-color: #f5f5f5;
        padding: 15px;
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="header">PTGR AG</h1>
      <h2>Order Confirmation</h2>
      
      <p class="thank-you">Dear ${name},</p>
      <p>Thank you for your purchase! Your order #${orderId} has been confirmed.</p>
      
      <h3>Order Summary</h3>
      <table class="order-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">Total:</td>
            <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="details-box">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${orderId}</p>
        <p><strong>Transaction ID:</strong> ${transactionId}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('de-CH')}</p>
      </div>
      
      <p>If you have any questions about your order, please contact our customer service.</p>
      
      <div class="footer">
        <p>PTGR AG</p>
        <p>© ${new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Order Confirmation\n\n
Dear ${name},\n\n
Thank you for your purchase! Your order #${orderId} has been confirmed.\n\n
Order Summary:\n
${items.map(item => `${item.name} (Qty: ${item.quantity}) - ${formatCurrency(item.price)} each = ${formatCurrency(item.price * item.quantity)}`).join('\n')}\n\n
Total: ${formatCurrency(totalAmount)}\n\n
Order Details:\n
Order Number: ${orderId}\n
Transaction ID: ${transactionId}\n
Payment Method: ${paymentMethod}\n
Order Date: ${new Date().toLocaleDateString('de-CH')}\n\n
If you have any questions about your order, please contact our customer service.\n\n
PTGR AG\n
© ${new Date().getFullYear()} All Rights Reserved`;

  const mailOptions = {
    from: getFromAddress('PTGR Token'),
    to: email,
    subject: `Order Confirmation #${orderId}`,
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    // Send customer confirmation
    console.log('📧 Sending confirmation email to customer...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Customer email sent');
  
    // OPTIONAL: wait 500ms between sends
    await new Promise((res) => setTimeout(res, 500));
  
    // Prepare staff notification
    const staffNotificationOptions = {
      from: getFromAddress('PTGR Token System'),
      to: ['david.schmiedel@ptgr.ch', 'accounting@ptgr.ch'],
      subject: `New $PTGR Token Purchase Request from ${firstName} (${currencySymbol}${formattedAmount})`,
      text: `A new token interest was submitted:\n\nName: ${firstName}\nEmail: ${email}\nPhone: ${phone}\nAmount: ${currencySymbol}${formattedAmount}\nToken: ${token}\nNetwork: ${networkName}\nPayment Method: ${paymentUrl !== "0" ? "Crypto" : "Bank Transfer"}\nRegistration ID: ${registrationId}`,
      html: `
        <p><strong>New $PTGR Token Purchase Request</strong></p>
        <ul>
          <li><strong>Name:</strong> ${firstName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Amount:</strong> ${currencySymbol}${formattedAmount}</li>
          <li><strong>Token:</strong> ${token}</li>
          <li><strong>Network:</strong> ${networkName}</li>
          <li><strong>Payment Method:</strong> ${paymentUrl !== "0" ? "Crypto" : "Bank Transfer"}</li>
          <li><strong>Registration ID:</strong> ${registrationId}</li>
        </ul>
        <p>Please follow up with the customer if needed.</p>
      `
    };
  
    console.log('📧 Sending staff notification email...');
    await transporter.sendMail(staffNotificationOptions);
    console.log('✅ Staff notification sent');
  
    return true;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error('Failed to send one or more emails');
  }


};
const sendPasswordResetEmail = async (email, resetLink) => {
  const logoUrl = 'https://ptgr-bucket.s3.us-east-1.amazonaws.com/hive888/logohive888.png';
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your password</title>
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
      .button {
        display: inline-block;
        padding: 12px 18px;
        background-color: #0b1b32;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 700;
        margin: 16px 0 6px;
      }
      .small {
        font-size: 12px;
        color: #6b7280;
      }
      .codebox {
        word-break: break-all;
        background: #f3f4f6;
        padding: 12px;
        border-radius: 10px;
        font-size: 12px;
        color: #111827;
      }
      .footer {
        padding: 18px 26px 26px;
        font-size: 12px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="${logoUrl}" alt="PTGR HUB (HIVE888)" />
        <h1>Password reset</h1>
      </div>
      <div class="content">
        <p>We received a request to reset your password for <b>PTGR HUB (HIVE888)</b>.</p>
        <p>If you made this request, click the button below to set a new password:</p>
        <a href="${resetLink}" class="button">Reset Password</a>
        <p class="small">This link will expire in 1 hour.</p>
        <p class="small">If you didn’t request a password reset, you can safely ignore this email.</p>
        <p class="small">If the button doesn’t work, copy and paste this link into your browser:</p>
        <div class="codebox">${resetLink}</div>
      </div>
      <div class="footer">
        PTGR HUB (HIVE888) — blockchain-based & Web3-enabled ecosystem connecting education, talent, innovation, and opportunity.
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent =
`PTGR HUB (HIVE888) - Password reset

We received a request to reset your password.

Reset link (expires in 1 hour):
${resetLink}

If you didn’t request this, ignore this email.`;

  const mailOptions = {
    from: getFromAddress('PTGR HUB (HIVE888)'),
    to: email,
    subject: 'PTGR HUB (HIVE888) - Reset your password',
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Password reset email sending error:', error);
    throw new Error('Failed to send password reset email');
  }
};
const sendVerificationEmail = async (email, verificationLink) => {
  const htmlContent = `
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
        border: 1px solid #e1e1e1;
        border-radius: 8px;
      }
      .header {
        color: #2563eb;
        border-bottom: 1px solid #e1e1e1;
        padding-bottom: 10px;
      }
      .verify-button {
        display: inline-block;
        padding: 12px 24px;
        background-color: #2563eb;
        color: white !important;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        margin: 20px 0;
      }
      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="header">Verify Your Email Address</h1>
      <p>Thank you for registering with us! Please verify your email address by clicking the button below:</p>
      
      <a href="${verificationLink}" class="verify-button">Verify Email</a>
      
      <p>If you didn't create an account with us, please ignore this email.</p>
      
      <div class="footer">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${verificationLink}</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Email Verification\n\n
Thank you for registering with us! Please verify your email address by visiting the following link:\n\n
${verificationLink}\n\n
If you didn't create an account with us, please ignore this email.`;

  const mailOptions = {
    from: getFromAddress('PTGR AG'),
    to: email,
    subject: 'Verify Your Email Address',
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Verification email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};
const sendWelcomeEmail = async (email, firstName, usersource) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to PTGR HUB - HIVE888</title>
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
        <img src="https://ptgr-bucket.s3.us-east-1.amazonaws.com/hive888/logohive888.png" alt="PTGR HUB - HIVE888 Logo">
        <h1>Welcome to PTGR HUB</h1>
      </div>
      
      <div class="content">
        <div class="welcome-message">
          <h2>Dear ${firstName},</h2>
          <p>Welcome to <strong>PTGR HUB (HIVE888)</strong>! We're thrilled to have you join our blockchain-based and Web3-enabled ecosystem.</p>
          
          <p>PTGR HUB is designed to connect education, talent, innovation, and opportunity into one central place, serving as a single access point for individuals, institutions, and partners to actively participate in Africa's blockchain-driven digital transformation and emerging Web3 economy.</p>
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
        <p>© ${new Date().getFullYear()} PTGR HUB (HIVE888). All rights reserved.</p>
        <p>If you have any questions, please contact us at <a href="mailto:info@hive888.org">info@hive888.org</a></p>
        <p>PTGR HUB - Building Africa's Web3 Professionals</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Welcome to PTGR HUB (HIVE888)!\n\n
Dear ${firstName},\n\n
Welcome to PTGR HUB (HIVE888)! We're thrilled to have you join our blockchain-based and Web3-enabled ecosystem.\n\n
PTGR HUB is designed to connect education, talent, innovation, and opportunity into one central place, serving as a single access point for individuals, institutions, and partners to actively participate in Africa's blockchain-driven digital transformation and emerging Web3 economy.\n\n
OUR MISSION:\n
Closing critical structural gaps in Africa's digital economy\n\n
WHAT WE CONNECT:\n
→ Education-to-Skills: Transform learning into practical, market-ready capabilities\n
→ Talent-to-Opportunity: Bridge the gap between skilled professionals and meaningful opportunities\n
→ Innovation-to-Impact: Turn innovative ideas into real-world solutions\n\n
We're excited to have you on board and look forward to supporting your journey in the Web3 space. Your account is now active, and you can start exploring the platform to discover courses, connect with opportunities, and be part of Africa's digital transformation.\n\n
© ${new Date().getFullYear()} PTGR HUB (HIVE888). All rights reserved.\n
Contact us at info@hive888.org if you have any questions.\n
PTGR HUB - Building Africa's Web3 Professionals`;

  const mailOptions = {
    from: getFromAddress('PTGR HUB'),
    to: email,
    subject: `Welcome to PTGR HUB, ${firstName}!`,
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
    throw new Error('Failed to send welcome email');
  }
};
const sendTokenInterestEmail = async (email, firstName, amount, currency, token, phone, registrationId, paymentMethodID) => {
  console.log('Preparing token interest email', { email, firstName, amount, currency });
  
  const formattedAmount = amount;
  const currencySymbol = currency;

  // Bank transfer information
  const bankInstructionsHtml = `
    <div class="payment-box">
      <h3 class="highlight">Bank Transfer Instructions</h3>
      <div class="payment-instructions">
        <p><strong>Bank:</strong> PostFinance</p>
        <p><strong>Account holder:</strong> PTGR AG</p>
        <p><strong>BIC:</strong> POFICHBEXXX</p>
        <p><strong>IBAN:</strong> CH34 0900 0000 1556 0906 8</p>
        <p><strong>Amount to transfer:</strong> ${currencySymbol}${formattedAmount}</p>
        <p><strong>Important:</strong> Please include your Reference ID in the payment reference field.</p>
      </div>
    </div>
  `;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Your Interest in $PTGR Token</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #FFD700;
        margin: 0;
        padding: 0;
        background-color: #000000;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background: #121212;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
        border: 1px solid #FFD700;
      }
      .header {
        background-color: #000000;
        padding: 30px 20px;
        text-align: center;
        border-bottom: 2px solid #e9c872;
      }
      .header img {
        max-width: 180px;
      }
      .header h1 {
        color: #e9c872;
        margin: 15px 0 0;
        font-size: 24px;
        text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
      }
      .content {
        padding: 30px;
      }
      .message {
        margin-bottom: 25px;
      }
      .message h2 {
        color: #e9c872;
        margin-top: 0;
        border-bottom: 1px solid #e9c872;
        padding-bottom: 10px;
      }
      .token-section {
        background-color: #1A1A1A;
        border-left: 4px solid #e9c872;
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 4px 4px 0;
      }
      .highlight {
        color: #e9c872;
        font-weight: bold;
        font-size: 18px;
      }
      .cta-button {
        display: inline-block;
        background-color: #e9c872;
        color: #000000 !important;
        text-decoration: none;
        padding: 12px 25px;
        border-radius: 4px;
        font-weight: bold;
        margin: 15px 0;
        text-align: center;
        border: 1px solid #e9c872;
        transition: all 0.3s ease;
      }
      .cta-button:hover {
        background-color: #000000;
        color: #e9c872 !important;
      }
      .footer {
        text-align: center;
        padding: 20px;
        background-color: #000000;
        font-size: 12px;
        color: #e9c872;
        border-top: 1px solid #e9c872;
      }
      .social-links {
        margin: 20px 0;
      }
      .social-links a {
        margin: 0 10px;
        text-decoration: none;
        color: #e9c872;
      }
      .golden-text {
        color: #e9c872;
      }
      .disclaimer {
        font-size: 11px;
        color: #888;
        margin-top: 30px;
        border-top: 1px solid #333;
        padding-top: 15px;
      }
      p {
        color: #D0D5DD;
      }
      .payment-box {
        background-color: #1A1A1A;
        border: 2px solid #e9c872;
        padding: 20px;
        margin: 20px 0;
        border-radius: 5px;
        text-align: center;
      }
      .payment-address {
        font-weight: bold;
        font-size: 16px;
        word-break: break-all;
        color: #e9c872;
        margin: 10px 0;
      }
      .payment-instructions {
        font-size: 14px;
        margin: 15px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://ptgr-bucket.s3.us-east-1.amazonaws.com/ptgrio/ptgrio.png" alt="PTGR AG Logo">
        <h1>Thank You for Your $PTGR Token Purchase Request</h1>
      </div>
      
      <div class="content">
        <div class="message">
          <h2>Dear <span class="golden-text">${firstName}</span>,</h2>
          <p>We have received your request to purchase <span class="highlight">${currencySymbol}${formattedAmount} worth of $PTGR tokens</span>.</p>
          <p>Our investment team will review your request and contact you.</p>
        </div>
        
        <div class="token-section">
          <h3 class="highlight">Your Purchase Request Details</h3>
          <p><strong>Requested Amount:</strong> <span class="highlight">${currencySymbol}${formattedAmount}</span></p>
          <p><strong>Registration ID:</strong> ${registrationId}</p>
          <p><strong>Payment Method:</strong> Bank Transfer</p>
        </div>
        
        ${bankInstructionsHtml}
        
        <div class="token-section">
          <h3 class="highlight">What Happens Next?</h3>
          <p>1. Our team will review your request and contact you to confirm your order.</p>
          <p>2. Please transfer the amount due to the bank account above and include your Reference ID in the payment reference.</p>
          <p>3. You will be notified immediately after receipt of payment.</p>
        </div>
        
        <p>After making the payment, please submit your payment confirmation:</p>
        <a href="https://ptgr.io/payment-document?id=${registrationId}" class="cta-button">Submit Payment Confirmation</a>
        
        <p>For immediate questions, please contact our support team:</p>
        <a href="mailto:support@ptgr.io" class="cta-button">Contact Support</a>
        
        <div class="social-links">
          <p>Follow us for updates:</p>
          <a href="https://web.facebook.com/people/PTGR-AG/100088835256574/">Facebook</a>
          <a href="https://twitter.com/ptgr">Twitter</a>
          <a href="https://t.me/ptgr">Telegram</a>
        </div>
        
        <div class="disclaimer">
          <p><strong>Important:</strong> This email confirms receipt of your interest in purchasing $PTGR tokens. 
          Token allocation is subject to availability and compliance verification. 
          Our team will contact you to complete the purchase process.</p>
        </div>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} PTGR AG. All rights reserved.</p>
        <p>PTGR AG, Zug, Switzerland</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `Thank You for Your $PTGR Token Purchase Request\n\n
Dear ${firstName},\n\n
We have received your request to purchase ${currencySymbol}${formattedAmount} worth of $PTGR tokens.\n\n
Our investment team will review your request and contact you.\n\n
YOUR REQUEST DETAILS:
- Amount: ${currencySymbol}${formattedAmount}
- Contact: ${email}
- Registration ID: ${registrationId}
- Payment Method: Bank Transfer\n\n
BANK TRANSFER INSTRUCTIONS:
Bank: PostFinance
Account holder: PTGR AG
BIC: POFICHBEXXX
IBAN: CH34 0900 0000 1556 0906 8

Please transfer ${currencySymbol}${formattedAmount} to the above account and include your Registration ID in the payment reference.\n\n
After making the payment, please submit your payment confirmation at:
https://ptgr.io/payment-document?id=${registrationId}\n\n
NEXT STEPS:
1. Our team will review your request and contact you to confirm your order
2. Please transfer the amount due to the bank account provided
3. You will be notified immediately after receipt of payment\n\n
For immediate questions: support@ptgr.io\n\n
Follow us:
Twitter: https://twitter.com/ptgr
Telegram: https://t.me/ptgr\n\n
Important: This confirms receipt of your interest. Token allocation subject to availability and compliance.\n\n
© ${new Date().getFullYear()} PTGR AG, Zug, Switzerland`;

  const pdfBuffer = await generateInvoicePDF(email, firstName, amount, currency, token, phone, registrationId);
  const mailOptions = {
    from: getFromAddress('PTGR Token'),
    to: email,
    subject: `Your $PTGR Token Purchase Request (${currencySymbol}${formattedAmount})`,
    html: htmlContent,
    text: textContent,
    attachments: [
      {
        filename: `PTGR_Invoice_${new Date().toISOString().slice(0, 10)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    const transporter = getTransporter();
    // Send customer confirmation
    console.log('📧 Sending confirmation email to customer...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Customer email sent');
  
    // OPTIONAL: wait 500ms between sends
    await new Promise((res) => setTimeout(res, 500));
  
    // Prepare staff notification
    const staffNotificationOptions = {
      from: getFromAddress('PTGR Token System'),
      to: ['david.schmiedel@ptgr.ch', 'accounting@ptgr.ch'],
      subject: `New $PTGR Token Purchase Request from ${firstName} (${currencySymbol}${formattedAmount})`,
      text: `A new token interest was submitted:\n\nName: ${firstName}\nEmail: ${email}\nPhone: ${phone}\nAmount: ${currencySymbol}${formattedAmount}\nToken: ${token}\nPayment Method: Bank Transfer\nRegistration ID: ${registrationId}`,
      html: `
        <p><strong>New $PTGR Token Purchase Request</strong></p>
        <ul>
          <li><strong>Name:</strong> ${firstName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Amount:</strong> ${currencySymbol}${formattedAmount}</li>
          <li><strong>Token:</strong> ${token}</li>
          <li><strong>Payment Method:</strong> Bank Transfer</li>
          <li><strong>Registration ID:</strong> ${registrationId}</li>
        </ul>
        <p>Please follow up with the customer if needed.</p>
      `
    };
  
    console.log('📧 Sending staff notification email...');
    await transporter.sendMail(staffNotificationOptions);
    console.log('✅ Staff notification sent');
  
    return true;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error('Failed to send one or more emails');
  }
};
const sendTalentRequestEmail = async ({
  firstName,
  email,
  companyName,
  talentType,
  teamSize,
  budgetRange,
  talentTimeline,
  talentRequirements
}) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SWAFRI: Talent Request Confirmation</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
    <!-- Header with SWAFRI Theme -->
    <div style="background-color: #1c2834; padding: 30px 20px; text-align: center; border-bottom: 4px solid #43da80;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">
        <svg style="width: 24px; height: 24px; vertical-align: middle; margin-right: 8px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M12 3L2 21h20L12 3zm0 4.5L18.5 19h-13L12 7.5z"/>
        </svg>
        SWAFRI
      </h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 14px;">Innovative Talent Solutions</p>
    </div>
    
    <!-- Main Content -->
    <div style="padding: 30px;">
      <p style="color: #1c2834; font-size: 18px; margin-bottom: 20px;">Dear ${firstName},</p>
      <p style="margin: 0 0 15px 0;">Thank you for choosing SWAFRI to fulfill your talent needs. Here's a summary of your request:</p>
      
      <!-- Request Details -->
      <div style="background-color: #f5f9f7; border-left: 4px solid #43da80; padding: 20px; margin: 25px 0; border-radius: 0 4px 4px 0;">
        <p style="margin: 8px 0; color: #333;"><strong style="color: #43da80; font-weight: 600;">Company:</strong> ${companyName}</p>
        <p style="margin: 8px 0; color: #333;"><strong style="color: #43da80; font-weight: 600;">Talent Needed:</strong> ${talentType} (Team size: ${teamSize})</p>
        <p style="margin: 8px 0; color: #333;"><strong style="color: #43da80; font-weight: 600;">Budget:</strong> ${budgetRange}</p>
        <p style="margin: 8px 0; color: #333;"><strong style="color: #43da80; font-weight: 600;">Timeline:</strong> ${talentTimeline}</p>
        <p style="margin: 8px 0; color: #333;"><strong style="color: #43da80; font-weight: 600;">Requirements:</strong> ${talentRequirements}</p>
      </div>
      
      <!-- Next Steps -->
      <div style="margin: 25px 0;">
        <p style="color: #1c2834; font-weight: 600; margin: 0 0 10px 0;">Next Steps:</p>
        <ol style="padding-left: 20px; color: #1c2834;">
          <li style="margin-bottom: 10px;">We'll review your request within <strong style="color: #43da80;">24 hours</strong>.</li>
          <li style="margin-bottom: 10px;">You'll receive candidate profiles matching your exact needs.</li>
          <li style="margin-bottom: 10px;">We'll schedule a call to align on next steps.</li>
        </ol>
      </div>
      
   
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; background-color: #1c2834; font-size: 12px; color: #ffffff; border-top: 1px solid #eaeaea;">
      <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} SWAFRI. All rights reserved.</p>
      <p style="margin: 0 0 10px 0;"><a href="https://swafri.com" style="color: #43da80; text-decoration: none; font-weight: 600;">www.swafri.com</a> | <a href="mailto:contact@swafri.com" style="color: #43da80; text-decoration: none; font-weight: 600;">contact@swafri.com</a></p>
      <p style="margin-top: 10px; font-style: italic; color: #43da80; margin: 10px 0 0 0;">Innovation. Quality. Excellence.</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `Dear Jemaneh,\n\n
Thank you for your talent request to SWAFRI. Here's what we received:\n\n
COMPANY: ${companyName}\n
TALENT NEEDED: ${talentType} (Team size: ${teamSize})\n
BUDGET: ${budgetRange}\n
TIMELINE: ${talentTimeline}\n
REQUIREMENTS: ${talentRequirements}\n\n
Next Steps:\n
1. We'll review your request within 24 hours.\n
2. Share candidate profiles matching your needs.\n
3. Schedule a call to finalize your team.\n\n
Track your request: https://swafri.com/dashboard\n
Questions? Reply to this email or call +1 234 567 8900.\n\n
— SWAFRI Team\n
Innovative Talent Solutions\n
www.swafri.com`;

  const mailOptions = {
    from: getFromAddress('PTGR Talent Pool'),
    to: `${email}`,
    subject: `Thank You for Your Interest`,
    html: htmlContent,
    text: textContent
  };

  try {
    const transporter = getTransporter();
    console.log('Sending email to Jemaneh with options:', { 
      to: mailOptions.to, 
      subject: mailOptions.subject 
    });
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Talent request email sending error:', error);
    throw new Error('Failed to send talent request email');
  }
};
async function sendEmail({ fromName, fromEmail, to, subject, html }) {
  const transport = getTransporter();
  const fromHeader = `"${fromName}" <${fromEmail}>`;
  return transport.sendMail({
    from: fromHeader,
    to,
    subject,
    html,
    headers: {
      // Helps with deliverability/unsubscribe UX
      'List-Unsubscribe': `<${process.env.BASE_URL}/newsletter/unsubscribe?token=>, <mailto:${fromEmail}?subject=unsubscribe>`
    }
  });
}
module.exports = {
  generateConfirmationNumber,
  sendConfirmationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendPurchaseConfirmationEmail,
  sendWelcomeEmail,
  sendTokenInterestEmail,
  sendTalentRequestEmail,
  sendEmail,
};