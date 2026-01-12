
const db = require('../config/database');

const SectionQuizStatus = {
  // ===== Status for a (customer, subsection) pair =====
  async get(customer_id, subsection_id /* stored in column `section_id` */) {
    const [rows] = await db.query(
      `SELECT status, score, attempts, last_attempt_at
         FROM customer_section_quiz_status
        WHERE customer_id = ? AND section_id = ?
        LIMIT 1`,
      [customer_id, subsection_id]
    );
    return rows[0] || { status: 'not_started', score: 0, attempts: 0, last_attempt_at: null };
  },

  async recordResult(customer_id, subsection_id /* stored in column `section_id` */, score, pass) {
    const status = pass ? 'passed' : 'failed';
    const [result] = await db.query(
      `INSERT INTO customer_section_quiz_status
         (customer_id, section_id, status, score, attempts, last_attempt_at)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         score = VALUES(score),
         attempts = attempts + 1,
         last_attempt_at = NOW()`,
      [customer_id, subsection_id, status, score]
    );
    return result.affectedRows > 0;
  },

  // ===== Quiz authoring & reading (subsection level) =====

  // Return all questions with their options for a subsection
  async getQuizBySubsection(subsection_id) {
    const [qs] = await db.query(
      `SELECT id, subsection_id, prompt_html, sort_order
         FROM subsection_quiz_questions
        WHERE subsection_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [subsection_id]
    );

    if (qs.length === 0) return [];

    const qIds = qs.map(q => q.id);
    const [opts] = await db.query(
      `SELECT id, question_id, text_html, is_correct, sort_order
         FROM subsection_quiz_options
        WHERE question_id IN (?)
        ORDER BY question_id ASC, sort_order ASC, id ASC`,
      [qIds]
    );

    const byQ = new Map(qs.map(q => [q.id, { ...q, options: [] }]));
    for (const o of opts) {
      const host = byQ.get(o.question_id);
      if (host) host.options.push(o);
    }
    return Array.from(byQ.values());
  },

  // --- Single question helpers ---
  async getQuestionById(question_id) {
    const [rows] = await db.query(
      `SELECT id, subsection_id, prompt_html, sort_order
         FROM subsection_quiz_questions
        WHERE id = ?
        LIMIT 1`,
      [question_id]
    );
    return rows[0] || null;
  },

  async createQuestion({ subsection_id, prompt_html, sort_order = 0 }) {
    const [res] = await db.query(
      `INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
       VALUES (?, ?, ?)`,
      [subsection_id, prompt_html, sort_order]
    );
    return res.insertId;
  },

  async updateQuestion(question_id, { prompt_html, sort_order } = {}) {
    const sets = [];
    const vals = [];
    if (prompt_html !== undefined) { sets.push('prompt_html = ?'); vals.push(prompt_html); }
    if (sort_order !== undefined)  { sets.push('sort_order  = ?'); vals.push(sort_order); }
    if (sets.length === 0) return false;

    vals.push(question_id);
    const [res] = await db.query(
      `UPDATE subsection_quiz_questions
          SET ${sets.join(', ')}
        WHERE id = ?`,
      vals
    );
    return res.affectedRows > 0;
  },

  async deleteQuestion(question_id) {
    await db.query(`DELETE FROM subsection_quiz_options WHERE question_id = ?`, [question_id]);
    const [res] = await db.query(`DELETE FROM subsection_quiz_questions WHERE id = ?`, [question_id]);
    return res.affectedRows > 0;
  },

  // --- Single option helpers ---
  async getOptionById(option_id) {
    const [rows] = await db.query(
      `SELECT id, question_id, text_html, is_correct, sort_order
         FROM subsection_quiz_options
        WHERE id = ?
        LIMIT 1`,
      [option_id]
    );
    return rows[0] || null;
  },

  async createOption({ question_id, text_html, is_correct = 0, sort_order = 0 }) {
    const [res] = await db.query(
      `INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
       VALUES (?, ?, ?, ?)`,
      [question_id, text_html, is_correct ? 1 : 0, sort_order]
    );
    return res.insertId;
  },

  // Bulk create options for a given question
  async createOptionsBulk(question_id, options = []) {
    if (!Array.isArray(options) || options.length === 0) {
      return { inserted: 0, ids: [] };
    }
    const cleaned = options.map(o => ({
      text_html: o.text_html ?? '',
      is_correct: o.is_correct ? 1 : 0,
      sort_order: o.sort_order ?? 0
    }));

    const placeholders = cleaned.map(() => '(?, ?, ?, ?)').join(', ');
    const params = [];
    for (const o of cleaned) {
      params.push(question_id, o.text_html, o.is_correct, o.sort_order);
    }

    const [res] = await db.query(
      `INSERT INTO subsection_quiz_options
        (question_id, text_html, is_correct, sort_order)
       VALUES ${placeholders}`,
      params
    );

    const firstId = res.insertId || null;
    const count = res.affectedRows || 0;
    const ids = firstId ? Array.from({ length: count }, (_, i) => firstId + i) : [];
    return { inserted: count, ids };
  },

  async updateOption(option_id, { text_html, is_correct, sort_order } = {}) {
    const sets = [];
    const vals = [];
    if (text_html !== undefined)  { sets.push('text_html = ?');  vals.push(text_html); }
    if (is_correct !== undefined) { sets.push('is_correct = ?'); vals.push(is_correct ? 1 : 0); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
    if (sets.length === 0) return false;

    vals.push(option_id);
    const [res] = await db.query(
      `UPDATE subsection_quiz_options
          SET ${sets.join(', ')}
        WHERE id = ?`,
      vals
    );
    return res.affectedRows > 0;
  },

  async deleteOption(option_id) {
    const [res] = await db.query(`DELETE FROM subsection_quiz_options WHERE id = ?`, [option_id]);
    return res.affectedRows > 0;
  }
};

module.exports = SectionQuizStatus;
