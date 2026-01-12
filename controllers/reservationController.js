// controllers/reservationController.js
const Reservation = require('../models/reservationModel');
const { v4: uuidv4 } = require('uuid');
const Customer = require('../models/Customer'); 
const { sendTokenInterestEmail } = require('../utils/email');
const db = require('../config/database');
const logger = require('../utils/logger');
const { uploadToS3 } = require('../config/s3Config');
const PaymentScreenshot = require('../models/PaymentScreenshot');
const { PaymentService, stripe } = require('../config/stripe'); // Import stripe here

class ReservationController {
  constructor() {
    // Bind all methods to maintain 'this' context
    this.registerCustomer = this.registerCustomer.bind(this);
    this.convertToUSD = this.convertToUSD.bind(this);
    this.getKycStatus = this.getKycStatus.bind(this);
    this.handleStripeWebhook = this.handleStripeWebhook.bind(this);
    this.checkPaymentStatus = this.checkPaymentStatus.bind(this);
    this.handlePaymentSuccess = this.handlePaymentSuccess.bind(this);
    this.handlePaymentExpired = this.handlePaymentExpired.bind(this);
    this.handlePaymentFailed = this.handlePaymentFailed.bind(this);
  }

  async verifyOwnershipOrAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      // If user is admin or developer, skip ownership check
      if (['admin', 'developer'].includes(requestingUser.role_name)) {
        return next();
      }

      // Get the reservation to check ownership
      const reservation = await Reservation.findById(id);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          errors: [{
            field: 'id',
            message: 'reservation not found'
          }]
        });
      }

      // Verify the email matches the authenticated user's email
      if (reservation.email !== requestingUser.email) {
        return res.status(403).json({
          success: false,
          errors: [{
            field: 'authorization',
            message: 'you can only manage your own reservations'
          }]
        });
      }

      next();
    } catch (err) {
      logger.error('Reservation ownership verification error:', err);
      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to verify ownership'
        }]
      });
    }
  }

  async createReservation(req, res) {
    try {
      const { product_id, first_name, last_name, email, company_name, number_of_people, notes, scheduled_date } = req.body;
      const requestingUser = req.user;

      // Create the reservation
      const reservationId = await Reservation.create({
        product_id,
        first_name,
        last_name,
        email,
        company_name,
        number_of_people,
        notes,
        scheduled_date: new Date(scheduled_date)
      });
      return res.status(201).json({
        success: true,
        data: reservationId
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Reservation already exists for this email and product.'
        });
      }
    }
  }

  async getAllReservations(req, res) {
    try {
      const { page = 1, limit = 10, email, product_id } = req.query;
      const requestingUser = req.user;

      let filters = {};
      if (!['admin', 'developer'].includes(requestingUser.role_name)) {
        filters.email = requestingUser.email;
      } else {
        if (email) filters.email = email;
        if (product_id) filters.product_id = product_id;
      }

      const { reservations, total } = await Reservation.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        filters
      });

      return res.json({
        success: true,
        data: reservations,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get reservations:', {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to get reservations'
        }]
      });
    }
  }

  async getReservationsSummary(req, res) {
    try {
      console.log('Entering getReservationsSummary');
      
      const requestingUser = req.user;
      let filters = { status: 'requested' };
  
      if (!['admin', 'developer'].includes(requestingUser.role_name)) {
        filters.email = requestingUser.email;
      }
  
      console.log('Filters:', filters);

      const summary = await Reservation.getReservationsSummary({ filters });
      
      console.log('Summary data:', summary);

      return res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      console.error('Full error:', err);
      logger.error('Failed to get reservations summary:', {
        error: err.message,
        stack: err.stack
      });
  
      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'Failed to get reservations summary: ' + err.message
        }]
      });
    }
  }

  async getReservationById(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      const reservation = await Reservation.findById(id);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          errors: [{
            field: 'id',
            message: 'reservation not found'
          }]
        });
      }

      if (!['admin', 'developer'].includes(requestingUser.role_name)) {
        if (reservation.email !== requestingUser.email) {
          return res.status(403).json({
            success: false,
            errors: [{
              field: 'authorization',
              message: 'you can only view your own reservations'
            }]
          });
        }
      }

      return res.json({
        success: true,
        data: reservation
      });
    } catch (err) {
      logger.error('Failed to get reservation:', {
        error: err.message,
        reservationId: req.params.id,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to get reservation'
        }]
      });
    }
  }

  async updateReservation(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const existingReservation = await Reservation.findById(id);
      if (!existingReservation) {
        return res.status(404).json({
          success: false,
          errors: [{
            field: 'id',
            message: 'reservation not found'
          }]
        });
      }

      const updateData = {};
      
      if (status) {
        updateData.status = status;
      }
      
      if (notes) {
        updateData.notes = notes;
      }

      if (Object.keys(updateData).length > 0) {
        await Reservation.update(id, updateData);
      } else {
        return res.status(400).json({
          success: false,
          errors: [{
            field: 'request',
            message: 'no valid fields provided for update'
          }]
        });
      }

      const updatedReservation = await Reservation.findById(id);

      logger.audit('Reservation updated', {
        reservationId: id,
        changedFields: Object.keys(updateData)
      });

      return res.json({
        success: true,
        data: updatedReservation
      });
    } catch (err) {
      logger.error('Reservation update failed:', {
        error: err.message,
        reservationId: req.params.id,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        let field = 'unknown';
        if (err.message.includes('product_id')) {
          field = 'product_id';
        }
        
        return res.status(400).json({
          success: false,
          errors: [{
            field,
            message: 'referenced record not found'
          }]
        });
      }

      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to update reservation'
        }]
      });
    }
  }

  async deleteReservation(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      const reservation = await Reservation.findById(id);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          errors: [{
            field: 'id',
            message: 'reservation not found'
          }]
        });
      }

      await Reservation.delete(id);

      logger.audit('Reservation deleted', {
        reservationId: id
      });

      return res.json({
        success: true,
        message: 'reservation deleted successfully'
      });
    } catch (err) {
      logger.error('Reservation deletion failed:', {
        error: err.message,
        reservationId: req.params.id,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to delete reservation'
        }]
      });
    }
  }


async registerCustomer(req, res) {
  try {
    const { 
      currency, 
      token,
      successUrl,
      cancelUrl,
      paymentMethodID
    } = req.body;
    
     const customer_id = req.user.customer_id;
 //const customer_id = "100999";

    if (!token || isNaN(parseFloat(token))) {
      return res.status(400).json({
        success: false,
        errors: [{
          field: "token",
          message: "Valid token amount is required"
        }]
      });
    }

    const supportedCurrencies = ['USD', 'CHF', 'USDT'];
    
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        errors: [{
          field: "currency",
          message: `Unsupported currency. Supported currencies: ${supportedCurrencies.join(', ')}`
        }]
      });
    }
    
    const usdAmount = this.convertToUSD(token, currency);

    const customer = await Customer.findById(customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        errors: [{ message: "Customer not found" }]
      });
    }
    
    // FIXED: Enforce KYC for amounts >= 1000
    if (usdAmount >= 1000) {
      const kycStatus = await this.getKycStatus(customer_id);
      
      if (kycStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          errors: [{
            message: "KYC verification required for purchases of $1000 or more",
            kycRequired: true,
            currentStatus: kycStatus
          }]
        });
      }
    }

    const reservation_reference_id = uuidv4();
    
    let paymentUrl;
    
    const registrationId = await Reservation.register({
      customer_id,
      currency,
      token,
      amount: usdAmount,
      paymentMethod: paymentMethodID,
      networkName: "paymentMethodID",
      paymentCurrency: currency,
      order_id: reservation_reference_id, // Keep for backward compatibility
    });

    // Note: Order creation removed - orders functionality disabled

    if (paymentMethodID === 'DigitalAssetPayment') {
      paymentUrl = await this.generatePaymentUrl(usdAmount, currency, reservation_reference_id, successUrl, cancelUrl);
    } else if (paymentMethodID === 'CardTransfer') {
      // Note: Stripe integration may need updates since Order model is removed
      const paymentResult = await PaymentService.createCheckoutSession(
        usdAmount, 
        currency, 
        reservation_reference_id,
        successUrl,
        cancelUrl
      );
      paymentUrl = paymentResult.url;
    } else if (paymentMethodID === 'BankTransfer') {
      paymentUrl = '0';
      await sendTokenInterestEmail(
        customer.email, 
        customer.first_name, 
        usdAmount, 
        currency, 
        token, 
        customer.phone,
        registrationId,
        currency,
        paymentMethodID
      );
    } else {
      return res.status(400).json({
        success: false,
        errors: [{
          field: "paymentMethodID",
          message: "Invalid payment method. Supported methods: DigitalAssetPayment, CardTransfer, BankTransfer"
        }]
      });
    }

    if (!paymentUrl) {
      return res.status(400).json({
        success: false,
        errors: [{
          field: "payment_configuration",
          paymentMethodID: paymentMethodID,
          message: "Invalid payment method/network/currency combination"
        }]
      });
    }
    
    return res.status(201).json({
      success: true,
      data: {
        registrationId,
        reservationReferenceId: reservation_reference_id,
        paymentUrl,
        message: 'Token registration successful'
      }
    });

  } catch (err) {
    logger.error('Registration error:', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    
    return res.status(500).json({
      success: false,
      errors: [{ message: "Internal server error" }]
    });
  }
}
  async uploadScreenshot(req, res) {
    try {
      console.log('6. Entering uploadScreenshot controller');
      const { registrationId } = req.body;
      const file = req.file;
      const customer_id = req.user.customer_id;
  
      console.log('Request details:', {
        registrationId,
        customer_id,
        filePresent: !!file
      });
  
      const registration = await Reservation.findReservById(registrationId, customer_id);
      console.log('Reservation lookup result:', registration ? 'Found' : 'Not found');
      
      if (!registration) {
        console.log('8. Reservation not found error');
        return res.status(404).json({
          success: false,
          errors: [{ message: "Registration not found" }]
        });
      }
  
      const fileUrl = await uploadToS3(file, 'payment_screenshots/');
      console.log('S3 upload successful. URL:', fileUrl);
  
      const screenshotId = await PaymentScreenshot.create({
        registrationId,
        fileUrl
      });
      console.log('Database save successful. ID:', screenshotId);
  
      console.log('11. Process completed successfully');
      return res.status(201).json({
        success: true,
        data: {
          screenshotId,
          fileUrl,
          message: "Screenshot uploaded successfully"
        }
      });
  
    } catch (err) {
      console.error('12. ERROR CAUGHT:', {
        errorMessage: err.message,
        stack: err.stack,
        requestBody: req.body,
        filePresent: !!req.file,
        user: req.user
      });
  
      logger.error('Screenshot upload failed:', {
        error: err.message,
        stack: err.stack,
        registrationId: req.body.registrationId
      });
  
      if (err.message.includes('S3 Upload Error')) {
        console.log('13. S3-specific error detected');
        return res.status(500).json({
          success: false,
          errors: [{ message: "Failed to upload file to storage" }]
        });
      }
  
      res.status(500).json({
        success: false,
        errors: [{ message: "Internal server error" }]
      });
    }
  }

  convertToUSD(amount, currency) {
    console.log('convertToUSD called with:', amount, currency);

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const tokens = parseFloat(amount);
    let usdAmount = 0;

    const cur = String(currency || '').toUpperCase();

    if (cur === 'USD' || cur === 'USDT') {
      usdAmount = tokens * 0.1;
    } else if (cur === 'CHF') {
      const USD_TO_CHF = 0.90;
      usdAmount = tokens * 0.1 * USD_TO_CHF;
    } else {
      throw new Error(`Unsupported currency: ${currency}. Allowed only USD, USDT, CHF`);
    }

    console.log(`Conversion result: ${tokens} tokens (${cur}) -> ${usdAmount} USD base or CHF converted`);
    return usdAmount;
  }

  async getKycStatus(customer_id) {
    try {
      const [result] = await db.query(`
        SELECT status FROM customer_kyc 
        WHERE customer_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [customer_id]);
  
      return result[0]?.status || 'missing';
    } catch (err) {
      logger.error('Failed to fetch KYC status:', {
        error: err.message,
        customer_id
      });
      throw err;
    }
  }

  async getAllRegistrations(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const hasScreenshot = req.query.hasScreenshot || '';
      const status = req.query.status || '';
      const customerId = req.query.customerId || '';
      const { registrations, total } = await Reservation.getAllRegistrations({
        limit,
        offset,
        search,
        hasScreenshot,
        status,
        customerId
      });
  
      res.json({
        success: true,
        data: registrations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
  
    } catch (error) {
      console.error('Error in getAllRegistrations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch registrations'
      });
    }
  }
  
  async getRegistrationDetail(req, res) {
    try {
      const { id } = req.params;
      
      const registration = await Reservation.getRegistrationDetail(id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      return res.json({
        success: true,
        data: registration
      });
      
    } catch (err) {
      console.error('Error fetching registration detail:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  async getRegistrationScreenshots(req, res) {
    try {
      const { id } = req.params;
      
      const screenshots = await Reservation.getRegistrationScreenshots(id);
      
      return res.json({
        success: true,
        data: screenshots
      });
      
    } catch (err) {
      console.error('Error fetching screenshots:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
  
  async getRegistrationCustomer(req, res) {
    try {
      const { id } = req.params;
      
      const customer = await Reservation.getRegistrationCustomer(id);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      
      return res.json({
        success: true,
        data: customer
      });
      
    } catch (err) {
      console.error('Error fetching customer:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async generatePaymentUrl(totalTokenAmount, currency, orderId,successUrl,cancelUrl) {
    try {
      const paymentData = {
        price_amount: parseFloat(totalTokenAmount),
        price_currency: currency.toLowerCase(),
        order_id: orderId,
        order_description: `Token purchase - ${totalTokenAmount} ${currency}`,
        ipn_callback_url: 'https://backend.ptgr.ch/api/transactions/nowpayments/ipn',
        success_url: `${successUrl}/${orderId}`,
        cancel_url: `${cancelUrl}`,
      };

      const response = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NOWPAYMENTS_API_KEY
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NowPayments API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.invoice_url) {
        return result.invoice_url;
      } else {
        throw new Error('No invoice URL in response');
      }
      
    } catch (err) {
      logger.error('Failed to generate payment URL:', {
        error: err.message,
        amount: totalTokenAmount,
        currency: currency,
        orderId: orderId
      });
      return null;
    }
  }

  // ADD THE MISSING WEBHOOK HANDLER
async handleStripeWebhook(req, res) {
  // Use the pre-extracted data from the route
  const webhookData = req.webhookData;

  try {
    // Use the pre-extracted event type and data
    switch (webhookData.eventType) {
      case 'checkout.session.completed':
        await this.handlePaymentSuccess(webhookData);
        break;
      case 'checkout.session.expired':
        await this.handlePaymentExpired(webhookData);
        break;
      case 'checkout.session.async_payment_failed':
        await this.handlePaymentFailed(webhookData);
        break;
      default:
        // Unhandled event type
    }

    res.json({ received: true });
    
  } catch (err) {
    logger.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async handlePaymentSuccess(webhookData) {
  try {
    // Note: Order and Transaction models removed
    // Update reservation status if needed
    // You may need to update this based on your reservation model
    logger.info('Payment success webhook received', {
      orderId: webhookData.orderId,
      sessionId: webhookData.sessionId
    });
    // TODO: Update reservation status if payment tracking is needed
  } catch (err) {
    logger.error('Error handling payment success:', err);
    throw err;
  }
}

async handlePaymentExpired(webhookData) {
  try {
    // Note: Order model removed
    logger.info('Payment expired webhook received', {
      orderId: webhookData.orderId,
      sessionId: webhookData.sessionId
    });
    // TODO: Update reservation status if payment tracking is needed
  } catch (err) {
    logger.error('Error handling payment expired:', err);
  }
}

async handlePaymentFailed(webhookData) {
  try {
    // Note: Order model removed
    logger.info('Payment failed webhook received', {
      orderId: webhookData.orderId,
      sessionId: webhookData.sessionId
    });
    // TODO: Update reservation status if payment tracking is needed
  } catch (err) {
    logger.error('Error handling payment failure:', err);
  }
}

  async checkPaymentStatus(req, res) {
    try {
      const { session_id, registration_id } = req.query;
      
      if (!session_id && !registration_id) {
        return res.status(400).json({
          success: false,
          error: 'Either session_id or registration_id is required'
        });
      }

      let session;
      if (session_id) {
        session = await stripe.checkout.sessions.retrieve(session_id);
      } else {
        // Note: Order model removed - you may need to update this based on your reservation model
        // Check reservation for session_id if stored there
        logger.warn('Payment status check with registration_id requires reservation model update', {
          registration_id
        });
        return res.status(400).json({
          success: false,
          error: 'Payment status check by registration_id not yet implemented. Please use session_id.'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Payment session not found'
        });
      }

      res.json({
        success: true,
        data: {
          status: session.payment_status,
          reservationReferenceId: session.metadata?.orderId || session.client_reference_id,
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_details?.email
        }
      });

    } catch (err) {
      logger.error('Error checking payment status:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to check payment status'
      });
    }
  }
}

module.exports = new ReservationController();