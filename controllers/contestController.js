const logger = require('../utils/logger');
const Contest = require('../models/Contest');
const ContestRegistration = require('../models/ContestRegistration');
const ContestMetricsCurrent = require('../models/ContestMetricsCurrent');
const vault = require('../utils/cryptoVault');
exports.createContest = async (req, res) => {
  try {
    const { slug, description, type } = req.body || {};
    if (!slug || !description || !type) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'slug, description, and type are required.'
      });
    }

    const exists = await Contest.findBySlug(slug);
    if (exists) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE',
        message: 'A contest with this slug already exists.'
      });
    }

    const id = await Contest.create({ slug: String(slug).trim(), description, type });
    return res.status(201).json({ success: true, id });
  } catch (err) {
    logger.error('createContest error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// List contests
// ---------------------------
exports.listContests = async (_req, res) => {
  try {
    const rows = await Contest.listAll();
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    logger.error('listContests error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Get contest by slug
// ---------------------------
exports.getContestBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const row = await Contest.findBySlug(slug);
    if (!row) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Contest not found.' });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    logger.error('getContestBySlug error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Update contest by slug (admin)
// ---------------------------
exports.updateContestBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { description, type } = req.body || {};

    const row = await Contest.findBySlug(slug);
    if (!row) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Contest not found.' });
    }

    await Contest.updateById(row.id, { description, type });
    const updated = await Contest.findById(row.id);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('updateContestBySlug error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Delete contest by slug (admin)
// ---------------------------
exports.deleteContestBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const row = await Contest.findBySlug(slug);
    if (!row) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Contest not found.' });
    }

    await Contest.deleteById(row.id);
    return res.status(200).json({ success: true, message: 'Contest deleted.' });
  } catch (err) {
    logger.error('deleteContestBySlug error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Admin helper: list registrations (+ latest metrics) for a contest
// ---------------------------
exports.listRegistrationsByContest = async (req, res) => {
  try {
    const { slug } = req.params;
    const contest = await Contest.findBySlug(slug);
    if (!contest) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Contest not found.' });
    }
    const rows = await ContestRegistration.listByContest(contest.id);
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    logger.error('listRegistrationsByContest error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Join contest (participant)
// payload: { contestId, country, binanceApiKey?, binanceSecretKey? }
// ---------------------------
exports.joinContest = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    const { contestId, country, binanceApiKey, binanceSecretKey } = req.body || {};

    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!contestId || !country) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'contestId and country are required.'
      });
    }

    const contest = await Contest.findBySlug(contestId);
    if (!contest) {
      return res.status(404).json({ success: false, code: 'CONTEST_NOT_FOUND', message: 'Contest not found.' });
    }

    // idempotent: one registration per (contest, customer)
    const existing = await ContestRegistration.findByContestAndCustomer(contest.id, customerId);
    if (existing) {
      return res.status(200).json({ success: true, message: 'Already registered.', registration_id: existing.id });
    }

    // Encrypt API keys (optional inputs)
    let apiKeyCipher = null, secretCipher = null, apiKeyLast4 = null;
    if (binanceApiKey) {
      apiKeyCipher = vault.encryptToBuffer(binanceApiKey);
      apiKeyLast4 = String(binanceApiKey).slice(-4);
    }
    if (binanceSecretKey) {
      secretCipher = vault.encryptToBuffer(binanceSecretKey);
    }

    const registrationId = await ContestRegistration.create({
      contest_id: contest.id,
      customer_id: customerId,
      country,
      binance_api_key_cipher: apiKeyCipher,
      binance_secret_cipher: secretCipher,
      api_key_last4: apiKeyLast4,
      exchange_user_id: null,
      exchange_username: null
    });

    return res.status(201).json({
      success: true,
      message: 'Joined contest successfully.',
      registration_id: registrationId,
      contest: { id: contest.id, slug: contest.slug, description: contest.description, type: contest.type }
    });
  } catch (err) {
    // If UNIQUE (contest_id, customer_id) triggers, treat as already registered
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({ success: true, message: 'Already registered (duplicate).' });
    }
    logger.error('joinContest error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// My contests + latest metrics (participant)
// ---------------------------
exports.getMyContestStatus = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }

    const regs = await ContestRegistration.findByCustomer(customerId);
    const result = [];
    for (const r of regs) {
      const metrics = await ContestMetricsCurrent.getByRegistrationId(r.id);
      result.push({
        registration_id: r.id,
        contest: {
          id: r.contest_id,
          slug: r.contest_slug,
          description: r.contest_description,
          type: r.contest_type
        },
        country: r.country,
        api_key_last4: r.api_key_last4 || null,
        status: r.status,
        latest_metrics: metrics ? {
          totalWalletBalance: Number(metrics.total_wallet_balance),
          totalUnrealizedProfit: Number(metrics.total_unrealized_profit),
          netProfit: Number(metrics.net_profit),
          tradesCount: metrics.trades_count,
          lastUpdated: metrics.last_updated_utc
        } : null
      });
    }
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error('getMyContestStatus error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

// ---------------------------
// Leaderboard (by slug)
// Orders by net_profit desc, total_wallet_balance desc, trades_count desc
// ---------------------------
// controllers/contestController.js
exports.getLeaderboardBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Safe limit parsing with cap
    const limitRaw = req.query.limit;
    const limitParsed = Number.parseInt(limitRaw, 10);
    const limit = Math.min(Number.isFinite(limitParsed) ? limitParsed : 100, 500);

    // Optional country filter (?country=Ethiopia)
    const country = typeof req.query.country === 'string' && req.query.country.trim().length
      ? req.query.country.trim()
      : null;

    const contest = await Contest.findBySlug(slug);
    if (!contest) {
      return res.status(404).json({
        success: false,
        code: 'CONTEST_NOT_FOUND',
        message: 'Contest not found.'
      });
    }

    // Model now supports { limit, country }
    const rows = await ContestMetricsCurrent.leaderboardForContest(contest.id, { limit, country });

    // Helper to preserve nulls (Number(null) => 0, so avoid that)
    const numOrNull = v => (v === null || v === undefined ? null : Number(v));

    return res.status(200).json({
      success: true,
      contest: {
        id: contest.id,
        slug: contest.slug,
        description: contest.description,
        type: contest.type
      },
      // Echo applied filters so the client can display chips/badges
      filters: { country: country || null, limit },
      data: rows.map(r => ({
        rank: r.rank_position,
        registrationId: r.registration_id,
        customerId: r.customer_id,
        country: r.country,
        exchangeUserId: r.exchange_user_id,
        // Your SQL should already do: COALESCE(r.exchange_username, 'Name') AS exchange_username
        exchangeUsername: r.exchange_username,
        netProfit: numOrNull(r.net_profit),
        totalWalletBalance: numOrNull(r.total_wallet_balance),
        totalUnrealizedProfit: numOrNull(r.total_unrealized_profit),
        tradesCount: r.trades_count === null || r.trades_count === undefined ? null : Number(r.trades_count),
        lastUpdated: r.last_updated_utc // keep as-is; DB may return string/Date
      }))
    });
  } catch (err) {
    logger.error('getLeaderboardBySlug error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error.'
    });
  }
};



// ---------------------------
// Upsert metrics (owner only)
// payload: {
//   userId?, username?,
//   totalWalletBalance, totalUnrealizedProfit?, netProfit?,
//   tradesCount?, lastUpdated (ISO)
// }
// ---------------------------
exports.upsertMetricsForRegistration = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    const registrationId = Number(req.params.id);
    const {
      totalWalletBalance,
      totalUnrealizedProfit,
      netProfit,
      tradesCount,
      lastUpdated,
      userId,
      username
    } = req.body || {};

    if (!customerId) {
      return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing user in token.' });
    }
    if (!registrationId) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'Invalid registration id.' });
    }
    if (totalWalletBalance === undefined || !lastUpdated) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'totalWalletBalance and lastUpdated are required.'
      });
    }

    const reg = await ContestRegistration.findById(registrationId);
    if (!reg) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Registration not found.' });
    }
    if (Number(reg.customer_id) !== Number(customerId)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Cannot submit metrics for another user.' });
    }

    // Optionally update saved exchange identity
    if (userId || username) {
      await ContestRegistration.updateExchangeIdentity(registrationId, {
        exchange_user_id: userId || reg.exchange_user_id,
        exchange_username: username || reg.exchange_username
      });
    }

    // Validate types
    const payload = {
      registration_id: registrationId,
      total_wallet_balance: Number(totalWalletBalance),
      total_unrealized_profit: Number(totalUnrealizedProfit ?? 0),
      net_profit: Number(netProfit ?? 0),
      trades_count: Number(tradesCount ?? 0),
      last_updated_utc: new Date(lastUpdated)
    };

    if (
      [payload.total_wallet_balance, payload.total_unrealized_profit, payload.net_profit, payload.trades_count]
        .some(n => Number.isNaN(n))
    ) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'Numeric fields are invalid.' });
    }
    if (Number.isNaN(payload.last_updated_utc.getTime())) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'lastUpdated must be a valid ISO date string.' });
    }

    await ContestMetricsCurrent.upsert(payload);
    return res.status(200).json({ success: true, message: 'Metrics saved.' });
  } catch (err) {
    logger.error('upsertMetricsForRegistration error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};
