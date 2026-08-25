// config/chapaConfig.js
const axios = require('axios');
const logger = require('../utils/logger');

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';
const chapaSecretKey = process.env.CHAPA_SECRET_KEY;

if (!chapaSecretKey) {
  logger.warn('CHAPA_SECRET_KEY is not set. Access codes preferring Chapa will fail to create checkout sessions until it is configured.');
}

const chapaClient = axios.create({
  baseURL: CHAPA_BASE_URL,
  headers: chapaSecretKey ? { Authorization: `Bearer ${chapaSecretKey}` } : {},
  timeout: 15000,
});

module.exports = { chapaClient, chapaSecretKey };
