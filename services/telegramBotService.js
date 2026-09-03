const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const Customer = require('../models/Customer');
const TelegramCommunityLink = require('../models/telegramCommunityLinkModel');

class TelegramBotService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.privateGroupId = this.parseChatId(process.env.TELEGRAM_PRIVATE_GROUP_ID);
    this.publicGroupId = this.parseChatId(process.env.TELEGRAM_PUBLIC_GROUP_ID);
    this.privateGroupLink = process.env.TELEGRAM_PRIVATE_GROUP_LINK || null;
    this.publicGroupLink = process.env.TELEGRAM_PUBLIC_GROUP_LINK || null;
    this.bot = null;

    if (!this.token) {
      logger.warn('TELEGRAM_BOT_TOKEN not set - Telegram bot will not start');
      return;
    }

    this.enablePolling = this.shouldEnablePolling();
    this.init().catch((error) => {
      logger.error('Failed to initialize Telegram bot:', error);
    });
  }

  parseChatId(value) {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  shouldEnablePolling() {
    const flag = String(process.env.TELEGRAM_ENABLE_POLLING || '').toLowerCase();
    if (flag === 'true' || flag === '1') return true;
    if (flag === 'false' || flag === '0') return false;
    return process.env.NODE_ENV === 'production';
  }

  getFrontendTelegramLinkUrl() {
    return (
      process.env.TELEGRAM_LINK_FRONTEND_URL ||
      process.env.FRONTENDHIVE_URL ||
      process.env.FRONTEND_URL ||
      'https://hub.hive888.org/en/profile'
    );
  }

  getBotPublicLink() {
    if (process.env.TELEGRAM_BOT_LINK) return process.env.TELEGRAM_BOT_LINK;
    if (process.env.TELEGRAM_BOT_USERNAME) return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`;
    return 'https://t.me';
  }

  getGroupLinkButtons() {
    const buttons = [];
    if (this.privateGroupLink) buttons.push([{ text: 'Join Private Group', url: this.privateGroupLink }]);
    if (this.publicGroupLink) buttons.push([{ text: 'Join Public Group', url: this.publicGroupLink }]);
    return buttons;
  }

  stopPolling() {
    if (!this.bot) return;
    try {
      this.bot.stopPolling({ cancel: true });
    } catch (_) {
      // ignore
    }
  }

  async init() {
    try {
      if (!this.enablePolling) {
        this.bot = new TelegramBot(this.token, { polling: false });
        this.setupHandlers();
        logger.info('Telegram Bot Service initialized without polling', {
          privateGroupId: this.privateGroupId,
          publicGroupId: this.publicGroupId,
        });
        return;
      }

      const tempBot = new TelegramBot(this.token, { polling: false });
      try {
        await tempBot.deleteWebHook();
      } catch (_) {
        // ignore
      }
      try {
        await tempBot.close();
      } catch (_) {
        // ignore
      }

      this.bot = new TelegramBot(this.token, { polling: true });
      this.setupHandlers();
      logger.info('Telegram Bot Service initialized', {
        privateGroupId: this.privateGroupId,
        publicGroupId: this.publicGroupId,
      });
    } catch (error) {
      this.bot = null;
      logger.error('Failed to initialize Telegram bot:', {
        error: error.message,
        code: error.code,
      });
    }
  }

  setupHandlers() {
    if (!this.bot) return;

    this.bot.onText(/\/start(?:\s+.*)?$/, async (msg) => {
      await this.sendLinkingMessage(msg.chat.id, msg.from);
    });
    this.bot.onText(/\/link$/, async (msg) => {
      await this.sendLinkingMessage(msg.chat.id, msg.from);
    });
    this.bot.onText(/\/status$/, async (msg) => {
      await this.handleStatus(msg.chat.id, msg.from);
    });
    this.bot.onText(/\/help$/, async (msg) => {
      await this.handleHelp(msg.chat.id);
    });
    this.bot.on('chat_join_request', async (request) => {
      await this.handleJoinRequest(request);
    });
    this.bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        logger.warn('Telegram bot conflict detected. Stopping local polling.');
        this.stopPolling();
        return;
      }
      logger.error('Telegram bot polling error:', { error: error.message, code: error.code });
    });
  }

  async sendLinkingMessage(chatId, from) {
    const telegramUserId = from.id;
    const username = from.username || from.first_name || null;
    try {
      const existing = await TelegramCommunityLink.findLinkByTelegramUserId(telegramUserId);
      if (existing && !existing.deleted_at) {
        const buttons = this.getGroupLinkButtons();
        const statusText =
          `<b>Your Telegram is already linked.</b>\n\n` +
          `Hive888 account: <b>${existing.email}</b>\n\n` +
          (buttons.length
            ? `Tap below to join your Hive888 group${buttons.length > 1 ? 's' : ''} — you'll be approved automatically.`
            : `Private group access: request to join the managed groups and I will approve you automatically.`) +
          `\n\nNeed to relink? Contact support first.`;
        await this.bot.sendMessage(chatId, statusText, {
          parse_mode: 'HTML',
          ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
        });
        return;
      }

      const { code, expiresAt } = await TelegramCommunityLink.createLinkCode(telegramUserId, username, 15);
      const text =
        `<b>Link your Telegram to Hive888</b>\n\n` +
        `1. Sign in to <b>hub.hive888.org</b>\n` +
        `2. Open your profile page\n` +
        `3. Enter this one-time code:\n\n` +
        `<code>${code}</code>\n\n` +
        `This code expires at <b>${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC</b>.\n\n` +
        `<a href="${this.getFrontendTelegramLinkUrl()}">Open Hive888 profile</a>\n` +
        `<a href="${this.getBotPublicLink()}">Open Telegram bot</a>`;

      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch (error) {
      logger.error('Failed to send Telegram linking message', { telegramUserId, error: error.message });
      await this.bot.sendMessage(chatId, 'Unable to prepare your link code right now. Please try again in a moment.');
    }
  }

  async handleStatus(chatId, from) {
    const telegramUserId = from.id;
    try {
      const link = await TelegramCommunityLink.findLinkByTelegramUserId(telegramUserId);
      if (!link || link.deleted_at) {
        await this.bot.sendMessage(
          chatId,
          `Your Telegram is not linked yet.\n\nUse /start to get a one-time code, then enter it on your Hive888 profile page.`
        );
        return;
      }

      const buttons = this.getGroupLinkButtons();
      await this.bot.sendMessage(
        chatId,
        `<b>Telegram linked</b>\n\n` +
        `Hive888 account: <b>${link.email}</b>\n` +
        `Linked at: <b>${new Date(link.linked_at).toISOString().replace('T', ' ').slice(0, 16)} UTC</b>` +
        (buttons.length
          ? ''
          : `\n\nRequest to join the managed groups and I will approve you automatically.`),
        {
          parse_mode: 'HTML',
          ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
        }
      );
    } catch (error) {
      logger.error('Failed to load Telegram status', { telegramUserId, error: error.message });
      await this.bot.sendMessage(chatId, 'Unable to load your Telegram status right now.');
    }
  }

  async handleHelp(chatId) {
    await this.bot.sendMessage(
      chatId,
      `<b>Hive888 Telegram Access</b>\n\n` +
      `/start - Generate a one-time link code\n` +
      `/link - Generate a new link code\n` +
      `/status - Check whether your Telegram is linked\n` +
      `/help - Show this help message`,
      { parse_mode: 'HTML' }
    );
  }

  async handleJoinRequest(request) {
    const chatId = Number(request.chat.id);
    const telegramUserId = Number(request.from.id);
    const username = request.from.username || request.from.first_name || null;

    if (![this.privateGroupId, this.publicGroupId].includes(chatId)) {
      return;
    }

    try {
      const joinRequestId = await TelegramCommunityLink.createOrRefreshJoinRequest(chatId, telegramUserId, username);
      const link = await TelegramCommunityLink.findLinkByTelegramUserId(telegramUserId);

      if (link && !link.deleted_at) {
        await this.approveJoinRequest(chatId, telegramUserId);
        await TelegramCommunityLink.resolveJoinRequest(joinRequestId, 'approved', 'Already linked');
        return;
      }

      const { code } = await TelegramCommunityLink.createLinkCode(telegramUserId, username, 15);
      await this.declineJoinRequest(chatId, telegramUserId, 'Telegram account is not linked to Hive888');
      await TelegramCommunityLink.resolveJoinRequest(joinRequestId, 'declined', 'Telegram account is not linked to Hive888');
      await this.safeDirectMessage(
        telegramUserId,
        `<b>Join request declined</b>\n\n` +
        `To access Hive888 community groups, link your Telegram to your Hive888 account first.\n\n` +
        `One-time code: <code>${code}</code>\n` +
        `Then enter it here: <a href="${this.getFrontendTelegramLinkUrl()}">Open Hive888 profile</a>`,
        { disable_web_page_preview: true }
      );
    } catch (error) {
      logger.error('Failed to handle chat join request', {
        chatId,
        telegramUserId,
        error: error.message,
      });
      try {
        await this.declineJoinRequest(chatId, telegramUserId, 'Unable to validate request');
      } catch (_) {
        // ignore
      }
    }
  }

  async approveJoinRequest(chatId, telegramUserId) {
    if (!this.bot) return false;
    await this.bot.approveChatJoinRequest(chatId, telegramUserId);
    logger.info('Approved Telegram join request', { chatId, telegramUserId });
    return true;
  }

  async declineJoinRequest(chatId, telegramUserId, reason = null) {
    if (!this.bot) return false;
    await this.bot.declineChatJoinRequest(chatId, telegramUserId);
    logger.info('Declined Telegram join request', { chatId, telegramUserId, reason });
    return true;
  }

  async approvePendingRequestsForTelegramUser(telegramUserId) {
    const pending = await TelegramCommunityLink.getPendingJoinRequests(telegramUserId);
    const approvedChats = [];

    for (const request of pending) {
      try {
        await this.approveJoinRequest(Number(request.chat_id), telegramUserId);
        await TelegramCommunityLink.resolveJoinRequest(request.id, 'approved', 'Linked on Hive888');
        approvedChats.push(Number(request.chat_id));
      } catch (error) {
        logger.warn('Could not approve pending join request', {
          telegramUserId,
          chatId: request.chat_id,
          error: error.message,
        });
      }
    }

    return approvedChats;
  }

  async safeDirectMessage(telegramUserId, message, options = {}) {
    if (!this.bot) return false;
    try {
      await this.bot.sendMessage(telegramUserId, message, {
        parse_mode: 'HTML',
        ...options,
      });
      return true;
    } catch (error) {
      logger.warn('Could not DM Telegram user', { telegramUserId, error: error.message });
      return false;
    }
  }

  async removeUserFromManagedGroups(telegramUserId) {
    if (!this.bot) return [];
    const chatIds = [this.privateGroupId, this.publicGroupId].filter(Boolean);
    const removed = [];

    for (const chatId of chatIds) {
      try {
        await this.bot.banChatMember(chatId, telegramUserId);
        await this.bot.unbanChatMember(chatId, telegramUserId, { only_if_banned: true });
        removed.push(chatId);
      } catch (error) {
        logger.warn('Could not remove Telegram user from managed group', {
          chatId,
          telegramUserId,
          error: error.message,
        });
      }
    }

    return removed;
  }
}

let botServiceInstance = null;

function getTelegramBotService() {
  if (!botServiceInstance && process.env.TELEGRAM_BOT_TOKEN) {
    botServiceInstance = new TelegramBotService();
  }
  return botServiceInstance;
}

module.exports = {
  TelegramBotService,
  getTelegramBotService,
};