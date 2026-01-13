// Load environment variables from .env (required for GOOGLE_CLIENT_ID and other config)
require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const { getTelegramBotService } = require('./services/telegramBotService');
const PORT = process.env.PORT || 3000;

// Start Telegram Bot Service (if token is configured)
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const botService = getTelegramBotService();
    if (botService) {
      logger.info('Telegram Bot Service initialized successfully');
    }
  } catch (error) {
    logger.error('Failed to initialize Telegram Bot Service:', error);
  }
} else {
  logger.warn('TELEGRAM_BOT_TOKEN not configured - Telegram bot service will not start');
}

app.listen(PORT, () => {
  logger.info(`PTGR API running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});