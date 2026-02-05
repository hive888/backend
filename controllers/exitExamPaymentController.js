// controllers/exitExamPaymentController.js
const ExitExamPayment = require('../models/ExitExamPayment');
const AccessCode = require('../models/accessCodeModel');
const SelfStudyRegistration = require('../models/selfStudyRegistrationModel');
const Customer = require('../models/Customer');
const { CoursePaymentService } = require('../config/coursePaymentService');
const db = require('../config/database');
const logger = require('../utils/logger');

const exitExamPaymentController = {
  /**
   * Create exit exam payment checkout session
   * POST /api/course-access/exit-exam/payment
   */
  async createExitExamPayment(req, res) {
    const conn = await db.getConnection();
    try {
      const customerId = req.user?.customer_id;
      
      if (!customerId) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found'
        });
      }

      // Get registration to find access code
      const registration = await SelfStudyRegistration.findByCustomer(conn, customerId);
      if (!registration || registration.status !== 'active') {
        return res.status(403).json({
          success: false,
          code: 'NOT_SUBSCRIBED',
          message: 'You are not subscribed to the self-study course'
        });
      }

      if (!registration.access_code_id) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACCESS_CODE',
          message: 'No access code associated with your registration'
        });
      }

      // Get access code details
      const accessCode = await AccessCode.getById(registration.access_code_id);
      if (!accessCode) {
        return res.status(404).json({
          success: false,
          code: 'ACCESS_CODE_NOT_FOUND',
          message: 'Access code not found'
        });
      }

      const exitExamFee = parseFloat(accessCode.exit_exam_fee || 0);
      
      if (exitExamFee <= 0) {
        return res.status(400).json({
          success: false,
          code: 'NO_FEE_REQUIRED',
          message: 'Exit exam is free for this access code'
        });
      }

      // Check if payment already completed
      const existingPayment = await ExitExamPayment.hasCompletedPayment(customerId, registration.access_code_id);
      if (existingPayment) {
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_ALREADY_COMPLETED',
          message: 'Exit exam payment already completed'
        });
      }

      // Check for pending payment
      const pendingPayment = await ExitExamPayment.findByCustomerAndAccessCode(customerId, registration.access_code_id);
      if (pendingPayment && pendingPayment.payment_status === 'pending') {
        // Return existing session if available
        if (pendingPayment.transaction_id) {
          return res.status(200).json({
            success: true,
            message: 'Payment session already exists',
            data: {
              session_id: pendingPayment.transaction_id,
              amount: pendingPayment.amount,
              currency: pendingPayment.currency
            }
          });
        }
      }

      // Create payment record
      const paymentId = await ExitExamPayment.create(conn, {
        customer_id: customerId,
        access_code_id: registration.access_code_id,
        registration_id: registration.id,
        amount: exitExamFee,
        currency: accessCode.payment_currency || 'USD',
        payment_status: 'pending'
      });

      // Create Stripe checkout session
      const paymentReference = `EXIT_EXAM_${paymentId}_${Date.now()}`;
      const customerInfo = {
        customer_id: customer.customer_id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name
      };

      const accessCodeInfo = {
        access_code_id: accessCode.id,
        code: accessCode.code,
        access_code: accessCode.code,
        exit_exam_fee: exitExamFee,
        payment_type: 'exit_exam'
      };

      // Default success URL: redirect to final quiz after payment
      const defaultSuccessUrl = 'https://hub.hive888.org/education/self-study/259/quiz/play/mcq';
      const successUrl = req.body.success_url || defaultSuccessUrl;
      const cancelUrl = req.body.cancel_url || `${process.env.FRONTENDHIVE_URL || process.env.FRONTEND_URL}${process.env.CANCEL_CALLBACK_URL || '/payment/cancel'}`;

      const session = await CoursePaymentService.createCourseAccessCheckoutSession(
        exitExamFee,
        accessCode.payment_currency || 'USD',
        paymentReference,
        customerInfo,
        accessCodeInfo,
        successUrl,
        cancelUrl
      );

      // Update payment record with session ID
      await ExitExamPayment.updateStatus(
        conn,
        paymentId,
        'processing',
        session.id,
        null,
        { stripe_session_id: session.id, payment_reference: paymentReference }
      );

      // Also create payment tracking record for webhook processing
      const PaymentTracking = require('../models/paymentTrackingModel');
      await PaymentTracking.create(conn, {
        customer_id: customerId,
        access_code_id: registration.access_code_id,
        amount: exitExamFee,
        currency: accessCode.payment_currency || 'USD',
        payment_type: 'exit_exam',
        payment_status: 'pending',
        transaction_id: session.id,
        payment_reference: paymentReference,
        payment_details: {
          exit_exam_payment_id: paymentId,
          registration_id: registration.id
        }
      });

      // Update Stripe session metadata to include payment_type
      // Note: This requires updating the session after creation
      // For now, we'll handle it in the webhook by checking payment tracking

      logger.info('Exit exam payment session created', {
        customerId,
        paymentId,
        sessionId: session.id,
        amount: exitExamFee,
        currency: accessCode.payment_currency || 'USD'
      });

      return res.status(200).json({
        success: true,
        message: 'Payment session created',
        data: {
          session_id: session.id,
          checkout_url: session.url,
          amount: exitExamFee,
          currency: accessCode.payment_currency || 'USD',
          payment_id: paymentId
        }
      });
    } catch (error) {
      logger.error('Exit exam payment creation error:', error);
      return res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: 'Failed to create payment session'
      });
    } finally {
      conn.release();
    }
  },

  /**
   * Get exit exam payment status
   * GET /api/course-access/exit-exam/payment/status
   */
  async getExitExamPaymentStatus(req, res) {
    try {
      const customerId = req.user?.customer_id;
      
      if (!customerId) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      const registration = await SelfStudyRegistration.findByCustomer(await db.getConnection(), customerId);
      if (!registration || !registration.access_code_id) {
        return res.status(200).json({
          success: true,
          data: {
            payment_required: false,
            payment_status: null
          }
        });
      }

      const accessCode = await AccessCode.getById(registration.access_code_id);
      const exitExamFee = parseFloat(accessCode?.exit_exam_fee || 0);

      if (exitExamFee <= 0) {
        return res.status(200).json({
          success: true,
          data: {
            payment_required: false,
            payment_status: 'free'
          }
        });
      }

      const payment = await ExitExamPayment.findByCustomerAndAccessCode(customerId, registration.access_code_id);
      
      return res.status(200).json({
        success: true,
        data: {
          payment_required: true,
          exit_exam_fee: exitExamFee,
          currency: accessCode.payment_currency || 'USD',
          payment_status: payment?.payment_status || 'not_started',
          payment_id: payment?.id || null,
          transaction_id: payment?.transaction_id || null
        }
      });
    } catch (error) {
      logger.error('Get exit exam payment status error:', error);
      return res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: 'Failed to get payment status'
      });
    }
  }
};

module.exports = exitExamPaymentController;

