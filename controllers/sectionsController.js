const Section = require('../models/sectionModel');
const logger = require('../utils/logger');

class SectionsController {
  async getAllSections(req, res) {
    try {
      const { page = 1, limit = 400, sortBy = 'sort_order', order = 'ASC' } = req.query;
      const { sections, total } = await Section.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        order
      });

      return res.json({
        success: true,
        data: sections,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get sections:', {
        error: err.message,
        stack: err.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get sections'
      });
    }
  }

  async getSectionsByChapter(req, res) {
    try {
      const { chapterId } = req.params;
      const { page = 1, limit = 400, sortBy = 'sort_order', order = 'ASC' } = req.query;
      
      const { sections, total } = await Section.getByChapterId(chapterId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        order
      });

      return res.json({
        success: true,
        data: sections,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get sections by chapter:', {
        error: err.message,
        stack: err.stack,
        chapterId: req.params.chapterId
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get sections by chapter'
      });
    }
  }

  async getSectionById(req, res) {
    try {
      const { id } = req.params;
      const section = await Section.getById(id);

      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      return res.json({
        success: true,
        data: section
      });
    } catch (err) {
      logger.error('Failed to get section:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get section'
      });
    }
  }

  async createSection(req, res) {
    try {
      const { chapter_id, title, subtitle, sort_order = 0 } = req.body;

      // Basic validation
      if (!chapter_id || !title) {
        return res.status(400).json({
          success: false,
          message: 'Chapter ID and title are required'
        });
      }

      const sectionId = await Section.create({
        chapter_id,
        title,
        subtitle,
        sort_order
      });

      return res.status(201).json({
        success: true,
        data: { id: sectionId },
        message: 'Section created successfully'
      });
    } catch (err) {
      logger.error('Section creation failed:', {
        error: err.message,
        stack: err.stack,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Section with this title already exists in this chapter'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create section'
      });
    }
  }

  async updateSection(req, res) {
    try {
      const { id } = req.params;
      const { chapter_id, title, subtitle, sort_order } = req.body;

      // Check if section exists
      const section = await Section.getById(id);
      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      const updated = await Section.update(id, {
        chapter_id,
        title,
        subtitle,
        sort_order
      });

      return res.json({
        success: true,
        data: { updated },
        message: 'Section updated successfully'
      });
    } catch (err) {
      logger.error('Section update failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Section with this title already exists in this chapter'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update section'
      });
    }
  }

  async deleteSection(req, res) {
    try {
      const { id } = req.params;

      // Check if section exists
      const section = await Section.getById(id);
      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      const deleted = await Section.delete(id);

      return res.json({
        success: true,
        data: { deleted },
        message: 'Section deleted successfully'
      });
    } catch (err) {
      logger.error('Section deletion failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to delete section'
      });
    }
  }
}

module.exports = new SectionsController();