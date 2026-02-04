const Customer = require('../models/Customer');
const TelegramVerificationCode = require('../models/telegramVerificationCodeModel');
const { sendTelegramVerificationCode } = require('../utils/telegramEmail');
const logger = require('../utils/logger');

const telegramController = {
  /**
   * Register a new customer from Telegram
   * POST /api/telegram/register
   */
  async register(req, res) {
    try {
      const { telegram_user_id, telegram_username, email, phone, first_name, last_name } = req.body;

      // Validate required fields
      if (!telegram_user_id || !email || !phone || !first_name || !last_name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          message: 'telegram_user_id, email, phone, first_name, and last_name are required'
        });
      }

      // Check if Telegram ID is already linked
      const existingByTelegram = await Customer.findByTelegramId(telegram_user_id);
      if (existingByTelegram) {
        return res.status(409).json({
          success: false,
          error: 'Telegram account already linked',
          code: 'DUPLICATE_TELEGRAM',
          message: 'This Telegram account is already linked to a customer account'
        });
      }

      // Check if email already exists
      const existingByEmail = await Customer.findByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered',
          code: 'DUPLICATE_EMAIL',
          message: 'An account with this email already exists'
        });
      }

      // Create customer
      const customerData = {
        email,
        phone,
        first_name,
        last_name,
        telegram_user_id,
        telegram_username,
        source: 'telegram',
        is_email_verified: 0,
        is_phone_verified: 0
      };

      const newCustomer = await Customer.create(customerData);

      logger.info('Customer registered via Telegram', {
        customerId: newCustomer.customer_id,
        telegramUserId: telegram_user_id,
        email
      });

      res.status(201).json({
        success: true,
        message: 'Customer registered successfully',
        data: {
          customer_id: newCustomer.customer_id,
          email: newCustomer.email,
          first_name: newCustomer.first_name,
          last_name: newCustomer.last_name
        }
      });
    } catch (error) {
      logger.error('Telegram registration error:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate entry',
          code: 'DUPLICATE_ENTRY',
          message: error.message.includes('email') 
            ? 'An account with this email already exists'
            : 'An account with this phone number already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to register customer',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Link Telegram account to existing customer
   * POST /api/telegram/link
   */
  async link(req, res) {
    try {
      const { telegram_user_id, telegram_username, email, code } = req.body;

      if (!telegram_user_id || !email || !code) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          message: 'telegram_user_id, email, and code are required'
        });
      }

      // Verify code
      const verification = await TelegramVerificationCode.verifyAndUse(telegram_user_id, code);
      if (!verification.valid || verification.email !== email) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification code',
          code: 'INVALID_CODE'
        });
      }

      // Find customer by email
      const customer = await Customer.findByEmail(email);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'NOT_FOUND'
        });
      }

      // Check if Telegram ID is already linked to another account
      const existingByTelegram = await Customer.findByTelegramId(telegram_user_id);
      if (existingByTelegram && existingByTelegram.customer_id !== customer.customer_id) {
        return res.status(409).json({
          success: false,
          error: 'Telegram account already linked',
          code: 'DUPLICATE_TELEGRAM',
          message: 'This Telegram account is already linked to another account'
        });
      }

      // Link Telegram account
      await Customer.linkTelegramAccount(customer.customer_id, telegram_user_id, telegram_username);

      logger.info('Telegram account linked', {
        customerId: customer.customer_id,
        telegramUserId: telegram_user_id,
        email
      });

      res.status(200).json({
        success: true,
        message: 'Telegram account linked successfully',
        data: {
          customer_id: customer.customer_id,
          email: customer.email
        }
      });
    } catch (error) {
      logger.error('Telegram link error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to link Telegram account',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Request verification code for linking
   * POST /api/telegram/request-code
   */
  async requestCode(req, res) {
    try {
      const { telegram_user_id, email } = req.body;

      if (!telegram_user_id || !email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          message: 'telegram_user_id and email are required'
        });
      }

      // Check if customer exists
      const customer = await Customer.findByEmail(email);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'NOT_FOUND',
          message: 'No account found with this email address'
        });
      }

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await TelegramVerificationCode.create(telegram_user_id, email, code, 10); // 10 minutes expiry

      // Send verification email
      await sendTelegramVerificationCode(email, code);

      logger.info('Verification code requested', {
        telegramUserId: telegram_user_id,
        email
      });

      res.status(200).json({
        success: true,
        message: 'Verification code sent to email'
      });
    } catch (error) {
      logger.error('Request code error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to send verification code',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Check if Telegram user is registered
   * GET /api/telegram/check/:telegram_user_id
   */
  async check(req, res) {
    try {
      const telegramUserId = parseInt(req.params.telegram_user_id);

      if (!telegramUserId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid telegram_user_id',
          code: 'VALIDATION_ERROR'
        });
      }

      const customer = await Customer.findByTelegramId(telegramUserId);

      res.status(200).json({
        success: true,
        registered: !!customer,
        data: customer ? {
          customer_id: customer.customer_id,
          email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name
        } : null
      });
    } catch (error) {
      logger.error('Telegram check error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to check registration status',
        code: 'SERVER_ERROR'
      });
    }
  }
};

module.exports = telegramController;

