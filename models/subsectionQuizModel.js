// models/subsectionQuizModel.js
const db = require('../config/database');

const SubsectionQuiz = {
  async getQuestions(subsection_id, conn = null, randomize = true) {
    const cx = conn || db;
    const [qs] = await cx.query(
      `SELECT id AS question_id, prompt_html, sort_order
         FROM subsection_quiz_questions
        WHERE subsection_id = ?
        ORDER BY ${randomize ? 'RAND()' : 'sort_order ASC, id ASC'}`,
      [subsection_id]
    );
    if (qs.length === 0) return [];

    const qIds = qs.map(q => q.question_id);
    const [opts] = await cx.query(
      `SELECT id AS option_id, question_id, text_html, is_correct, sort_order
         FROM subsection_quiz_options
        WHERE question_id IN (?)
        ORDER BY question_id ASC, ${randomize ? 'RAND()' : 'sort_order ASC, id ASC'}`,
      [qIds]
    );

    const byQ = new Map(qs.map(q => [q.question_id, { ...q, options: [] }]));
    for (const o of opts) {
      const q = byQ.get(o.question_id);
      if (q) q.options.push({
        option_id: o.option_id,
        text_html: o.text_html,
        sort_order: o.sort_order
      });
    }
    return Array.from(byQ.values());
  },
async getQuestionsAdmin(subsection_id, conn = null) {
    const cx = conn || db;
    const [qs] = await cx.query(
      `SELECT id AS question_id, prompt_html, sort_order
         FROM subsection_quiz_questions
        WHERE subsection_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [subsection_id]
    );
    if (qs.length === 0) return [];

    const qIds = qs.map(q => q.question_id);
    const [opts] = await cx.query(
      `SELECT id AS option_id, question_id, text_html, is_correct, sort_order
         FROM subsection_quiz_options
        WHERE question_id IN (?)
        ORDER BY question_id ASC, sort_order ASC, id ASC`,
      [qIds]
    );

    const byQ = new Map(qs.map(q => [q.question_id, { ...q, options: [] }]));
    for (const o of opts) {
      const host = byQ.get(o.question_id);
      if (host) {
        host.options.push({
          option_id: o.option_id,
          text_html: o.text_html,
          is_correct: !!o.is_correct,   // include correct flag
          sort_order: o.sort_order
        });
      }
    }
    return Array.from(byQ.values());
  },
  // ---------- NEW: authoring helpers ----------
  async createQuestion({ subsection_id, prompt_html, sort_order = 0 }, conn = null) {
    const cx = conn || db;
    const [res] = await cx.query(
      `INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
       VALUES (?, ?, ?)`,
      [subsection_id, prompt_html, sort_order]
    );
    return res.insertId;
  },

  async createOptionsBulk(question_id, options = [], conn = null) {
    const cx = conn || db;
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

    const [res] = await cx.query(
      `INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
       VALUES ${placeholders}`,
      params
    );

    const firstId = res.insertId || null;
    const count = res.affectedRows || 0;
    const ids = firstId ? Array.from({ length: count }, (_, i) => firstId + i) : [];
    return { inserted: count, ids };
  },
  // -------------------------------------------

  /**
   * Grade answers for a subsection quiz.
   * answers can be:
   *   - Array<{question_id, option_id}>
   *   - Object { [question_id]: option_id }
   */
  async gradeAnswers(subsection_id, answers, conn = null) {
    const cx = conn || db;

    let pairs = [];
    if (Array.isArray(answers)) {
      pairs = answers
        .filter(a => a && a.question_id && a.option_id)
        .map(a => ({ question_id: Number(a.question_id), option_id: Number(a.option_id) }));
    } else if (answers && typeof answers === 'object') {
      pairs = Object.entries(answers)
        .map(([qid, oid]) => ({ question_id: Number(qid), option_id: Number(oid) }))
        .filter(p => !Number.isNaN(p.question_id) && !Number.isNaN(p.option_id));
    }

    const [allQs] = await cx.query(
      `SELECT id AS question_id
         FROM subsection_quiz_questions
        WHERE subsection_id = ?`,
      [subsection_id]
    );
    const totalQuestions = allQs.length;
    if (totalQuestions === 0) return { total: 0, correct: 0, score: 0 };

    const qIdSet = new Set(allQs.map(x => x.question_id));
    const filtered = pairs.filter(p => qIdSet.has(p.question_id));
    if (filtered.length === 0) return { total: totalQuestions, correct: 0, score: 0 };

    const uniqQids = Array.from(new Set(filtered.map(p => p.question_id)));
    const [correctRows] = await cx.query(
      `SELECT id AS option_id
         FROM subsection_quiz_options
        WHERE is_correct = 1
          AND question_id IN (?)`,
      [uniqQids]
    );
    const correctSet = new Set(correctRows.map(r => r.option_id));

    const chosenOptionIds = new Set(filtered.map(p => p.option_id));
    let correct = 0;
    for (const optId of chosenOptionIds) if (correctSet.has(optId)) correct += 1;

    const score = Math.round((correct / totalQuestions) * 100);
    return { total: totalQuestions, correct, score };
  }
};

module.exports = SubsectionQuiz;
