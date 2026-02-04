// controllers/eventController.js
const Event = require('../models/Event');
const logger = require('../utils/logger');

const eventController = {
  /**
   * Get all events (Client - active only)
   * GET /api/events
   */
  async getAllEvents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        month,
        year,
        start_date,
        end_date
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        start_date,
        end_date
      };

      const result = await Event.findAll(filters);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Event getAllEvents error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get event by ID (Client)
   * GET /api/events/:id
   */
  async getEventById(req, res) {
    try {
      const eventId = parseInt(req.params.id);

      if (!eventId || isNaN(eventId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid event ID is required',
          code: 'INVALID_EVENT_ID'
        });
      }

      const event = await Event.findById(eventId);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Event getEventById error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch event',
        code: 'SERVER_ERROR'
      });
    }
  }
};

module.exports = eventController;


