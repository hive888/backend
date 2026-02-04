const NewsletterSubscriber = require('../models/newsletterSubscriberModel');
const { sendNewsletterThankYouEmail } = require('../utils/email');
const logger = require('../utils/logger');

/**
 * POST /api/newsletter/subscribe
 * Subscribe email to newsletter
 * Body: { email: "user@example.com" }
 */
exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body || {};

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        code: 'EMAIL_REQUIRED',
        message: 'Email is required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Please provide a valid email address'
      });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await NewsletterSubscriber.findByEmail(normalizedEmail);
    const isResubscribe = existing && existing.status === 'unsubscribed';

    // Create/update subscriber
    await NewsletterSubscriber.create(normalizedEmail);

    // Send thank you email
    try {
      await sendNewsletterThankYouEmail(normalizedEmail);
      logger.info('Newsletter thank you email sent', { email: normalizedEmail });
    } catch (emailErr) {
      // Log error but don't fail the subscription
      logger.error('Failed to send newsletter thank you email', {
        email: normalizedEmail,
        error: emailErr.message
      });
    }

    return res.status(200).json({
      success: true,
      message: isResubscribe 
        ? 'Successfully resubscribed to newsletter!'
        : 'Successfully subscribed to newsletter!',
      data: {
        email: normalizedEmail,
        subscribed: true
      }
    });

  } catch (err) {
    logger.error('Newsletter subscription error:', err);
    return res.status(500).json({
      success: false,
      code: 'SUBSCRIPTION_ERROR',
      message: 'Failed to process newsletter subscription',
      error: err.message
    });
  }
};

/**
 * POST /api/newsletter/unsubscribe
 * Unsubscribe email from newsletter
 * Body: { email: "user@example.com" }
 */
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        code: 'EMAIL_REQUIRED',
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const unsubscribed = await NewsletterSubscriber.unsubscribe(normalizedEmail);

    if (!unsubscribed) {
      return res.status(404).json({
        success: false,
        code: 'SUBSCRIBER_NOT_FOUND',
        message: 'Email not found in newsletter subscribers'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from newsletter',
      data: {
        email: normalizedEmail,
        subscribed: false
      }
    });

  } catch (err) {
    logger.error('Newsletter unsubscribe error:', err);
    return res.status(500).json({
      success: false,
      code: 'UNSUBSCRIBE_ERROR',
      message: 'Failed to unsubscribe from newsletter',
      error: err.message
    });
  }
};

/**
 * GET /api/newsletter/subscribers (Admin only)
 * Get all active subscribers
 * Query: ?page=1&limit=100
 */
exports.getSubscribers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    const result = await NewsletterSubscriber.getAllActive({ page, limit });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    logger.error('Get newsletter subscribers error:', err);
    return res.status(500).json({
      success: false,
      code: 'FETCH_ERROR',
      message: 'Failed to fetch newsletter subscribers',
      error: err.message
    });
  }
};

