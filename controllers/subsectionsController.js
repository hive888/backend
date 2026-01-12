const Subsection = require('../models/subsectionModel');
const logger = require('../utils/logger');

class SubsectionsController {
  async getAllSubsections(req, res) {
    try {
      const { page = 1, limit = 400, sortBy = 'sort_order', order = 'ASC' } = req.query;
      const { subsections, total } = await Subsection.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        order
      });

      return res.json({
        success: true,
        data: subsections,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get subsections:', {
        error: err.message,
        stack: err.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get subsections'
      });
    }
  }

  async getSubsectionsBySection(req, res) {
    try {
      const { sectionId } = req.params;
      const { page = 1, limit = 400, sortBy = 'sort_order', order = 'ASC' } = req.query;
      
      const { subsections, total } = await Subsection.getBySectionId(sectionId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        order
      });

      return res.json({
        success: true,
        data: subsections,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get subsections by section:', {
        error: err.message,
        stack: err.stack,
        sectionId: req.params.sectionId
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get subsections by section'
      });
    }
  }

  async getSubsectionById(req, res) {
    try {
      const { id } = req.params;
      const subsection = await Subsection.getById(id);

      if (!subsection) {
        return res.status(404).json({
          success: false,
          message: 'Subsection not found'
        });
      }

      return res.json({
        success: true,
        data: subsection
      });
    } catch (err) {
      logger.error('Failed to get subsection:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get subsection'
      });
    }
  }

  async createSubsection(req, res) {
    try {
      const { section_id, title, content_html, sort_order = 0 } = req.body;

      // Basic validation
      if (!section_id || !title || !content_html) {
        return res.status(400).json({
          success: false,
          message: 'Section ID, title, and content are required'
        });
      }

      const subsectionId = await Subsection.create({
        section_id,
        title,
        content_html,
        sort_order
      });

      return res.status(201).json({
        success: true,
        data: { id: subsectionId },
        message: 'Subsection created successfully'
      });
    } catch (err) {
      logger.error('Subsection creation failed:', {
        error: err.message,
        stack: err.stack,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Subsection with this title already exists in this section'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create subsection'
      });
    }
  }

  async updateSubsection(req, res) {
    try {
      const { id } = req.params;
      const { section_id, title, content_html, sort_order } = req.body;

      // Check if subsection exists
      const subsection = await Subsection.getById(id);
      if (!subsection) {
        return res.status(404).json({
          success: false,
          message: 'Subsection not found'
        });
      }

      const updated = await Subsection.update(id, {
        section_id,
        title,
        content_html,
        sort_order
      });

      return res.json({
        success: true,
        data: { updated },
        message: 'Subsection updated successfully'
      });
    } catch (err) {
      logger.error('Subsection update failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Subsection with this title already exists in this section'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update subsection'
      });
    }
  }

  async deleteSubsection(req, res) {
    try {
      const { id } = req.params;

      // Check if subsection exists
      const subsection = await Subsection.getById(id);
      if (!subsection) {
        return res.status(404).json({
          success: false,
          message: 'Subsection not found'
        });
      }

      const deleted = await Subsection.delete(id);

      return res.json({
        success: true,
        data: { deleted },
        message: 'Subsection deleted successfully'
      });
    } catch (err) {
      logger.error('Subsection deletion failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to delete subsection'
      });
    }
  }
}

module.exports = new SubsectionsController();