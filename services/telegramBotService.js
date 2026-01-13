const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const Customer = require('../models/Customer');
const TelegramVerificationCode = require('../models/telegramVerificationCodeModel');
const { sendTelegramVerificationCode } = require('../utils/telegramEmail');

class TelegramBotService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.privateGroupId = process.env.TELEGRAM_PRIVATE_GROUP_ID;
    this.privateTopicId = parseInt(process.env.TELEGRAM_PRIVATE_TOPIC_ID || '3');
    this.publicTopicId = parseInt(process.env.TELEGRAM_PUBLIC_TOPIC_ID || '4');
    this.userStates = new Map(); // Store user conversation states
    this.bot = null;
    
    if (!this.token) {
      logger.warn('TELEGRAM_BOT_TOKEN not set - Telegram bot will not start');
      return;
    }

    // Initialize bot asynchronously (delete webhook first, then start polling)
    this.init().catch(error => {
      logger.error('Failed to initialize Telegram bot:', error);
    });
  }

  async init() {
    try {
      // Delete any existing webhook first (webhook and polling can't run simultaneously)
      const tempBot = new TelegramBot(this.token, { polling: false });
      try {
        await tempBot.deleteWebHook();
        logger.info('Deleted existing webhook (if any)');
      } catch (webhookError) {
        // Webhook might not exist, that's okay - ignore the error
        logger.debug('No webhook to delete');
      }
      
      // Close temp bot gracefully, ignore errors (rate limiting, etc.)
      try {
        await tempBot.close().catch(err => {
          // Ignore close errors - bot might already be closed or rate limited
          logger.debug('Error closing temp bot (ignored):', err.message);
        });
      } catch (closeError) {
        // Ignore close errors - bot might already be closed or rate limited
        logger.debug('Error closing temp bot (ignored):', closeError.message);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now create bot with polling enabled
      this.bot = new TelegramBot(this.token, { polling: true });
      
      this.setupHandlers();
      logger.info('Telegram Bot Service initialized', {
        privateGroupId: this.privateGroupId,
        privateTopicId: this.privateTopicId,
        publicTopicId: this.publicTopicId
      });
    } catch (error) {
      // Handle network/connection errors gracefully
      if (error.code === 'EFATAL' || error.name === 'AggregateError' || error.message?.includes('EFATAL')) {
        logger.error('Telegram bot connection failed (network/API issue). Bot will not start.', {
          error: error.message,
          code: error.code,
          cause: error.cause?.message || error.cause
        });
        logger.warn('Possible causes: Network connectivity issue, invalid bot token, or Telegram API unavailable. Please check your internet connection and bot token.');
      } else {
        logger.error('Failed to initialize Telegram bot:', {
          error: error.message,
          code: error.code,
          stack: error.stack
        });
      }
      this.bot = null;
    }
  }

  setupHandlers() {
    if (!this.bot) return;

    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStart(msg);
    });

    // Register command
    this.bot.onText(/\/register/, async (msg) => {
      await this.handleRegister(msg);
    });

    // Link command
    this.bot.onText(/\/link/, async (msg) => {
      await this.handleLink(msg);
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatus(msg);
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelp(msg);
    });

    // Handle all text messages (for conversation flow)
    this.bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        await this.handleMessage(msg);
      }
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      // Handle 409 conflict (another bot instance running) - log as warning, not error
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        logger.warn('Telegram bot conflict: Another bot instance is already running. This instance will not receive updates.', {
          message: error.message
        });
        // Don't throw - allow the server to continue running
        return;
      }
      
      // Handle 429 rate limiting - log as warning, bot will retry automatically
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 429) {
        const retryAfter = error.response?.body?.parameters?.retry_after || 'unknown';
        logger.warn(`Telegram bot rate limited. Retry after ${retryAfter} seconds.`, {
          message: error.message
        });
        // Don't throw - bot library will handle retry
        return;
      }
      
      // Handle network/connection errors gracefully
      if (error.code === 'EFATAL' || error.name === 'AggregateError' || error.message?.includes('EFATAL')) {
        logger.error('Telegram bot polling error: Network/connection issue', {
          error: error.message,
          code: error.code,
          cause: error.cause?.message || error.cause
        });
        logger.warn('Telegram bot will retry automatically when connection is restored.');
        return;
      }
      
      logger.error('Telegram bot polling error:', {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
    });
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;

    try {
      // Check if user is registered
      const customer = await Customer.findByTelegramId(telegramUserId);

      if (customer) {
        const inviteLink = await this.getGroupInviteLink();
        await this.bot.sendMessage(chatId, 
          `<b>Hey ${customer.first_name || username}, welcome back!</b>\n\n` +
          `You're all set and ready to go!\n` +
          `You've got full access to our exclusive PTGR HUB community!\n\n` +
          (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
          `/help - See all commands\n` +
          `/status - Check your account`,
          { parse_mode: 'HTML', disable_web_page_preview: true }
        );
      } else {
        await this.bot.sendMessage(chatId,
          `<b>Welcome to PTGR HUB!</b>\n\n` +
          `<b>Building Africa's Web3 Future</b>\n\n` +
          `We're super excited to have you here! Join thousands of professionals building the future of Web3 in Africa.\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `<b>Get Started:</b>\n\n` +
          `/register - Create your account (2 minutes!)\n` +
          `/link - Already have an account? Link it here!\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `/help - Need help? We've got you covered!`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      logger.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId,
        `<b>Oops! Something went wrong</b>\n\n` +
        `Please try again in a moment!\n\n` +
        `<i>We're working on it!</i>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  async handleRegister(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;

    try {
      // Check if already registered
      const existing = await Customer.findByTelegramId(telegramUserId);
      if (existing) {
        const inviteLink = await this.getGroupInviteLink();
        await this.bot.sendMessage(chatId, 
          `You are already registered!\n\n` +
          (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
          `Use /status to check your account details.`,
          { parse_mode: 'HTML', disable_web_page_preview: true }
        );
        return;
      }

      // Set state to registration
      this.userStates.set(telegramUserId, { 
        action: 'register', 
        step: 'email',
        data: {} 
      });

      await this.bot.sendMessage(chatId,
        `<b>Awesome! Let's Get You Registered!</b>\n\n` +
        `<b>Step 1:</b> What's your email address?\n\n` +
        `Just send me your email and we'll get started!\n\n` +
        `<i>Don't worry, we'll keep it safe!</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Error in handleRegister:', error);
      await this.bot.sendMessage(chatId,
        `<b>Oops! Something went wrong</b>\n\n` +
        `Please try again in a moment!\n\n` +
        `<i>We're working on it!</i>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  async handleLink(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;

    try {
      // Check if already linked
      const existing = await Customer.findByTelegramId(telegramUserId);
      if (existing) {
        const inviteLink = await this.getGroupInviteLink();
        await this.bot.sendMessage(chatId,
          `<b>Already connected!</b>\n\n` +
          `Your Telegram is linked and you're good to go!\n\n` +
          (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
          `/status - View your account\n` +
          `/help - All commands`,
          { parse_mode: 'HTML', disable_web_page_preview: true }
        );
        return;
      }

      // Set state to linking
      this.userStates.set(telegramUserId, {
        action: 'link',
        step: 'email',
        data: {}
      });

      await this.bot.sendMessage(chatId,
        `<b>Great! Let's Link Your Account!</b>\n\n` +
        `Connect your Telegram to your PTGR HUB account in seconds!\n\n` +
        `<b>What's your registered email?</b>\n\n` +
        `<i>We'll send you a quick verification code to confirm it's really you!</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Error in handleLink:', error);
      await this.bot.sendMessage(chatId,
        `<b>Oops! Something went wrong</b>\n\n` +
        `Please try again in a moment!\n\n` +
        `<i>We're working on it!</i>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  async handleStatus(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;

    try {
      const customer = await Customer.findByTelegramId(telegramUserId);

        if (!customer) {
        await this.bot.sendMessage(chatId,
          `<b>Hey there!</b>\n\n` +
          `You're not registered yet, but that's easy to fix!\n\n` +
          `/register - Create your account\n` +
          `/link - Link existing account\n\n` +
          `Let's get you started!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const inviteLink = await this.getGroupInviteLink();
      const statusMessage = 
        `<b>YOUR ACCOUNT DASHBOARD</b>\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `<b>NAME:</b> ${customer.first_name || ''} ${customer.last_name || ''}\n` +
        `<b>EMAIL:</b> ${customer.email || 'Not set'}\n` +
        `<b>PHONE:</b> ${customer.phone || 'Not set'}\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `<b>VERIFICATION STATUS</b>\n\n` +
        `${customer.is_email_verified ? '' : ''} Email: ${customer.is_email_verified ? '<b>Verified</b>' : '<i>Pending</i>'}\n` +
        `${customer.is_phone_verified ? '' : ''} Phone: ${customer.is_phone_verified ? '<b>Verified</b>' : '<i>Pending</i>'}\n` +
        `${customer.is_kyc_verified ? '' : ''} KYC: ${customer.is_kyc_verified ? '<b>Verified</b>' : '<i>Pending</i>'}\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `<b>YOU'RE ALL SET!</b>\n\n` +
        (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
        `Keep building!`;

      await this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (error) {
      logger.error('Error in handleStatus:', error);
      await this.bot.sendMessage(chatId,
        `<b>Oops! Something went wrong</b>\n\n` +
        `Please try again in a moment!\n\n` +
        `<i>We're working on it!</i>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;

    const helpMessage = 
      `<b>PTGR HUB BOT COMMANDS</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `/start - Welcome & get started\n` +
      `/register - Create your account (2 min!)\n` +
      `/link - Link existing account\n` +
      `/status - View your account info\n` +
      `/help - Show this menu\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `<b>Quick Tips:</b>\n` +
      `All commands are super easy to use!\n` +
      `Need help? Just type any command!\n` +
      `Ready to join? Use /register or /link!\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `<b>About PTGR HUB</b>\n` +
      `Building Africa's Web3 Professionals!\n\n` +
      `Questions? We're here to help!`;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;
    const text = msg.text.trim();
    const state = this.userStates.get(telegramUserId);

    if (!state) {
      // No active conversation
      return;
    }

    try {
      if (state.action === 'register') {
        await this.handleRegisterFlow(msg, state, text);
      } else if (state.action === 'link') {
        await this.handleLinkFlow(msg, state, text);
      }
    } catch (error) {
      logger.error('Error in handleMessage:', error);
      this.userStates.delete(telegramUserId);
      await this.bot.sendMessage(chatId,
        `<b>Oops! Something went wrong</b>\n\n` +
        `Let's start fresh!\n\n` +
        `/register - Create account\n` +
        `/link - Link account\n\n` +
        `<i>Don't worry, we'll get you sorted!</i>`,
        { parse_mode: 'HTML' }
      );
    }
  }

  async handleRegisterFlow(msg, state, text) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;

    if (state.step === 'email') {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(text)) {
        await this.bot.sendMessage(chatId,
          `<b>Oops! That doesn't look right</b>\n\n` +
          `Please enter a valid email address:\n\n` +
          `<i>Example: yourname@email.com</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.data.email = text;
      state.step = 'phone';
      this.userStates.set(telegramUserId, state);

        await this.bot.sendMessage(chatId,
          `<b>Perfect! Got it!</b>\n\n` +
          `<b>Step 2:</b> What's your phone number?\n\n` +
          `Include your country code, like this:\n` +
          `<code>+1234567890</code>\n\n` +
          `Almost there!`,
          { parse_mode: 'HTML' }
        );
    } else if (state.step === 'phone') {
      // Validate phone (basic validation)
      if (!text.startsWith('+') || text.length < 10) {
        await this.bot.sendMessage(chatId,
          `<b>Hmm, that format doesn't work</b>\n\n` +
          `Please include your country code:\n\n` +
          `<code>+1234567890</code>\n\n` +
          `<i>Don't forget the + at the start!</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.data.phone = text;
      state.step = 'first_name';
      this.userStates.set(telegramUserId, state);

      await this.bot.sendMessage(chatId,
        `<b>Awesome! Phone number saved!</b>\n\n` +
        `<b>Step 3:</b> What's your first name?\n\n` +
        `Just type your first name below!`,
        { parse_mode: 'HTML' }
      );
    } else if (state.step === 'first_name') {
      if (text.length < 1 || text.length > 100) {
        await this.bot.sendMessage(chatId,
          `<b>Too long or too short!</b>\n\n` +
          `First name should be 1-100 characters\n\n` +
          `Try again, keep it simple!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.data.first_name = text;
      state.step = 'last_name';
      this.userStates.set(telegramUserId, state);

      await this.bot.sendMessage(chatId,
        `<b>Great! First name saved!</b>\n\n` +
        `<b>Last step:</b> What's your last name?\n\n` +
        `We're so close! Just one more thing!`,
        { parse_mode: 'HTML' }
      );
    } else if (state.step === 'last_name') {
      if (text.length < 1 || text.length > 100) {
        await this.bot.sendMessage(chatId,
          `<b>Too long or too short!</b>\n\n` +
          `Last name should be 1-100 characters\n\n` +
          `Almost done! Try again!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      state.data.last_name = text;
      this.userStates.set(telegramUserId, state);

      // Call API to create customer
      await this.completeRegistration(chatId, telegramUserId, msg.from.username, state.data);
    }
  }

  async handleLinkFlow(msg, state, text) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;

    if (state.step === 'email') {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(text)) {
        await this.bot.sendMessage(chatId,
          `<b>Hmm, that email format doesn't work</b>\n\n` +
          `Please enter a valid email address:\n\n` +
          `<i>Example: yourname@email.com</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      try {
        // Check if customer exists
        const customer = await Customer.findByEmail(text);
        if (!customer) {
          await this.bot.sendMessage(chatId,
            `<b>Hmm, we couldn't find that email</b>\n\n` +
            `Double-check your email address\n` +
            `Or use /register to create a new account!\n\n` +
            `<i>No worries, happens to the best of us!</i>`,
            { parse_mode: 'HTML' }
          );
          this.userStates.delete(telegramUserId);
          return;
        }

        // Generate verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await TelegramVerificationCode.create(telegramUserId, text, code);
        
        // Send verification email
        await sendTelegramVerificationCode(text, code);

        state.data.email = text;
        state.step = 'verify_code';
        this.userStates.set(telegramUserId, state);

        await this.bot.sendMessage(chatId,
          `<b>Perfect! Found your account!</b>\n\n` +
          `<b>Check your email!</b> We just sent you a verification code.\n\n` +
          `<b>Enter the 6-digit code here:</b>\n\n` +
          `<i>Tip: Check your spam folder if you don't see it!</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        logger.error('Error in link flow:', error);
        await this.bot.sendMessage(chatId,
          `<b>Oops! Something went wrong</b>\n\n` +
          `Please try again or use /link to start over!\n\n` +
          `<i>Don't worry, we'll get it sorted!</i>`,
          { parse_mode: 'HTML' }
        );
        this.userStates.delete(telegramUserId);
      }
    } else if (state.step === 'verify_code') {
      const code = text.trim();

      try {
        const verification = await TelegramVerificationCode.verifyAndUse(telegramUserId, code);
        
        if (!verification.valid) {
          await this.bot.sendMessage(chatId,
            `<b>Oops! That code didn't work</b>\n\n` +
            `The code might be wrong or expired (10 minutes)\n\n` +
            `Try entering it again, or use /link to get a new one!`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        // Link Telegram account
        const customer = await Customer.findByEmail(verification.email);
        if (!customer) {
          await this.bot.sendMessage(chatId,
            `<b>Oops! Something went wrong</b>\n\n` +
            `We couldn't find your account. Please try again!\n\n` +
            `Or use /link to start over.`,
            { parse_mode: 'HTML' }
          );
          this.userStates.delete(telegramUserId);
          return;
        }

        await Customer.linkTelegramAccount(customer.customer_id, telegramUserId, msg.from.username);
        this.userStates.delete(telegramUserId);

        // Invite user to private group
        await this.inviteUserToGroup(telegramUserId);

        // Get invite link
        const inviteLink = await this.getGroupInviteLink();

        await this.bot.sendMessage(chatId,
          `<b>SUCCESS! Account Linked!</b>\n\n` +
          `Welcome to the family, <b>${customer.first_name || 'Champion'}</b>!\n\n` +
          `Your Telegram is now connected to PTGR HUB!\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `<b>You're IN! Welcome to our exclusive community!</b>\n\n` +
          (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
          `━━━━━━━━━━━━━━━━\n\n` +
          `/status - See your account\n` +
          `/help - All commands`,
          { parse_mode: 'HTML', disable_web_page_preview: true }
        );
      } catch (error) {
        logger.error('Error verifying code:', error);
        await this.bot.sendMessage(chatId,
          `<b>Hmm, something went wrong</b>\n\n` +
          `Please try again or use /link to start fresh!\n\n` +
          `<i>We're here to help!</i>`,
          { parse_mode: 'HTML' }
        );
        this.userStates.delete(telegramUserId);
      }
    }
  }

  async completeRegistration(chatId, telegramUserId, telegramUsername, data) {
    try {
      // Check if email or phone already exists
      const existingByEmail = await Customer.findByEmail(data.email);
      if (existingByEmail) {
        this.userStates.delete(telegramUserId);
        await this.bot.sendMessage(chatId,
          'An account with this email already exists. Use /link to link your Telegram account instead.'
        );
        return;
      }

      // Create customer directly
      const customerData = {
        email: data.email,
        phone: data.phone,
        first_name: data.first_name,
        last_name: data.last_name,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        source: 'telegram',
        is_email_verified: 0,
        is_phone_verified: 0
      };

      const newCustomer = await Customer.create(customerData);
      
      this.userStates.delete(telegramUserId);

      // Invite user to private group
      await this.inviteUserToGroup(telegramUserId);

      // Get invite link
      const inviteLink = await this.getGroupInviteLink();

      await this.bot.sendMessage(chatId,
        `<b>CONGRATULATIONS!</b>\n\n` +
        `<b>Welcome to PTGR HUB, ${data.first_name}!</b>\n\n` +
        `Your account is LIVE and ready to go!\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `<b>YOU'RE NOW PART OF THE COMMUNITY!</b>\n\n` +
          (inviteLink ? `<b>Join the community:</b>\n${inviteLink}\n\n` : '') +
        `━━━━━━━━━━━━━━━━\n\n` +
        `/status - Check your account\n` +
        `/help - See all commands\n\n` +
        `Let's build the future of Web3 together!`,
        { parse_mode: 'HTML', disable_web_page_preview: true }
      );
    } catch (error) {
      logger.error('Error completing registration:', error);
      this.userStates.delete(telegramUserId);

      let errorMessage = '';
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('email')) {
          errorMessage = `<b>Hey! That email is already registered!</b>\n\n` +
            `Use /link to connect your Telegram instead!\n\n` +
            `It's super quick!`;
        } else if (error.message.includes('phone')) {
          errorMessage = `<b>That phone number is already registered!</b>\n\n` +
            `Use /link to connect your Telegram instead!\n\n` +
            `Let's get you connected!`;
        }
      } else {
        errorMessage = `<b>Hmm, registration didn't work</b>\n\n` +
          `Please try again or contact support!\n\n` +
          `<i>We're here to help you!</i>`;
      }

      await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
  }

  async inviteUserToGroup(telegramUserId) {
    if (!this.privateGroupId || !this.bot) return;

    try {
      // Invite user to private group
      await this.bot.addChatMember(this.privateGroupId, telegramUserId);

      logger.info('User invited to private group', { telegramUserId });
    } catch (error) {
      // User might already be in the group, or bot doesn't have permissions
      logger.warn('Could not invite user to group', { telegramUserId, error: error.message });
    }
  }

  /**
   * Get or create invite link for the private group
   */
  async getGroupInviteLink() {
    if (!this.privateGroupId || !this.bot) return null;

    try {
      // Try to export/create invite link
      const inviteLink = await this.bot.exportChatInviteLink(this.privateGroupId);
      return inviteLink;
    } catch (error) {
      // Bot might not have permissions, or link already exists
      logger.warn('Could not create/get invite link', { error: error.message });
      return null;
    }
  }

  /**
   * Send message to private list topic (admin only)
   */
  async sendToPrivateList(message) {
    if (!this.bot || !this.privateGroupId || !this.privateTopicId) {
      throw new Error('Bot or private topic not configured');
    }

    try {
      await this.bot.sendMessage(this.privateGroupId, message, {
        message_thread_id: this.privateTopicId,
        parse_mode: 'HTML'
      });
      return true;
    } catch (error) {
      logger.error('Error sending to private list:', error);
      throw error;
    }
  }

  /**
   * Send message to public list topic (all members)
   */
  async sendToPublicList(message) {
    if (!this.bot || !this.privateGroupId || !this.publicTopicId) {
      throw new Error('Bot or public topic not configured');
    }

    try {
      await this.bot.sendMessage(this.privateGroupId, message, {
        message_thread_id: this.publicTopicId,
        parse_mode: 'HTML'
      });
      return true;
    } catch (error) {
      logger.error('Error sending to public list:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  stop() {
    if (this.bot && this.bot.stopPolling) {
      this.bot.stopPolling();
      logger.info('Telegram bot stopped');
    }
  }
}

// Export singleton instance
let botServiceInstance = null;

function getTelegramBotService() {
  if (!botServiceInstance && process.env.TELEGRAM_BOT_TOKEN) {
    botServiceInstance = new TelegramBotService();
  }
  return botServiceInstance;
}

module.exports = {
  TelegramBotService,
  getTelegramBotService
};