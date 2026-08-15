const db = require('../config/database');
const logger = require('../utils/logger');

const ALLOWED_SORT = new Set(['sort_order', 'id', 'title', 'created_at', 'updated_at']);

function safeSort(sortBy, order) {
  const column = ALLOWED_SORT.has(sortBy) ? sortBy : 'sort_order';
  const direction = String(order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return { column, direction };
}

function normalizePdfUrl(pdf_url) {
  if (pdf_url == null) return null;
  const trimmed = String(pdf_url).trim();
  return trimmed || null;
}

class Subsection {
  async getAll({ page = 1, limit = 300, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      const { column, direction } = safeSort(sortBy, order);
      
      const [subsections] = await db.query(
        `SELECT ss.*, s.title as section_title, c.title as chapter_title 
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         ORDER BY ss.${column} ${direction}
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM subsections`
      );

      return {
        subsections,
        total: count[0].total
      };
    } catch (err) {
      logger.error('Failed to get subsections:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async getBySectionId(sectionId, { page = 1, limit = 300, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      const { column, direction } = safeSort(sortBy, order);
      
      const [subsections] = await db.query(
        `SELECT ss.*, s.title as section_title, c.title as chapter_title 
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE ss.section_id = ?
         ORDER BY ss.${column} ${direction}
         LIMIT ? OFFSET ?`,
        [sectionId, limit, offset]
      );

      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM subsections WHERE section_id = ?`,
        [sectionId]
      );

      return {
        subsections,
        total: count[0].total
      };
    } catch (err) {
      logger.error('Failed to get subsections by section:', {
        error: err.message,
        stack: err.stack,
        sectionId
      });
      throw err;
    }
  }

  async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT ss.*, s.title as section_title, c.title as chapter_title 
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE ss.id = ?`,
        [id]
      );
      return rows[0];
    } catch (err) {
      logger.error('Find subsection by ID failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }

  async create({ section_id, title, content_html, pdf_url = null, sort_order = 0, quiz_required = 0, quiz_pass_score = 70 }) {
    try {
      const [result] = await db.query(
        `INSERT INTO subsections (section_id, title, content_html, pdf_url, sort_order, quiz_required, quiz_pass_score) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [section_id, title, content_html, normalizePdfUrl(pdf_url), sort_order, quiz_required, quiz_pass_score]
      );
      return result.insertId;
    } catch (err) {
      logger.error('Subsection creation failed:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async update(id, { section_id, title, content_html, pdf_url = null, sort_order, quiz_required = 0, quiz_pass_score = 70 }) {
    try {
      const [result] = await db.query(
        `UPDATE subsections SET section_id = ?, title = ?, content_html = ?, pdf_url = ?, sort_order = ?, quiz_required = ?, quiz_pass_score = ? WHERE id = ?`,
        [section_id, title, content_html, normalizePdfUrl(pdf_url), sort_order, quiz_required, quiz_pass_score, id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Subsection update failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }

  async delete(id) {
    try {
      const [result] = await db.query(
        `DELETE FROM subsections WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Subsection deletion failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }
async getNextIdInSection(currentId) {
  try {
    // Verify the current subsection exists
    const currentQuery = `SELECT id FROM subsections WHERE id = ? LIMIT 1`;
    console.log('Current subsection query:', currentQuery);
    console.log('Current subsection parameters:', [currentId]);
    
    const [curRows] = await db.query(currentQuery, [currentId]);
    console.log('Current subsection result:', curRows);
    
    if (curRows.length === 0) return null;

    // Find the next subsection by ID only
    const nextQuery = `SELECT id FROM subsections WHERE id > ? ORDER BY id ASC LIMIT 1`;
    console.log('Next subsection query:', nextQuery);
    console.log('Next subsection parameters:', [currentId]);
    
    const [rows] = await db.query(nextQuery, [currentId]);
    console.log('Next subsection result:', rows);

    return rows[0]?.id || null;
  } catch (err) {
    logger.error('Failed to get next subsection:', {
      error: err.message,
      stack: err.stack,
      currentId
    });
    throw err;
  }
}
}

module.exports = new Subsection();