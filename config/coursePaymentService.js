// config/coursePaymentService.js
const Stripe = require('stripe');
const db = require('../config/database');
const PaymentTracking = require('../models/paymentTrackingModel');
const logger = require('../utils/logger');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST, {
  apiVersion: '2024-06-20',
});

class CoursePaymentService {
  static async createCourseAccessCheckoutSession(
    amount,
    currency,
    paymentReference,
    customerInfo,
    accessCodeInfo,
    successUrl, // not used - using env variables instead
    cancelUrl   // not used - using env variables instead
  ) {
    try {
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount: ' + amount);
      }
      
      if (!paymentReference) {
        throw new Error('Payment reference is required');
      }
      
      if (!customerInfo || !customerInfo.customer_id) {
        throw new Error('Customer information is required');
      }
      
      if (!accessCodeInfo || !accessCodeInfo.access_code) {
        throw new Error('Access code information is required');
      }
      
      currency = currency || 'USD';
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: "Course Access Payment",
                description: `Payment for course access using code: ${accessCodeInfo.access_code}`,
                metadata: {
                  university: accessCodeInfo.university_name || 'Unknown University',
                  customer_email: customerInfo.email || '',
                  customer_name: `${customerInfo.first_name || ''} ${customerInfo.last_name || ''}`.trim()
                }
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        // USING YOUR ENVIRONMENT VARIABLES
        success_url: `${process.env.FRONTENDHIVE_URL}${process.env.SUCCESS_CALLBACK_URL}`,
        cancel_url: `${process.env.FRONTENDHIVE_URL}${process.env.CANCEL_CALLBACK_URL}`,
        metadata: {
          payment_reference: paymentReference,
          amount: amount.toString(),
          currency: currency,
          customer_id: customerInfo.customer_id.toString(),
          access_code_id: accessCodeInfo.access_code_id.toString(),
          access_code: accessCodeInfo.access_code,
          university_name: accessCodeInfo.university_name || '',
          payment_type: 'course_access'
        },
        client_reference_id: paymentReference,
        customer_email: customerInfo.email || undefined,
      });

      logger.info('Stripe checkout session created:', {
        sessionId: session.id,
        paymentReference,
        amount,
        customerId: customerInfo.customer_id
      });

      return {
        url: session.url,
        sessionId: session.id,
        paymentReference: paymentReference
      };
      
    } catch (err) {
      logger.error('CoursePaymentService.createCourseAccessCheckoutSession error:', err);
      throw new Error(`Payment session creation failed: ${err.message}`);
    }
  }

  // Rest of your code remains exactly the same...
  static async verifyAndUpdatePayment(sessionId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
      
      if (!session) {
        throw new Error('Stripe session not found');
      }
      
      const metadata = session.metadata;
      if (!metadata || !metadata.payment_reference) {
        throw new Error('Invalid session metadata');
      }
      
      const paymentReference = metadata.payment_reference;
      const customerId = parseInt(metadata.customer_id);
      const accessCodeId = parseInt(metadata.access_code_id);
      const amount = parseFloat(metadata.amount);
      
      const payment = await PaymentTracking.getByCustomerAndAccessCode(customerId, accessCodeId);
      if (!payment) {
        throw new Error(`Payment record not found for customer ${customerId} and access code ${accessCodeId}`);
      }
      
      let newStatus = 'pending';
      let transactionId = session.id;
      let paymentDate = null;
      
      switch (session.payment_status) {
        case 'paid':
          newStatus = 'completed';
          paymentDate = new Date();
          break;
        case 'unpaid':
          newStatus = 'pending';
          break;
        case 'no_payment_required':
          newStatus = 'completed';
          paymentDate = new Date();
          break;
        default:
          newStatus = 'pending';
      }
      
      const updatedRows = await PaymentTracking.updateStatus(
        conn,
        payment.id,
        newStatus,
        transactionId,
        paymentDate,
        {
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent?.id,
          stripe_customer: session.customer,
          amount_paid: session.amount_total ? session.amount_total / 100 : amount,
          currency: session.currency,
          payment_method: session.payment_method_types?.[0] || 'card',
          stripe_status: session.payment_status,
          stripe_session_status: session.status
        }
      );
      
      if (updatedRows === 0) {
        throw new Error('Failed to update payment status');
      }
      
      await conn.commit();
      
      logger.info('Payment status updated:', {
        paymentId: payment.id,
        newStatus,
        sessionId,
        paymentReference
      });
      
      return {
        paymentId: payment.id,
        status: newStatus,
        sessionId: session.id,
        paymentReference,
        amount,
        customerId,
        accessCodeId
      };
      
    } catch (err) {
      await conn.rollback();
      logger.error('CoursePaymentService.verifyAndUpdatePayment error:', err);
      throw err;
    } finally {
      conn.release();
    }
  }

  static async getCheckoutSession(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (err) {
      logger.error('CoursePaymentService.getCheckoutSession error:', err);
      throw new Error(`Failed to retrieve session: ${err.message}`);
    }
  }

  static async createPaymentIntent(amount, currency, customerEmail, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: metadata,
        receipt_email: customerEmail || undefined,
      });
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      };
    } catch (err) {
      logger.error('CoursePaymentService.createPaymentIntent error:', err);
      throw new Error(`Payment intent creation failed: ${err.message}`);
    }
  }

  static async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          await this.verifyAndUpdatePayment(session.id);
          break;
          
        case 'checkout.session.expired':
          const expiredSession = event.data.object;
          logger.info('Payment session expired:', expiredSession.id);
          break;
          
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          logger.info('Payment succeeded:', paymentIntent.id);
          break;
          
        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object;
          logger.warn('Payment failed:', failedPaymentIntent.id);
          break;
          
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }
      
      return { success: true };
    } catch (err) {
      logger.error('CoursePaymentService.handleWebhookEvent error:', err);
      throw err;
    }
  }
}

module.exports = { CoursePaymentService, stripe };