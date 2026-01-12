// services/smsService.js
const twilio = require('twilio');
require('dotenv').config();
const logger = require('../utils/logger');

/**
 * SMS Service using Twilio
 * Configured via environment variables
 */
class SMSService {
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    // Initialize Twilio client if credentials are provided
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.phoneNumber = phoneNumber;
      this.enabled = true;
      logger.info('SMS Service initialized with Twilio');
    } else {
      this.client = null;
      this.enabled = false;
      logger.warn('SMS Service disabled: Twilio credentials not configured');
    }
  }

  /**
   * Send SMS message
   * @param {string} to - Phone number in E.164 format (e.g., +1234567890)
   * @param {string} message - Message text
   * @returns {Promise<Object>} - Response object with channel and status
   */
  async sendSMS(to, message) {
    try {
      // If Twilio is not configured, log and simulate success (for development)
      if (!this.enabled) {
        logger.warn(`SMS Service: Would send SMS to ${to}: ${message}`);
        logger.warn('SMS Service: Twilio not configured - SMS not actually sent');
        
        // Return success response for development/testing
        return {
          channel: 'sms',
          status: 'simulated',
          to: to,
          message: 'SMS service not configured - message logged only'
        };
      }

      // Validate phone number
      if (!to || !to.startsWith('+')) {
        throw new Error('Phone number must be in E.164 format (e.g., +1234567890)');
      }

      // Send SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      logger.info('SMS sent successfully', {
        to: to,
        sid: result.sid,
        status: result.status
      });

      return {
        channel: 'sms',
        status: result.status,
        to: to,
        sid: result.sid,
        message: 'SMS sent successfully'
      };

    } catch (error) {
      logger.error('Failed to send SMS', {
        to: to,
        error: error.message
      });

      // If Twilio is not properly configured, return simulated response
      if (error.code === 20003 || error.message.includes('credentials')) {
        logger.warn('Twilio credentials invalid - simulating SMS send');
        return {
          channel: 'sms',
          status: 'simulated',
          to: to,
          message: 'SMS service not properly configured - message logged only'
        };
      }

      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Verify if SMS service is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export as singleton instance
module.exports = new SMSService();


