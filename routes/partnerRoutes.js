const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

const jsonPath = path.join(__dirname, '../data/partners.json');

/**
 * @route   GET /api/partners
 * @desc    Get all ecosystem partners
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(jsonPath)) {
      return res.status(200).json({ success: true, data: [] });
    }
    const fileData = fs.readFileSync(jsonPath, 'utf8');
    const partners = JSON.parse(fileData);
    return res.status(200).json({
      success: true,
      data: partners
    });
  } catch (err) {
    logger.error('Get partners error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve partners'
    });
  }
});

/**
 * @route   POST /api/partners
 * @desc    Register a new partner organization
 * @access  Authenticated (was fully public - actively used by customer-dashboard's
 *          own Partner Portal "Register as an Ecosystem Partner" form by regular
 *          logged-in customers, so requiring login, not admin, matches real usage)
 */
router.post('/', authMiddleware.authenticate, (req, res) => {
  try {
    const { name, type, website } = req.body;
    if (!name || !website) {
      return res.status(400).json({ success: false, error: 'Name and website are required' });
    }

    let partners = [];
    if (fs.existsSync(jsonPath)) {
      partners = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }

    const newPartner = {
      id: `partner_${Date.now()}`,
      name,
      type: type || 'Recruiter',
      website,
      logo: '',
      // Self-submitted registrations start unverified - verification is a
      // separate admin action, not something a submitter can grant themselves.
      verified: false
    };

    partners.push(newPartner);
    fs.writeFileSync(jsonPath, JSON.stringify(partners, null, 2), 'utf8');

    return res.status(201).json({
      success: true,
      data: newPartner
    });
  } catch (err) {
    logger.error('Create partner error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to register partner'
    });
  }
});

module.exports = router;
