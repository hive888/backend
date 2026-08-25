const Customer = require('../models/Customer');
const TelegramCommunityLink = require('../models/telegramCommunityLinkModel');
const logger = require('../utils/logger');
const { getTelegramBotService } = require('../services/telegramBotService');

function getBotLinkBase() {
  if (process.env.TELEGRAM_BOT_LINK) return process.env.TELEGRAM_BOT_LINK;
  if (process.env.TELEGRAM_BOT_USERNAME) return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`;
  return 'https://t.me';
}

const telegramController = {
  async requestLinkCode(req, res) {
    try {
      const customerId = req.user?.customer_id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: 'Authenticated customer account required',
          code: 'AUTH_REQUIRED',
        });
      }

      const current = await TelegramCommunityLink.findLinkByCustomerId(customerId);
      if (current) {
        return res.status(200).json({
          success: true,
          message: 'Telegram account already linked',
          data: {
            linked: true,
            telegram_user_id: Number(current.telegram_user_id),
            telegram_username: current.telegram_username || null,
            linked_at: current.linked_at,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Open the bot and request a Telegram link code',
        data: {
          linked: false,
          bot_link: getBotLinkBase(),
        },
      });
    } catch (error) {
      logger.error('Telegram requestLinkCode error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to prepare Telegram linking instructions',
        code: 'SERVER_ERROR',
      });
    }
  },

  async confirmLink(req, res) {
    try {
      const customerId = req.user?.customer_id;
      const code = String(req.body?.code || '').trim();

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: 'Authenticated customer account required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Link code is required',
          code: 'VALIDATION_ERROR',
        });
      }

      const customer = await Customer.findById(customerId);
      if (!customer || customer.deleted_at) {
        return res.status(404).json({
          success: false,
          error: 'Customer account not found',
          code: 'CUSTOMER_NOT_FOUND',
        });
      }

      const consumed = await TelegramCommunityLink.consumeLinkCode(code);
      if (!consumed.ok) {
        return res.status(400).json({
          success: false,
          error: consumed.reason === 'expired' ? 'Link code has expired' : 'Invalid link code',
          code: consumed.reason === 'expired' ? 'CODE_EXPIRED' : 'INVALID_CODE',
        });
      }

      const row = consumed.row;
      await TelegramCommunityLink.upsertLink({
        telegramUserId: Number(row.telegram_user_id),
        telegramUsername: row.telegram_username,
        customerId,
      });
      await Customer.linkTelegramAccount(customerId, Number(row.telegram_user_id), row.telegram_username || null);

      const botService = getTelegramBotService();
      let approvedChats = [];
      if (botService) {
        approvedChats = await botService.approvePendingRequestsForTelegramUser(Number(row.telegram_user_id));
      }

      logger.info('Telegram account linked to Hive888 customer', {
        customerId,
        telegramUserId: Number(row.telegram_user_id),
        approvedChats,
      });

      return res.status(200).json({
        success: true,
        message: approvedChats.length
          ? 'Telegram linked and pending join request approved'
          : 'Telegram linked successfully',
        data: {
          linked: true,
          telegram_user_id: Number(row.telegram_user_id),
          telegram_username: row.telegram_username || null,
          approved_chats: approvedChats,
        },
      });
    } catch (error) {
      logger.error('Telegram confirmLink error:', error);
      const status = error.code === 'LINK_CONFLICT' ? 409 : 500;
      return res.status(status).json({
        success: false,
        error: error.message || 'Failed to link Telegram account',
        code: error.code || 'SERVER_ERROR',
      });
    }
  },

  async getLinkStatus(req, res) {
    try {
      const customerId = req.user?.customer_id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: 'Authenticated customer account required',
          code: 'AUTH_REQUIRED',
        });
      }

      const link = await TelegramCommunityLink.findLinkByCustomerId(customerId);
      return res.status(200).json({
        success: true,
        data: {
          linked: !!link,
          telegram_user_id: link ? Number(link.telegram_user_id) : null,
          telegram_username: link?.telegram_username || null,
          linked_at: link?.linked_at || null,
        },
      });
    } catch (error) {
      logger.error('Telegram getLinkStatus error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load Telegram link status',
        code: 'SERVER_ERROR',
      });
    }
  },

  async unlink(req, res) {
    try {
      const customerId = req.user?.customer_id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: 'Authenticated customer account required',
          code: 'AUTH_REQUIRED',
        });
      }

      const link = await TelegramCommunityLink.findLinkByCustomerId(customerId);
      await TelegramCommunityLink.unlinkByCustomerId(customerId);
      await Customer.linkTelegramAccount(customerId, null, null);

      if (link?.telegram_user_id) {
        const botService = getTelegramBotService();
        if (botService) {
          await botService.removeUserFromManagedGroups(Number(link.telegram_user_id));
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Telegram account unlinked successfully',
      });
    } catch (error) {
      logger.error('Telegram unlink error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unlink Telegram account',
        code: 'SERVER_ERROR',
      });
    }
  },

  async check(req, res) {
    try {
      const telegramUserId = parseInt(req.params.telegram_user_id, 10);
      if (!telegramUserId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid telegram_user_id',
          code: 'VALIDATION_ERROR',
        });
      }

      const link = await TelegramCommunityLink.findLinkByTelegramUserId(telegramUserId);
      return res.status(200).json({
        success: true,
        linked: !!link,
        data: link ? {
          customer_id: link.customer_id,
          email: link.email,
          first_name: link.first_name,
          last_name: link.last_name,
          telegram_username: link.telegram_username || null,
          linked_at: link.linked_at,
        } : null,
      });
    } catch (error) {
      logger.error('Telegram check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check Telegram registration status',
        code: 'SERVER_ERROR',
      });
    }
  },
};

module.exports = telegramController;

