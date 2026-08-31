const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

const jsonPath = path.join(__dirname, '../data/notifications.json');

function getNotifications() {
  if (!fs.existsSync(jsonPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function saveNotifications(data) {
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    const list = getNotifications();
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    logger.error('Get notifications error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to retrieve notifications' });
  }
});

/**
 * @route   POST /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Authenticated (was fully public - actively used by customer-dashboard's
 *          own notifications page, so requiring login, not admin, matches real usage)
 */
router.post('/read-all', authMiddleware.authenticate, (req, res) => {
  try {
    const list = getNotifications();
    const updated = list.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('Read all notifications error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Authenticated (was fully public)
 */
router.patch('/:id/read', authMiddleware.authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const list = getNotifications();
    const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('Read notification error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Authenticated (was fully public)
 */
router.delete('/:id', authMiddleware.authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const list = getNotifications();
    const updated = list.filter(n => n.id !== id);
    saveNotifications(updated);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('Delete notification error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

module.exports = router;
