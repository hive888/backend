const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { betaTool } = require('@anthropic-ai/sdk/helpers/beta/json-schema');
const db = require('../config/database');
const logger = require('../utils/logger');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;

const knowledge = fs.readFileSync(
  path.join(__dirname, '../data/hive888-knowledge.md'),
  'utf8'
);

const SYSTEM_PROMPT = `You are the HIVE888 assistant, embedded as a chat widget on the Hive888 customer dashboard (hub.hive888.org). You help visitors and logged-in users with questions about the Hive888 platform, its Academy 888 courses, the Talent Pool, and the Project Pool.

Ground platform/company questions in the reference material below. For questions about a specific course's lesson content, use the search_course_content tool rather than guessing. For general knowledge questions unrelated to Hive888, answer normally from what you know.

Keep answers concise and conversational — this is a chat widget, not a document. If you don't know something specific to a user's account (their progress, payments, personal data), say so and suggest they check their dashboard or contact support.

# Reference material about Hive888

${knowledge}`;

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  logger.warn('ANTHROPIC_API_KEY is not set. POST /api/chat will return 503 until it is configured.');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const searchCourseContentTool = betaTool({
  name: 'search_course_content',
  description:
    'Search Hive888 Academy course lesson content by keyword. Use this when the user asks about a specific course, chapter, or topic covered in the courses, rather than answering from general knowledge.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Keywords to search for in course titles and lesson content, e.g. "smart contracts" or "wallet security".',
      },
    },
    required: ['query'],
  },
  run: async ({ query }) => {
    const term = String(query || '').trim();
    if (!term) return 'No search term provided.';

    try {
      const [rows] = await db.query(
        `SELECT ss.title, ss.content_html, s.title as section_title, c.title as chapter_title
         FROM subsections ss
         LEFT JOIN sections s ON ss.section_id = s.id
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE ss.title ILIKE ? OR ss.content_html ILIKE ?
         ORDER BY ss.sort_order ASC
         LIMIT 5`,
        [`%${term}%`, `%${term}%`]
      );

      if (!rows.length) {
        return `No course content found matching "${term}".`;
      }

      return rows
        .map((row) => {
          const snippet = stripHtml(row.content_html).slice(0, 600);
          return `Chapter: ${row.chapter_title || 'Unknown'} > Section: ${row.section_title || 'Unknown'} > Lesson: ${row.title}\n${snippet}`;
        })
        .join('\n\n---\n\n');
    } catch (err) {
      logger.error('search_course_content tool failed:', { error: err.message });
      return 'Course content search failed due to an internal error.';
    }
  },
});

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

async function sendMessage(req, res) {
  if (!client) {
    return res.status(503).json({
      success: false,
      error: 'Chat is temporarily unavailable',
      code: 'CHAT_NOT_CONFIGURED',
    });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message is required',
      code: 'VALIDATION_ERROR',
    });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      code: 'VALIDATION_ERROR',
    });
  }

  const history = sanitizeHistory(req.body?.history);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const runner = client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      tools: [searchCourseContentTool],
      messages: [...history, { role: 'user', content: message }],
      stream: true,
    });

    for await (const messageStream of runner) {
      for await (const event of messageStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(event.delta.text);
        }
      }
    }

    res.end();
  } catch (err) {
    logger.error('Chat request failed:', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    } else {
      res.end();
    }
  }
}

module.exports = { sendMessage };
