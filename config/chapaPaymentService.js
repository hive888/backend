// config/chapaPaymentService.js
const { chapaClient } = require('./chapaConfig');
const logger = require('../utils/logger');

const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || process.env.API_URL || 'https://api.hive888.org';

class ChapaPaymentService {
  static async createCourseAccessCheckoutSession(
    amount,
    currency,
    paymentReference, // used as Chapa's tx_ref
    customerInfo,
    accessCodeInfo,
    successUrl,
    cancelUrl // unused by Chapa (no separate cancel_url), kept for call-site symmetry with Stripe
  ) {
    try {
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount: ' + amount);
      }
      if (!paymentReference) {
        throw new Error('Payment reference is required');
      }
      if (!customerInfo || !customerInfo.email) {
        throw new Error('Customer email is required for Chapa checkout');
      }

      const response = await chapaClient.post('/transaction/initialize', {
        amount: amount.toString(),
        currency: currency || 'ETB',
        email: customerInfo.email,
        first_name: customerInfo.first_name || 'Hive888',
        last_name: customerInfo.last_name || 'Student',
        tx_ref: paymentReference,
        callback_url: `${BACKEND_URL}/api/webhook/chapa-webhook`,
        return_url: successUrl || 'https://hub.hive888.org/education/self-study',
        customization: {
          title: 'Hive888 Course',
          description: accessCodeInfo?.access_code
            ? `Payment for course access using code: ${accessCodeInfo.access_code}`
            : 'Course access payment',
        },
      });

      const checkoutUrl = response.data?.data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error('Chapa did not return a checkout_url');
      }

      logger.info('Chapa checkout session created:', {
        txRef: paymentReference,
        amount,
        customerId: customerInfo.customer_id,
      });

      return { url: checkoutUrl, sessionId: paymentReference, paymentReference };
    } catch (err) {
      const details = err.response?.data || err.message;
      logger.error('ChapaPaymentService.createCourseAccessCheckoutSession error:', details);
      throw new Error(`Chapa payment session creation failed: ${JSON.stringify(details)}`);
    }
  }

  static async verifyTransaction(txRef) {
    try {
      const response = await chapaClient.get(`/transaction/verify/${encodeURIComponent(txRef)}`);
      const data = response.data?.data;
      return {
        status: response.data?.status === 'success' ? data?.status : 'failed',
        amount: data?.amount ? Number(data.amount) : null,
        currency: data?.currency || null,
        raw: data,
      };
    } catch (err) {
      const details = err.response?.data || err.message;
      logger.error('ChapaPaymentService.verifyTransaction error:', details);
      throw new Error(`Chapa transaction verification failed: ${JSON.stringify(details)}`);
    }
  }
}

module.exports = { ChapaPaymentService };
