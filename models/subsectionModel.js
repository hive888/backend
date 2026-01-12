const db = require('../config/database');
const logger = require('../utils/logger');

class Subsection {
  async getAll({ page = 1, limit = 300, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      
      const [subsections] = await db.query(
        `SELECT ss.*, s.title as section_title, c.title as chapter_title 
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         ORDER BY ss.${sortBy} ${order}
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
      
      const [subsections] = await db.query(
        `SELECT ss.*, s.title as section_title, c.title as chapter_title 
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE ss.section_id = ?
         ORDER BY ss.${sortBy} ${order}
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

  async create({ section_id, title, content_html, sort_order = 0 }) {
    try {
      const [result] = await db.query(
        `INSERT INTO subsections (section_id, title, content_html, sort_order) VALUES (?, ?, ?, ?)`,
        [section_id, title, content_html, sort_order]
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

  async update(id, { section_id, title, content_html, sort_order }) {
    try {
      const [result] = await db.query(
        `UPDATE subsections SET section_id = ?, title = ?, content_html = ?, sort_order = ? WHERE id = ?`,
        [section_id, title, content_html, sort_order, id]
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