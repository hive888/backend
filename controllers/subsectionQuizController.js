const logger = require('../utils/logger');
const db = require('../config/database');

const Subsection = require('../models/subsectionModel');
const QuizModel = require('../models/sectionQuizStatusModel'); // same model file

// Helpers
function isTruthy(x) {
  if (x === undefined || x === null) return undefined;
  if (x === true || x === 'true' || x === 1 || x === '1') return 1;
  if (x === false || x === 'false' || x === 0 || x === '0') return 0;
  return x; // let DB validate if something else
}

/**
 * GET /api/subsection-quizzes/:subsectionId
 * Returns questions + options for a subsection
 */
exports.listQuiz = async (req, res) => {
  try {
    const subsectionId = Number(req.params.subsectionId);
    if (!subsectionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid subsection id.' });
    }

    // ensure subsection exists
    const ss = await Subsection.getById(subsectionId);
    if (!ss) {
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }

    const questions = await QuizModel.getQuizBySubsection(subsectionId);
    return res.status(200).json({ success: true, data: { subsection_id: subsectionId, questions } });
  } catch (err) {
    logger.error('listQuiz error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * POST /api/subsection-quizzes/:subsectionId/questions
 * Body: { prompt_html, sort_order? }
 */
exports.createQuestion = async (req, res) => {
  try {
    const subsectionId = Number(req.params.subsectionId);
    const { prompt_html, sort_order = 0 } = req.body || {};

    if (!subsectionId || !prompt_html) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'subsectionId and prompt_html are required.' });
    }

    // ensure subsection exists
    const ss = await Subsection.getById(subsectionId);
    if (!ss) {
      return res.status(404).json({ success: false, code: 'SUBSECTION_NOT_FOUND', message: 'Subsection not found.' });
    }

    const id = await QuizModel.createQuestion({ subsection_id: subsectionId, prompt_html, sort_order });
    const created = await QuizModel.getQuestionById(id);
    return res.status(201).json({ success: true, message: 'Question created.', data: created });
  } catch (err) {
    logger.error('createQuestion error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * PUT /api/subsection-quizzes/questions/:questionId
 * Body: { prompt_html?, sort_order? }
 */
exports.updateQuestion = async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const { prompt_html, sort_order } = req.body || {};

    if (!questionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid question id.' });
    }

    const q = await QuizModel.getQuestionById(questionId);
    if (!q) {
      return res.status(404).json({ success: false, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' });
    }

    const updated = await QuizModel.updateQuestion(questionId, { prompt_html, sort_order });
    if (!updated) {
      return res.status(400).json({ success: false, code: 'NOTHING_TO_UPDATE', message: 'No fields to update.' });
    }
    const fresh = await QuizModel.getQuestionById(questionId);
    return res.status(200).json({ success: true, message: 'Question updated.', data: fresh });
  } catch (err) {
    logger.error('updateQuestion error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/subsection-quizzes/questions/:questionId
 * (also deletes its options)
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    if (!questionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid question id.' });
    }

    const q = await QuizModel.getQuestionById(questionId);
    if (!q) {
      return res.status(404).json({ success: false, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' });
    }

    await QuizModel.deleteQuestion(questionId);
    return res.status(200).json({ success: true, message: 'Question (and its options) deleted.' });
  } catch (err) {
    logger.error('deleteQuestion error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * POST /api/subsection-quizzes/questions/:questionId/options
 * Bulk or single create.
 * Accepts:
 *  - ARRAY payload: [ {text_html, is_correct, sort_order}, ... ]
 *  - OBJECT with "options" array: { options: [ ... ] }
 *  - Single object (legacy): { text_html, is_correct=0, sort_order=0 }
 */
exports.createOption = async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const payload = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid question id.' });
    }

    // validate question exists
    const q = await QuizModel.getQuestionById(questionId);
    if (!q) {
      return res.status(404).json({ success: false, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' });
    }

    // CASE A: raw array
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Options array cannot be empty.' });
      }
      const options = payload.map(o => ({
        text_html: o?.text_html ?? '',
        is_correct: isTruthy(o?.is_correct) ? 1 : 0,
        sort_order: o?.sort_order ?? 0
      }));
      const { inserted, ids } = await QuizModel.createOptionsBulk(questionId, options);
      return res.status(201).json({
        success: true,
        message: `Created ${inserted} option(s).`,
        data: { option_ids: ids }
      });
    }

    // CASE B: { options: [...] }
    if (payload && Array.isArray(payload.options)) {
      if (payload.options.length === 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Options array cannot be empty.' });
      }
      const options = payload.options.map(o => ({
        text_html: o?.text_html ?? '',
        is_correct: isTruthy(o?.is_correct) ? 1 : 0,
        sort_order: o?.sort_order ?? 0
      }));
      const { inserted, ids } = await QuizModel.createOptionsBulk(questionId, options);
      return res.status(201).json({
        success: true,
        message: `Created ${inserted} option(s).`,
        data: { option_ids: ids }
      });
    }

    // CASE C: single object (legacy)
    const { text_html, is_correct = 0, sort_order = 0 } = payload || {};
    if (!text_html) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'text_html is required.' });
    }
    const id = await QuizModel.createOption({
      question_id: questionId,
      text_html,
      is_correct: isTruthy(is_correct) ?? 0,
      sort_order: sort_order ?? 0
    });
    const created = await QuizModel.getOptionById(id);
    return res.status(201).json({ success: true, message: 'Option created.', data: created });
  } catch (err) {
    logger.error('createOption error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * PUT /api/subsection-quizzes/options/:optionId
 * Body: { text_html?, is_correct?, sort_order? }
 */
exports.updateOption = async (req, res) => {
  try {
    const optionId = Number(req.params.optionId);
    const { text_html, is_correct, sort_order } = req.body || {};

    if (!optionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid option id.' });
    }

    const opt = await QuizModel.getOptionById(optionId);
    if (!opt) {
      return res.status(404).json({ success: false, code: 'OPTION_NOT_FOUND', message: 'Option not found.' });
    }

    const updated = await QuizModel.updateOption(optionId, {
      text_html,
      is_correct: isTruthy(is_correct),
      sort_order
    });
    if (!updated) {
      return res.status(400).json({ success: false, code: 'NOTHING_TO_UPDATE', message: 'No fields to update.' });
    }
    const fresh = await QuizModel.getOptionById(optionId);
    return res.status(200).json({ success: true, message: 'Option updated.', data: fresh });
  } catch (err) {
    logger.error('updateOption error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/subsection-quizzes/options/:optionId
 */
exports.deleteOption = async (req, res) => {
  try {
    const optionId = Number(req.params.optionId);
    if (!optionId) {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid option id.' });
    }

    const opt = await QuizModel.getOptionById(optionId);
    if (!opt) {
      return res.status(404).json({ success: false, code: 'OPTION_NOT_FOUND', message: 'Option not found.' });
    }

    await QuizModel.deleteOption(optionId);
    return res.status(200).json({ success: true, message: 'Option deleted.' });
  } catch (err) {
    logger.error('deleteOption error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
};
