const Chapter = require('../models/chapterModel');
const logger = require('../utils/logger');

class ChaptersController {
  async getAllChapters(req, res) {
    try {
      const { page = 1, limit = 200, sortBy = 'sort_order', order = 'ASC', courseId = null, course_id = null } = req.query;
      const parsedCourseId = courseId || course_id ? parseInt(courseId || course_id) : null;

      const { chapters, total } = await Chapter.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy: sortBy,
        order: order,
        courseId: parsedCourseId
      });

      return res.json({
        success: true,
        data: chapters,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Failed to get chapters:', {
        error: err.message,
        stack: err.stack
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get chapters'
      });
    }
  }

  async getChapterById(req, res) {
    try {
      const { id } = req.params;
      const chapter = await Chapter.getById(id);

      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chapter not found'
        });
      }

      return res.json({
        success: true,
        data: chapter
      });
    } catch (err) {
      logger.error('Failed to get chapter:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to get chapter'
      });
    }
  }

  async createChapter(req, res) {
    try {
      const { title, sort_order = 0, course_id } = req.body;

      // Basic validation
      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      const chapterId = await Chapter.create({
        title,
        sort_order: parseInt(sort_order),
        course_id: course_id ? parseInt(course_id) : null
      });

      return res.status(201).json({
        success: true,
        data: { id: chapterId },
        message: 'Chapter created successfully'
      });
    } catch (err) {
      logger.error('Chapter creation failed:', {
        error: err.message,
        stack: err.stack,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Chapter with this title already exists'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create chapter'
      });
    }
  }

  async updateChapter(req, res) {
    try {
      const { id } = req.params;
      const { title, sort_order, course_id } = req.body;

      // Check if chapter exists
      const chapter = await Chapter.getById(id);
      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chapter not found'
        });
      }

      const updated = await Chapter.update(id, {
        title,
        sort_order: sort_order !== undefined ? parseInt(sort_order) : undefined,
        course_id: course_id !== undefined ? (course_id ? parseInt(course_id) : null) : undefined
      });

      return res.json({
        success: true,
        data: { updated },
        message: 'Chapter updated successfully'
      });
    } catch (err) {
      logger.error('Chapter update failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id,
        body: req.body
      });

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Chapter with this title already exists'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update chapter'
      });
    }
  }

  async deleteChapter(req, res) {
    try {
      const { id } = req.params;

      // Check if chapter exists
      const chapter = await Chapter.getById(id);
      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chapter not found'
        });
      }

      const deleted = await Chapter.delete(id);

      return res.json({
        success: true,
        data: { deleted },
        message: 'Chapter deleted successfully'
      });
    } catch (err) {
      logger.error('Chapter deletion failed:', {
        error: err.message,
        stack: err.stack,
        id: req.params.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to delete chapter'
      });
    }
  }
}

module.exports = new ChaptersController();