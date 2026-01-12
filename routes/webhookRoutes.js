// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');

// ADD THIS LINE
const coursePaymentController = require('../controllers/coursePaymentWebhookController');

router.post('/stripe-webhook', (req, res, next) => {
  console.log('✅ Extracting payment information from webhook...');
  
  const event = req.body;
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
    rawBody: JSON.stringify(req.body), // For Stripe verification
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