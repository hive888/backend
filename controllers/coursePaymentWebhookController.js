// controllers/coursePaymentWebhookController.js
const { CoursePaymentService, stripe } = require('../config/coursePaymentService');
const PaymentTracking = require('../models/paymentTrackingModel');
const AccessCode = require('../models/accessCodeModel');
const SelfStudyRegistration = require('../models/selfStudyRegistrationModel');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * POST /api/course-payments/webhook/stripe
 * Stripe webhook handler for course access payment events
 * MODIFIED: Works with your existing webhook route (no signature verification)
 */
exports.handleStripeWebhook = async (req, res) => {
  try {
    const webhookData = req.webhookData;
    const session = webhookData.sessionData;
    const metadata = session.metadata || {};
    
    console.log('📚 Course payment webhook received:', {
      sessionId: webhookData.sessionId,
      eventType: webhookData.eventType,
      customerId: metadata.customer_id
    });
    
    // CRITICAL: Return 200 immediately to acknowledge receipt
    res.json({ received: true, eventType: webhookData.eventType });
    
    // Process asynchronously after responding
    if (webhookData.eventType === 'checkout.session.completed') {
      if (metadata && metadata.payment_type === 'course_access') {
        console.log('Processing course access payment completion', {
          sessionId: session.id,
          customerId: metadata.customer_id,
          accessCode: metadata.access_code
        });
        
        // Process payment and create registration
        await processCourseAccessPayment(session);
      }
    }
    
  } catch (err) {
    console.error('Course payment webhook error:', err.message);
    // Don't return error - we already sent 200
  }
};

/**
 * Process course access payment and create registration
 */
async function processCourseAccessPayment(session) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    const metadata = session.metadata;
    const customerId = parseInt(metadata.customer_id);
    const accessCodeId = parseInt(metadata.access_code_id);
    
    console.log('Processing course access payment', { customerId, accessCodeId });
    
    // Find payment record by Stripe session ID first (most reliable)
    let payment = await PaymentTracking.getByStripeSessionId(session.id);
    
    // Fallback to customer + access code lookup
    if (!payment) {
      payment = await PaymentTracking.getByCustomerAndAccessCode(customerId, accessCodeId);
    }
    
    if (!payment) {
      console.error('Payment record not found for session', session.id, 'customer', customerId, 'access code', accessCodeId);
      throw new Error(`Payment record not found`);
    }
    
    // CRITICAL: Check if already processed to prevent duplicate processing
    if (payment.payment_status === 'completed' && payment.registration_id) {
      console.log('Payment already processed and registration exists', {
        paymentId: payment.id,
        registrationId: payment.registration_id
      });
      await conn.commit();
      return;
    }
    
    // Update payment status to completed
    const updateResult = await PaymentTracking.updateStatus(
      conn,
      payment.id,
      'completed',
      session.id,
      new Date(),
      {
        stripe_payment_intent: session.payment_intent,
        stripe_customer: session.customer,
        amount_paid: session.amount_total ? session.amount_total / 100 : null,
        currency: session.currency,
        payment_method: session.payment_method_types?.[0] || 'card',
        stripe_status: session.payment_status,
        stripe_session_status: session.status,
        webhook_processed_at: new Date().toISOString()
      }
    );
    
    if (updateResult === 0) {
      throw new Error('Failed to update payment status in database');
    }
    
    console.log('Payment status updated to completed', { paymentId: payment.id });
    
    // Check if registration already exists
    const existingReg = await SelfStudyRegistration.findByCustomer(conn, customerId);
    
    if (!existingReg) {
      // Fetch access code details
      const accessCode = await AccessCode.getById(accessCodeId);
      if (!accessCode) {
        throw new Error(`Access code ${accessCodeId} not found`);
      }
      
      // Check access code validity
      if (accessCode.is_active !== 1) {
        throw new Error(`Access code ${accessCode.code} is not active`);
      }
      
      if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
        throw new Error(`Access code ${accessCode.code} has expired`);
      }
      
      // Check max uses
      if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
        throw new Error(`Access code ${accessCode.code} has reached maximum uses`);
      }
      
      // Create registration
      const registrationId = await SelfStudyRegistration.create(conn, {
        customer_id: customerId,
        access_code_id: accessCodeId
      });
      
      // Update payment with registration ID
      await PaymentTracking.updateRegistrationId(conn, payment.id, registrationId);
      
      // Increment access code usage
      await AccessCode.incrementUsage(conn, accessCodeId);
      
      console.log(`Registration created successfully`, {
        registrationId,
        customerId,
        accessCode: accessCode.code,
        paymentId: payment.id
      });
    } else {
      // Update payment with existing registration ID
      await PaymentTracking.updateRegistrationId(conn, payment.id, existingReg.id);
      
      console.log(`Customer already registered`, {
        customerId,
        registrationId: existingReg.id,
        paymentId: payment.id
      });
    }
    
    await conn.commit();
    console.log('Course access payment processing completed successfully', {
      customerId,
      paymentId: payment.id
    });
    
  } catch (err) {
    await conn.rollback();
    console.error('processCourseAccessPayment error:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * GET /api/course-payments/verify/:payment_id
 * Verify payment status (for frontend polling)
 */
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.payment_id);
    
    if (!paymentId || isNaN(paymentId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PAYMENT_ID',
        message: 'Valid payment ID is required'
      });
    }

    const payment = await PaymentTracking.getById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment record not found'
      });
    }
    
    // Check Stripe status if we have a transaction ID
    let stripeStatus = null;
    if (payment.transaction_id && (payment.transaction_id.startsWith('cs_') || payment.transaction_id.startsWith('pi_'))) {
      try {
        const session = await stripe.checkout.sessions.retrieve(payment.transaction_id);
        stripeStatus = {
          payment_status: session.payment_status,
          status: session.status,
          amount_paid: session.amount_total ? session.amount_total / 100 : payment.amount,
          currency: session.currency || payment.currency,
          customer_email: session.customer_details?.email
        };
      } catch (stripeErr) {
        console.warn('Could not retrieve Stripe session:', {
          transactionId: payment.transaction_id,
          error: stripeErr.message
        });
        stripeStatus = { error: 'Could not retrieve Stripe status' };
      }
    }
    
    // Check if registration exists
    let registrationStatus = null;
    if (payment.registration_id) {
      const conn = await db.getConnection();
      try {
        const registration = await SelfStudyRegistration.findById(conn, payment.registration_id);
        if (registration) {
          registrationStatus = {
            registered: true,
            registration_id: registration.id,
            status: registration.status,
            registered_at: registration.registered_at
          };
        }
      } catch (err) {
        console.warn('Could not retrieve registration:', err.message);
      } finally {
        conn.release();
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment.id,
          status: payment.payment_status,
          amount: payment.amount,
          currency: payment.currency,
          payment_method: payment.payment_method,
          transaction_id: payment.transaction_id,
          payment_date: payment.payment_date,
          created_at: payment.created_at
        },
        stripe: stripeStatus,
        registration: registrationStatus || { registered: false },
        customer: {
          customer_id: payment.customer_id,
          first_name: payment.first_name,
          last_name: payment.last_name,
          email: payment.email
        },
        access_code: {
          code: payment.access_code,
          university_name: payment.university_name
        }
      }
    });
    
  } catch (err) {
    console.error('verifyPaymentStatus error:', {
      error: err.message,
      paymentId: req.params.payment_id
    });
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
};

/**
 * POST /api/course-payments/check-registration
 * Check if customer has completed payment and registration
 */
exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { customer_id, access_code_id } = req.body;
    
    if (!customer_id || !access_code_id) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PARAMETERS',
        message: 'customer_id and access_code_id are required'
      });
    }

    const conn = await db.getConnection();
    let registration = null;
    
    try {
      // Check for completed payment
      const payment = await PaymentTracking.hasCompletedPayment(customer_id, access_code_id);
      
      if (payment) {
        // Check for registration
        registration = await SelfStudyRegistration.findByCustomer(conn, customer_id);
      }
      
      return res.status(200).json({
        success: true,
        data: {
          has_payment: !!payment,
          payment_status: payment?.payment_status,
          payment_date: payment?.payment_date,
          has_registration: !!registration,
          registration_id: registration?.id,
          registration_status: registration?.status
        }
      });
      
    } finally {
      conn.release();
    }
    
  } catch (err) {
    console.error('checkRegistrationStatus error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
};