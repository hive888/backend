/**
 * AI Wizard Controller
 * Handles interactive AI conversation/wizard endpoints
 */

const TalentRequest = require('../models/talentRequestModel');
const ProjectRequest = require('../models/projectRequestModel');
const {
  startConversation,
  continueConversation,
  handleAction
} = require('../services/ai/conversationWizard');
const { matchTalentsWithAI } = require('../services/ai/matchingEngine');
const { analyzeRequest } = require('../services/ai/requestAnalyzer');
const logger = require('../utils/logger');

/**
 * Start a new wizard conversation
 * POST /api/admin/swafri/ai/wizard/start
 */
exports.startWizard = async (req, res) => {
  try {
    const { request_type, request_id } = req.body;

    // Validation
    if (!request_type || !request_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'request_type and request_id are required',
        code: 'INVALID_REQUEST'
      });
    }

    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"',
        code: 'INVALID_REQUEST_TYPE'
      });
    }

    // Fetch request
    let request;
    if (request_type === 'talent') {
      request = await TalentRequest.findById(request_id);
    } else {
      request = await ProjectRequest.findById(request_id);
    }

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `${request_type} request with ID ${request_id} not found`,
        code: 'REQUEST_NOT_FOUND'
      });
    }

    // Start conversation
    const result = await startConversation(request_type, request_id, {
      request,
      request_id: parseInt(request_id),
      request_type
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error starting wizard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Continue wizard conversation
 * POST /api/admin/swafri/ai/wizard/continue
 */
exports.continueWizard = async (req, res) => {
  try {
    const { session_id, message, action } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'session_id is required',
        code: 'INVALID_REQUEST'
      });
    }

    if (!message && !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing input',
        message: 'Either message or action is required',
        code: 'INVALID_REQUEST'
      });
    }

    // Continue conversation
    const result = await continueConversation(session_id, message || '', action);

    // Handle async actions
    if (result.async_action === 'match_talents') {
      // Trigger async talent matching
      result.message += '\n\nFinding matching talents...';
      result.processing = true;
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error continuing wizard:', error);
    
    if (error.message === 'Conversation session not found') {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: error.message,
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Execute wizard action (like finding talents)
 * POST /api/admin/swafri/ai/wizard/execute
 */
exports.executeAction = async (req, res) => {
  try {
    const { session_id, action, params = {} } = req.body;

    if (!session_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'session_id and action are required',
        code: 'INVALID_REQUEST'
      });
    }

    // Get conversation context
    const { getCache } = require('../services/ai/cacheService');
    const conversation = await getCache(`ai:wizard:session:${session_id}`);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: 'Conversation session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    let result;

    switch (action) {
      case 'match_talents':
        result = await executeMatchTalents(conversation, params);
        break;

      case 'get_insights':
        result = await executeGetInsights(conversation, params);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          message: `Action "${action}" is not supported`,
          code: 'INVALID_ACTION'
        });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error executing action:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Execute match talents action
 */
async function executeMatchTalents(conversation, params) {
  const { request_type, request_id, analysis } = conversation.context;
  const limit = params.limit || 10;
  const minScore = params.min_score || 0.5;

  // Fetch request
  let request;
  if (request_type === 'talent') {
    request = await TalentRequest.findById(request_id);
  } else {
    request = await ProjectRequest.findById(request_id);
  }

  if (!request) {
    throw new Error('Request not found');
  }

  // Get analysis if not available
  let analysisData = analysis;
  if (!analysisData) {
    analysisData = await analyzeRequest(request, request_type);
  }

  // Get talents and match
  const TalentPoolRegistration = require('../models/talentPoolModel');
  const allTalents = await TalentPoolRegistration.findAll();
  const matchResult = await matchTalentsWithAI(
    request,
    allTalents,
    analysisData,
    minScore
  );

  const matches = matchResult.matches.slice(0, limit);

  return {
    action: 'match_talents',
    message: `Found ${matches.length} matching talent(s) with scores above ${minScore}. Here are the top matches:`,
    matches: matches,
    total_analyzed: matchResult.total_talents_analyzed,
    suggestions: [
      'Would you like to see detailed analysis for any specific talent?',
      'Should I create assignments for the top matches?',
      'Do you want to compare multiple talents?'
    ],
    actions: [
      { id: 'view_talent_details', label: 'View Talent Details', type: 'primary' },
      { id: 'create_assignments', label: 'Create Assignments', type: 'primary' },
      { id: 'compare_talents', label: 'Compare Talents', type: 'secondary' }
    ]
  };
}

/**
 * Execute get insights action
 */
async function executeGetInsights(conversation, params) {
  const { analysis } = conversation.context;

  if (!analysis) {
    throw new Error('Analysis not available');
  }

  const insights = {
    summary: analysis.ai_summary,
    complexity: analysis.complexity_score,
    risks: analysis.risk_factors || [],
    missing_info: analysis.missing_information || [],
    recommendations: generateRecommendations(analysis)
  };

  return {
    action: 'get_insights',
    message: 'Here are comprehensive insights for this request:',
    insights: insights,
    suggestions: [
      'Would you like me to create an action plan?',
      'Should I prioritize these recommendations?'
    ],
    actions: [
      { id: 'create_action_plan', label: 'Create Action Plan', type: 'primary' },
      { id: 'prioritize_recommendations', label: 'Prioritize Recommendations', type: 'secondary' }
    ]
  };
}

/**
 * Generate recommendations from analysis
 */
function generateRecommendations(analysis) {
  const recommendations = [];

  if (analysis.missing_information?.length > 0) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Gather Missing Information',
      description: 'Request additional details from the client',
      items: analysis.missing_information.map(m => m.suggestion)
    });
  }

  if (analysis.risk_factors?.length > 0) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      title: 'Address Risk Factors',
      description: 'Consider mitigation strategies',
      items: analysis.risk_factors.map(r => r.description)
    });
  }

  if (analysis.extracted_requirements?.urgency === 'high') {
    recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Prioritize This Request',
      description: 'High urgency - allocate resources accordingly'
    });
  }

  return recommendations;
}

/**
 * Get conversation history
 * GET /api/admin/swafri/ai/wizard/history/:session_id
 */
exports.getHistory = async (req, res) => {
  try {
    const { session_id } = req.params;

    const { getCache } = require('../services/ai/cacheService');
    const conversation = await getCache(`ai:wizard:session:${session_id}`);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: 'Conversation session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        session_id,
        history: conversation.context.history || [],
        current_step: conversation.context.step,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at
      }
    });

  } catch (error) {
    logger.error('Error getting history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

