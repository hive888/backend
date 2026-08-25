// controllers/chapaWebhookController.js
const crypto = require('crypto');
const { ChapaPaymentService } = require('../config/chapaPaymentService');
const { chapaSecretKey } = require('../config/chapaConfig');
const PaymentTracking = require('../models/paymentTrackingModel');
const { completeCourseAccessPayment } = require('./coursePaymentWebhookController');
const logger = require('../utils/logger');

/**
 * Chapa webhook handler for course access payment events.
 * Note: Invoked from `POST /api/webhook/chapa-webhook`. Signature is HMAC-SHA256
 * of the raw request body, keyed with CHAPA_SECRET_KEY, sent as x-chapa-signature.
 */
exports.handleChapaWebhook = async (req, res) => {
  try {
    if (!chapaSecretKey) {
      logger.warn('CHAPA_SECRET_KEY is not set; rejecting Chapa webhook.');
      return res.status(500).json({ success: false, error: 'Chapa is not configured' });
    }

    const signature = req.headers['x-chapa-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, error: 'Missing x-chapa-signature header' });
    }
    if (!req.rawBody) {
      return res.status(400).json({ success: false, error: 'Missing raw body for webhook verification' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', chapaSecretKey)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      logger.warn('Chapa webhook signature verification failed');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const txRef = req.body?.tx_ref;
    if (!txRef) {
      return res.status(400).json({ success: false, error: 'Missing tx_ref' });
    }

    // CRITICAL: Return 200 immediately to acknowledge receipt; process async.
    res.status(200).json({ received: true });

    try {
      // Never trust the webhook payload alone -- Chapa's own docs say to
      // always re-verify against their API before granting access.
      const verification = await ChapaPaymentService.verifyTransaction(txRef);
      if (verification.status !== 'success') {
        logger.info('Chapa webhook: transaction not successful on verify', {
          txRef,
          status: verification.status
        });
        return;
      }

      const payment = await PaymentTracking.getByPaymentReference(txRef);
      if (!payment) {
        logger.error('Chapa webhook: payment record not found for tx_ref', { txRef });
        return;
      }

      await completeCourseAccessPayment({
        customerId: payment.customer_id,
        accessCodeId: payment.access_code_id,
        transactionId: txRef,
        payment,
        paymentDetails: {
          chapa_tx_ref: txRef,
          amount_paid: verification.amount,
          currency: verification.currency,
          payment_method: 'chapa',
          chapa_status: verification.status
        }
      });
    } catch (processErr) {
      logger.error('Chapa webhook processing error:', processErr.message);
      // Response already sent above; nothing further to do here.
    }
  } catch (err) {
    logger.error('Chapa webhook handler error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
