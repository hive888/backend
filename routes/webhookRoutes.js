// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const logger = require('../utils/logger');

// Stripe signature verification (recommended for production)
const { stripe } = require('../config/coursePaymentService');

// ADD THIS LINE
const coursePaymentController = require('../controllers/coursePaymentWebhookController');

router.post('/stripe-webhook', (req, res, next) => {
  console.log('✅ Extracting payment information from webhook...');
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || process.env.STRIPE_WEBHOOK_SECRET;
  let event = req.body;

  // Verify Stripe signature if secret is configured.
  // If you haven't configured it yet, we fall back to the previous behavior (NOT recommended for prod).
  if (webhookSecret) {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ success: false, error: 'Missing Stripe-Signature header', code: 'MISSING_STRIPE_SIGNATURE' });
      }
      if (!req.rawBody) {
        return res.status(400).json({ success: false, error: 'Missing raw body for webhook verification', code: 'MISSING_RAW_BODY' });
      }
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err);
      return res.status(400).json({ success: false, error: 'Webhook signature verification failed', code: 'INVALID_WEBHOOK_SIGNATURE' });
    }
  } else {
    logger.warn('STRIPE_WEBHOOK_SECRET is not set; accepting Stripe webhooks without signature verification (NOT recommended).');
  }

  const session = event.data.object;
  
  // Extract all the information
  const orderId = session.metadata?.orderId || session.client_reference_id;
  const paymentStatus = session.payment_status;
  const amount = `$${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}`;
  const customerName = session.customer_details?.name || 'Unknown';
  const customerEmail = session.customer_details?.email || 'Unknown';
  const eventType = event.type;
  const sessionId = session.id;
  
  // Store all extracted data for the controller
  req.webhookData = {
    orderId,
    paymentStatus, 
    amount,
    customerName,
    customerEmail,
    eventType,
    sessionId,
    rawBody: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body),
    sessionData: session // Full session object
  };
  
  // ADD THIS CHECK - if course payment, use different controller
  if (session.metadata?.payment_type === 'course_access') {
    console.log('📚 Course payment detected - using course controller');
    return coursePaymentController.handleStripeWebhook(req, res);
  }
  
  // Otherwise use the existing reservation controller
  next();
  
}, reservationController.handleStripeWebhook);

module.exports = router;