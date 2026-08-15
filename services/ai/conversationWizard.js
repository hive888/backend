/**
 * Interactive AI Conversation Wizard Service
 * Provides conversational AI assistance with context-aware responses and action suggestions
 */

const logger = require('../../utils/logger');
const { analyzeRequest } = require('./requestAnalyzer');
const { matchTalentsWithAI } = require('./matchingEngine');
const { getCache, setCache } = require('./cacheService');
const { getWorkingModel } = require('./geminiModelDetector');

// Google Gemini client (optional)
let gemini = null;
let workingModel = null;

// Initialize Gemini if available
async function initGemini() {
  try {
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      // Detect available model
      workingModel = await getWorkingModel(gemini);
      
      if (workingModel) {
        logger.info(`Google Gemini initialized for conversation wizard with model: ${workingModel}`);
      } else {
        logger.warn('Google Gemini initialized but no working model found');
      }
    }
  } catch (error) {
    logger.warn('Gemini initialization failed for wizard:', error.message);
  }
}

initGemini();

/**
 * Start a new conversation session
 */
async function startConversation(requestType, requestId, initialContext = {}) {
  const sessionId = generateSessionId();
  const conversation = {
    session_id: sessionId,
    request_type: requestType,
    request_id: requestId,
    context: {
      ...initialContext,
      step: 'initial_analysis',
      history: []
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Perform initial analysis
  const analysis = await analyzeRequest(initialContext.request || {}, requestType);
  conversation.context.analysis = analysis;
  conversation.context.step = 'analysis_complete';

  // Generate initial wizard response
  const response = await generateWizardResponse(conversation, null);

  // Store conversation
  await setCache(`ai:wizard:session:${sessionId}`, conversation, 3600); // 1 hour

  return {
    session_id: sessionId,
    message: response.message,
    suggestions: response.suggestions,
    actions: response.actions,
    context: {
      step: conversation.context.step,
      has_analysis: true
    }
  };
}

/**
 * Continue conversation with user input
 */
async function continueConversation(sessionId, userInput, action = null) {
  // Retrieve conversation
  const conversation = await getCache(`ai:wizard:session:${sessionId}`);
  
  if (!conversation) {
    throw new Error('Conversation session not found');
  }

  // Add user input to history
  conversation.context.history.push({
    type: 'user',
    message: userInput,
    action: action,
    timestamp: new Date().toISOString()
  });

  // Process based on current step and action
  const response = await processUserInput(conversation, userInput, action);

  // Add AI response to history
  conversation.context.history.push({
    type: 'assistant',
    message: response.message,
    suggestions: response.suggestions,
    actions: response.actions,
    timestamp: new Date().toISOString()
  });

  // Update conversation state
  conversation.context.step = response.next_step || conversation.context.step;
  conversation.updated_at = new Date().toISOString();

  // Store updated conversation
  await setCache(`ai:wizard:session:${sessionId}`, conversation, 3600);

  return {
    session_id: sessionId,
    message: response.message,
    suggestions: response.suggestions,
    actions: response.actions,
    context: {
      step: conversation.context.step,
      has_analysis: !!conversation.context.analysis,
      history_length: conversation.context.history.length
    }
  };
}

/**
 * Process user input and generate response
 */
async function processUserInput(conversation, userInput, action) {
  const { step, analysis } = conversation.context;

  // Handle specific actions
  if (action) {
    return await handleAction(conversation, action, userInput);
  }

  // Generate contextual response based on step
  return await generateWizardResponse(conversation, userInput);
}

/**
 * Handle specific wizard actions
 */
async function handleAction(conversation, action, userInput) {
  const { request_type, request_id, analysis } = conversation.context;

  switch (action) {
    case 'analyze_request':
      return {
        message: generateAnalysisSummary(analysis),
        suggestions: [
          'Would you like me to find matching talents?',
          'Should I identify any missing information?',
          'Do you want to see risk factors?'
        ],
        actions: [
          { id: 'find_talents', label: 'Find Matching Talents', type: 'primary' },
          { id: 'check_missing_info', label: 'Check Missing Info', type: 'secondary' },
          { id: 'view_risks', label: 'View Risk Factors', type: 'secondary' },
          { id: 'get_insights', label: 'Get AI Insights', type: 'secondary' }
        ],
        next_step: 'ready_for_action'
      };

    case 'find_talents':
      return await handleFindTalents(conversation);

    case 'check_missing_info': {
      const missingInfo = analysis.missing_information || [];
      const dataQuality = analysis.data_quality || { score: 0.5, level: 'fair' };
      
      let message = generateMissingInfoMessage(analysis);
      
      // Add data quality warning if poor
      if (dataQuality.score < 0.5) {
        message += `\n\n⚠️ **Data Quality Warning:** The provided information has a quality score of ${dataQuality.percentage}% (${dataQuality.level}). This is insufficient for accurate analysis and matching.`;
        
        if (dataQuality.issues && dataQuality.issues.length > 0) {
          message += `\n\n**Issues identified:**\n${dataQuality.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}`;
        }
      }
      
      if (missingInfo.length === 0 && dataQuality.score >= 0.7) {
        message = '✅ Great! The request appears to have sufficient information for analysis.';
      } else if (missingInfo.length === 0 && dataQuality.score < 0.7) {
        message = `⚠️ While all fields are filled, the data quality is ${dataQuality.level} (${dataQuality.percentage}%). Consider providing more detailed information for better analysis.`;
      }
      
      return {
        message: message,
        suggestions: missingInfo.length > 0 ? [
          'Would you like me to suggest specific questions to ask the client?',
          'Should I draft an email requesting more information?',
          missingInfo.length > 3 ? 'There are multiple missing fields - should I create a comprehensive information request?' : null
        ].filter(Boolean) : [
          dataQuality.score < 0.7 ? 'Would you like suggestions to improve data quality?' : 'Ready to proceed with matching!',
          'Should I proceed with analysis?'
        ],
        actions: missingInfo.length > 0 ? [
          { id: 'suggest_questions', label: 'Suggest Questions', type: 'primary' },
          { id: 'draft_email', label: 'Draft Information Request Email', type: 'primary' },
          { id: 'create_request_template', label: 'Create Information Request Template', type: 'secondary' },
          { id: 'find_talents', label: 'Find Talents Anyway (Limited Accuracy)', type: 'secondary' },
          { id: 'back', label: 'Go Back', type: 'secondary' }
        ] : [
          dataQuality.score < 0.7 ? 
            { id: 'improve_quality', label: 'Get Quality Improvement Suggestions', type: 'primary' } :
            { id: 'find_talents', label: 'Find Talents', type: 'primary' },
          { id: 'get_insights', label: 'Get Insights', type: 'secondary' }
        ],
        next_step: 'missing_info_reviewed',
        data_quality: dataQuality,
        missing_count: missingInfo.length
      };
    }

    case 'view_risks':
      return {
        message: generateRiskMessage(analysis),
        suggestions: [
          'Would you like mitigation strategies?',
          'Should I proceed with matching?'
        ],
        actions: [
          { id: 'get_mitigation', label: 'Get Mitigation Strategies', type: 'primary' },
          { id: 'find_talents', label: 'Find Talents', type: 'secondary' },
          { id: 'back', label: 'Go Back', type: 'secondary' }
        ],
        next_step: 'risks_reviewed'
      };

    case 'get_insights':
      return await handleGetInsights(conversation);

    case 'suggest_questions': {
      const questions = generateSuggestedQuestions(analysis);
      const dataQuality = analysis?.data_quality || {};
      
      return {
        message: questions,
        suggestions: [
          'Would you like me to draft a professional email to request this information?',
          'Should I create a template for information gathering?',
          dataQuality.score < 0.5 ? 'The data quality is low - should I emphasize the importance of detailed responses?' : null
        ].filter(Boolean),
        actions: [
          { id: 'draft_email', label: 'Draft Professional Email', type: 'primary' },
          { id: 'create_template', label: 'Create Information Template', type: 'primary' },
          { id: 'save_questions', label: 'Save Questions', type: 'secondary' },
          { id: 'back', label: 'Go Back', type: 'secondary' }
        ],
        next_step: 'questions_generated'
      };
    }

    case 'get_mitigation':
      return {
        message: generateMitigationStrategies(analysis),
        suggestions: [
          'Would you like to proceed with matching?',
          'Should I create a risk mitigation plan?'
        ],
        actions: [
          { id: 'find_talents', label: 'Find Talents', type: 'primary' },
          { id: 'create_plan', label: 'Create Risk Plan', type: 'secondary' },
          { id: 'back', label: 'Go Back', type: 'secondary' }
        ],
        next_step: 'mitigation_provided'
      };

    case 'view_matches':
      return {
        message: 'Here are the top talent matches. Would you like to see more details about any specific talent?',
        suggestions: [
          'View detailed match analysis',
          'Compare multiple talents',
          'Get assignment recommendations'
        ],
        actions: [
          { id: 'view_talent_details', label: 'View Talent Details', type: 'primary' },
          { id: 'compare_talents', label: 'Compare Talents', type: 'secondary' },
          { id: 'get_recommendations', label: 'Get Recommendations', type: 'secondary' }
        ],
        next_step: 'matches_viewed'
      };

    default:
      return await generateWizardResponse(conversation, userInput);
  }
}

/**
 * Handle finding talents action
 */
async function handleFindTalents(conversation) {
  const { request_type, request_id, analysis } = conversation.context;
  
  // This would need access to the request object and talent pool
  // For now, return a message indicating the action
  return {
    message: 'I\'ll analyze the talent pool and find the best matches for this request. This may take a few moments...',
    suggestions: [
      'Would you like me to filter by specific criteria?',
      'Should I prioritize certain skills?'
    ],
    actions: [
      { id: 'filter_matches', label: 'Filter Matches', type: 'primary' },
      { id: 'view_all_matches', label: 'View All Matches', type: 'secondary' }
    ],
    next_step: 'finding_talents',
    async_action: 'match_talents' // Indicates this needs async processing
  };
}

/**
 * Handle getting insights
 */
async function handleGetInsights(conversation) {
  const { analysis } = conversation.context;
  
  return {
    message: generateInsightsMessage(analysis),
    suggestions: [
      'Would you like me to create an action plan?',
      'Should I prioritize certain recommendations?'
    ],
    actions: [
      { id: 'create_action_plan', label: 'Create Action Plan', type: 'primary' },
      { id: 'prioritize_actions', label: 'Prioritize Actions', type: 'secondary' },
      { id: 'find_talents', label: 'Find Talents', type: 'secondary' }
    ],
    next_step: 'insights_provided'
  };
}

/**
 * Generate wizard response using AI or templates
 */
async function generateWizardResponse(conversation, userInput) {
  const { step, analysis, history } = conversation.context;

  // Use AI if available
  if (gemini && userInput) {
    try {
      return await generateAIResponse(conversation, userInput);
    } catch (error) {
      logger.warn('AI response generation failed, using template:', error.message);
    }
  }

  // Template-based responses
  switch (step) {
    case 'initial_analysis':
      return {
        message: 'Hello! I\'m your AI assistant for managing this request. Let me analyze it first...',
        suggestions: [],
        actions: [],
        next_step: 'analysis_complete'
      };

    case 'analysis_complete':
      return {
        message: generateAnalysisSummary(analysis),
        suggestions: [
          'I\'ve analyzed the request. Here\'s what I found:',
          'Would you like me to find matching talents?',
          'Should I check for missing information?'
        ],
        actions: [
          { id: 'find_talents', label: 'Find Matching Talents', type: 'primary' },
          { id: 'check_missing_info', label: 'Check Missing Info', type: 'secondary' },
          { id: 'view_risks', label: 'View Risk Factors', type: 'secondary' },
          { id: 'get_insights', label: 'Get AI Insights', type: 'primary' }
        ],
        next_step: 'ready_for_action'
      };

    default:
      return {
        message: 'How can I help you with this request?',
        suggestions: [
          'Find matching talents',
          'Review request details',
          'Get recommendations'
        ],
        actions: [
          { id: 'find_talents', label: 'Find Talents', type: 'primary' },
          { id: 'analyze_request', label: 'Re-analyze Request', type: 'secondary' }
        ],
        next_step: step
      };
  }
}

/**
 * Generate AI-powered response
 */
async function generateAIResponse(conversation, userInput) {
  if (!gemini) return null;

  // Get working model (will detect if not already cached)
  const modelName = workingModel || await getWorkingModel(gemini) || process.env.GEMINI_MODEL || 'gemini-pro';
  
  if (!modelName) {
    logger.warn('[Conversation Wizard] No working Gemini model available');
    return null;
  }

  const model = gemini.getGenerativeModel({ model: modelName });

  const { step, analysis, history } = conversation.context;
  const recentHistory = history.slice(-6).map(h => `${h.type}: ${h.message}`).join('\n');

  const prompt = `You are an expert AI assistant specializing in talent acquisition, project management, and client relationship management for software development and outsourcing services.

YOUR ROLE:
- Provide intelligent, actionable insights
- Guide users through request management workflows
- Suggest optimal next steps based on context
- Be proactive, helpful, and professional
- Think strategically about talent matching and project success

CURRENT CONTEXT:
- Conversation Step: ${step}
- Request Analysis: ${JSON.stringify(analysis?.extracted_requirements || {}, null, 2)}
- Data Quality: ${analysis?.data_quality ? `${analysis.data_quality.percentage}% (${analysis.data_quality.level})` : 'N/A'}
- Missing Information: ${analysis?.missing_information?.length || 0} items
- Recent Conversation History:
${recentHistory}

USER INPUT:
${userInput}

YOUR TASK:
Generate a comprehensive, intelligent response that:

1. **Addresses the User's Input**:
   - Understand the intent behind their message
   - Provide relevant, contextual information
   - Answer any questions directly
   - Acknowledge their needs

2. **Provide Valuable Insights**:
   - Reference specific details from the request analysis
   - Highlight important findings or concerns
   - Offer strategic recommendations
   - Share relevant data quality insights

3. **Suggest Next Actions** (2-4 suggestions):
   - Suggest logical next steps based on current state
   - Prioritize actions that add the most value
   - Consider the workflow and user journey
   - Be specific and actionable

4. **Tone and Style**:
   - Professional yet friendly
   - Confident and knowledgeable
   - Clear and concise
   - Proactive and helpful

AVAILABLE ACTIONS:
- find_talents: Find matching talents from pool
- check_missing_info: Review missing information
- view_risks: Analyze risk factors
- get_insights: Get AI-powered insights
- suggest_questions: Generate questions for client
- draft_email: Draft professional email
- create_action_plan: Create action plan
- analyze_request: Re-analyze the request

OUTPUT FORMAT:
Return a JSON object with:
- message: Your comprehensive response (3-5 sentences, detailed and insightful)
- suggestions: Array of 2-4 specific, actionable suggestion strings
- actions: Array of action objects with {id, label, type: 'primary'|'secondary'}
  - Use 'primary' for most important/recommended actions
  - Use 'secondary' for alternative options
- next_step: Suggested next step name (e.g., 'ready_for_action', 'analysis_complete')

THINKING PROCESS:
- Analyze the user's intent carefully
- Consider the current state and what makes sense next
- Provide valuable, actionable guidance
- Be strategic about workflow progression

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no additional text. Pure JSON only.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7, // Balanced for conversational yet focused responses
      maxOutputTokens: 1000, // Increased for more comprehensive responses
      responseMimeType: 'application/json',
      topP: 0.9,
      topK: 40
    }
  });

  const response = await result.response;
  const text = response.text();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    // If JSON parsing fails, try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Generate analysis summary message
 */
function generateAnalysisSummary(analysis) {
  if (!analysis) return 'Analysis completed.';

  const { extracted_requirements, ai_summary, confidence } = analysis;
  const skills = extracted_requirements?.required_skills?.slice(0, 5).join(', ') || 'Various';
  const level = extracted_requirements?.experience_level || 'mid-level';
  const urgency = extracted_requirements?.urgency || 'medium';

  return `I've analyzed this request. Here's what I found:

**Summary:** ${ai_summary || 'Request analyzed successfully'}

**Key Requirements:**
- Skills needed: ${skills}${extracted_requirements?.required_skills?.length > 5 ? '...' : ''}
- Experience level: ${level}
- Urgency: ${urgency}
- Confidence: ${confidence || 'medium'}

What would you like to do next?`;
}

/**
 * Generate missing info message
 */
function generateMissingInfoMessage(analysis) {
  const missing = analysis?.missing_information || [];
  const dataQuality = analysis?.data_quality || { score: 0.5, level: 'fair' };
  
  if (missing.length === 0 && dataQuality.score >= 0.7) {
    return '✅ Great news! The request appears to have all necessary information with good data quality.';
  }

  if (missing.length === 0 && dataQuality.score < 0.7) {
    return `⚠️ While all fields are filled, the data quality is ${dataQuality.level} (${dataQuality.percentage}%). The information provided is too brief or lacks detail for comprehensive analysis.`;
  }

  // Group by priority
  const highPriority = missing.filter(m => m.priority === 'high');
  const mediumPriority = missing.filter(m => m.priority === 'medium');
  const lowPriority = missing.filter(m => m.priority === 'low');

  let message = `⚠️ I've identified ${missing.length} area(s) that need attention:\n\n`;
  
  if (highPriority.length > 0) {
    message += `**🔴 High Priority (${highPriority.length}):**\n`;
    highPriority.forEach((item, index) => {
      message += `${index + 1}. **${item.field}**\n   ${item.suggestion}\n   *Reason: ${item.reason || 'Critical for accurate matching'}*\n\n`;
    });
  }

  if (mediumPriority.length > 0) {
    message += `**🟡 Medium Priority (${mediumPriority.length}):**\n`;
    mediumPriority.forEach((item, index) => {
      message += `${index + 1}. **${item.field}**\n   ${item.suggestion}\n\n`;
    });
  }

  if (lowPriority.length > 0) {
    message += `**🟢 Low Priority (${lowPriority.length}):**\n`;
    lowPriority.forEach((item, index) => {
      message += `${index + 1}. **${item.field}**\n   ${item.suggestion}\n\n`;
    });
  }

  // Add data quality context
  if (dataQuality.score < 0.5) {
    message += `\n**Overall Data Quality:** ${dataQuality.percentage}% (${dataQuality.level})\n`;
    message += `The provided information is insufficient for comprehensive analysis. Please provide more detailed information.`;
  }

  return message;
}

/**
 * Generate risk message
 */
function generateRiskMessage(analysis) {
  const risks = analysis?.risk_factors || [];
  
  if (risks.length === 0) {
    return 'Good news! I don\'t see any significant risk factors for this request.';
  }

  let message = `I've identified ${risks.length} potential risk factor(s):\n\n`;
  risks.forEach((risk, index) => {
    message += `${index + 1}. **${risk.type}** (${risk.severity} severity)\n   ${risk.description}\n\n`;
  });

  return message;
}

/**
 * Generate suggested questions
 */
function generateSuggestedQuestions(analysis) {
  const missing = analysis?.missing_information || [];
  const dataQuality = analysis?.data_quality || {};
  
  if (missing.length === 0 && dataQuality.score >= 0.7) {
    return '✅ The request seems complete. No additional questions needed at this time.';
  }

  if (missing.length === 0 && dataQuality.score < 0.7) {
    return `⚠️ While all fields are filled, the information provided is too brief. Here are questions to gather more detail:\n\n1. Could you provide more comprehensive details about the project requirements?\n2. What are the specific technical challenges or constraints?\n3. What are the success criteria and expected outcomes?\n4. Are there any specific industry standards or compliance requirements?`;
  }

  // Group by priority
  const highPriority = missing.filter(m => m.priority === 'high');
  const mediumPriority = missing.filter(m => m.priority === 'medium');

  let message = 'Here are specific questions to ask the client to improve data quality:\n\n';
  
  if (highPriority.length > 0) {
    message += `**Critical Questions (${highPriority.length}):**\n`;
    highPriority.forEach((item, index) => {
      message += `${index + 1}. ${item.suggestion}\n`;
      if (item.reason) {
        message += `   *Why: ${item.reason}*\n`;
      }
      message += '\n';
    });
  }

  if (mediumPriority.length > 0) {
    message += `**Important Questions (${mediumPriority.length}):**\n`;
    mediumPriority.forEach((item, index) => {
      message += `${highPriority.length + index + 1}. ${item.suggestion}\n\n`;
    });
  }

  // Add data quality context
  if (dataQuality.score < 0.5) {
    message += `\n**Note:** The current data quality is ${dataQuality.percentage}% (${dataQuality.level}). `;
    message += `Gathering this information is essential for accurate talent matching and project planning.`;
  }

  return message;
}

/**
 * Generate mitigation strategies
 */
function generateMitigationStrategies(analysis) {
  const risks = analysis?.risk_factors || [];
  
  if (risks.length === 0) {
    return 'No specific mitigation strategies needed at this time.';
  }

  const strategies = {
    timeline_conflict: 'Consider extending the timeline or prioritizing critical features first.',
    skill_shortage: 'Expand the search criteria or consider training existing talents.',
    budget_constraint: 'Break down the project into phases or negotiate scope adjustments.'
  };

  let message = 'Here are some mitigation strategies:\n\n';
  risks.forEach((risk, index) => {
    const strategy = strategies[risk.type] || 'Monitor this risk closely and adjust plans as needed.';
    message += `${index + 1}. **${risk.type}**: ${strategy}\n`;
  });

  return message;
}

/**
 * Generate insights message
 */
function generateInsightsMessage(analysis) {
  const { complexity_score, suggested_tags, ai_summary } = analysis;
  
  return `Based on my analysis, here are key insights:

**Complexity Score:** ${(complexity_score * 100).toFixed(0)}/100
**Tags:** ${suggested_tags?.join(', ') || 'N/A'}

**Summary:** ${ai_summary || 'Analysis complete'}

I can help you with next steps like finding matching talents or creating an action plan.`;
}

/**
 * Generate session ID
 */
function generateSessionId() {
  return `wizard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  startConversation,
  continueConversation,
  handleAction
};

