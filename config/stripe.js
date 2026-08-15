// config/stripe.js
const Stripe = require('stripe');
const db = require('../config/database');
// Note: Order and Transaction models removed - this file may need updates if used elsewhere

// Use live key explicitly - prefer STRIPE_SECRET_KEY_LIVE, fallback to STRIPE_SECRET_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_LIVE must be set');
}

// Validate that we're using a live key (not test key) in production
if (stripeSecretKey.startsWith('sk_test_')) {
  console.warn('⚠️ WARNING: Test Stripe key detected. Using test key is permitted for development/testing but NOT for production.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test Stripe key detected. Please use a live key (sk_live_...) for production.');
  }
}

if (!stripeSecretKey.startsWith('sk_live_')) {
  console.warn('⚠️ WARNING: Stripe key format is unexpected. Expected sk_live_...');
}

console.log('✅ Using Stripe LIVE key for payments');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

class PaymentService {
  static async createCheckoutSession(totalTokenAmount, currency, orderId,successUrl,cancelUrl) {
    try {
      // Validate parameters
      if (!totalTokenAmount || totalTokenAmount <= 0) {
        throw new Error('Invalid totalTokenAmount: ' + totalTokenAmount);
      }
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      
      currency = currency || 'CHF';

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: "PTGR Token",
                description: `Purchase of ${totalTokenAmount} PTGR Tokens`,
              },
              unit_amount: Math.round(totalTokenAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successUrl}/${orderId}`,
        cancel_url: `${cancelUrl}`,
        metadata: {
          orderId: orderId,
          tokenAmount: totalTokenAmount.toString()
        },
        client_reference_id: orderId,
      });

      // Store session ID in database for reference
      await this.storeSessionInfo(orderId, session.id);
      // Note: Transaction creation removed - Order/Transaction functionality disabled
      return {
        url: session.url,
        sessionId: session.id
      };
      
    } catch (err) {
      console.error('Stripe checkout session creation failed:', err);
      throw new Error(`Payment session creation failed: ${err.message}`);
    }
  }

static async storeSessionInfo(orderId, sessionId) {
  try {
    // Note: Order model removed - this function may need to be updated if still used
    // Currently disabled as Order functionality is removed
    console.log('⚠️ [storeSessionInfo] Order functionality disabled - Order:', orderId, 'Session:', sessionId);
    return true;
  } catch (err) {
    console.error('❌ [storeSessionInfo] Error:', err.message);
    return false;
  }
}

  static async getCheckoutSession(sessionId) {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      throw new Error(`Failed to retrieve session: ${err.message}`);
    }
  }
}

module.exports = { PaymentService, stripe };