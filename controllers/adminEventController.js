// controllers/adminEventController.js
const Event = require('../models/Event');
const logger = require('../utils/logger');

const adminEventController = {
  /**
   * Get all events (Admin - includes deleted)
   * GET /api/admin/events
   */
  async getAllEvents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        start_date,
        end_date
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        start_date,
        end_date
      };

      const result = await Event.findAllAdmin(filters);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin Event getAllEvents error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get event by ID (Admin)
   * GET /api/admin/events/:id
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

      // Admin can see deleted events, so we need a different query
      const db = require('../config/database');
      const [rows] = await db.query(`
        SELECT 
          event_id,
          event_name,
          event_date,
          short_description,
          detailed_content,
          created_at,
          updated_at,
          deleted_at
        FROM events
        WHERE event_id = ?
      `, [eventId]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      logger.error('Admin Event getEventById error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Create event
   * POST /api/admin/events
   */
  async createEvent(req, res) {
    try {
      const { event_name, event_date, short_description, detailed_content } = req.body;

      if (!event_name || !event_date || !short_description || !detailed_content) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required: event_name, event_date, short_description, detailed_content',
          code: 'MISSING_FIELDS'
        });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(event_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      const eventId = await Event.create({
        event_name,
        event_date,
        short_description,
        detailed_content
      });

      const event = await Event.findById(eventId);

      logger.info('Event created', {
        eventId,
        event_name,
        adminId: req.user.user_id
      });

      return res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event
      });
    } catch (error) {
      logger.error('Admin Event createEvent error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update event
   * PUT /api/admin/events/:id
   */
  async updateEvent(req, res) {
    try {
      const eventId = parseInt(req.params.id);
      const { event_name, event_date, short_description, detailed_content } = req.body;

      if (!eventId || isNaN(eventId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid event ID is required',
          code: 'INVALID_EVENT_ID'
        });
      }

      if (!event_name || !event_date || !short_description || !detailed_content) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required: event_name, event_date, short_description, detailed_content',
          code: 'MISSING_FIELDS'
        });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(event_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      const exists = await Event.findById(eventId);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      const updated = await Event.update(eventId, {
        event_name,
        event_date,
        short_description,
        detailed_content
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Event not found or could not be updated',
          code: 'UPDATE_FAILED'
        });
      }

      const event = await Event.findById(eventId);

      logger.info('Event updated', {
        eventId,
        adminId: req.user.user_id
      });

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully',
        data: event
      });
    } catch (error) {
      logger.error('Admin Event updateEvent error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Delete event
   * DELETE /api/admin/events/:id
   */
  async deleteEvent(req, res) {
    try {
      const eventId = parseInt(req.params.id);

      if (!eventId || isNaN(eventId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid event ID is required',
          code: 'INVALID_EVENT_ID'
        });
      }

      const exists = await Event.findById(eventId);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      const deleted = await Event.delete(eventId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Event not found or could not be deleted',
          code: 'DELETE_FAILED'
        });
      }

      logger.info('Event deleted', {
        eventId,
        adminId: req.user.user_id
      });

      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      logger.error('Admin Event deleteEvent error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        code: 'SERVER_ERROR'
      });
    }
  }
};

module.exports = adminEventController;


