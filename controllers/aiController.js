/**
 * AI Controller
 * Handles AI-powered features for SWAFRI request management
 */

const TalentRequest = require('../models/talentRequestModel');
const ProjectRequest = require('../models/projectRequestModel');
const TalentPoolRegistration = require('../models/talentPoolModel');
const { analyzeRequest } = require('../services/ai/requestAnalyzer');
const { matchTalentsWithAI } = require('../services/ai/matchingEngine');
const { analyzeCV } = require('../services/ai/cvParser');
const { 
  getCache, 
  setCache, 
  invalidateRequestCache,
  invalidateTalentCache 
} = require('../services/ai/cacheService');
const logger = require('../utils/logger');

/**
 * Analyze a request
 * POST /api/admin/swafri/ai/analyze-request
 */
exports.analyzeRequest = async (req, res) => {
  try {
    const { request_type, request_id, force_refresh } = req.body;

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

    // Check cache
    const cacheKey = `ai:analysis:request:${request_type}:${request_id}`;
    if (!force_refresh) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: {
            ...cached,
            cached: true
          }
        });
      }
    }

    // Fetch request from database
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

    // Log AI analysis request
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`[AI REQUEST] Frontend requested AI analysis`, {
      endpoint: 'POST /admin/swafri/ai/analyze-request',
      request_id,
      request_type,
      user_ip: req.ip,
      timestamp: new Date().toISOString()
    });
    logger.info(`[AI REQUEST] Gemini API Status: ${process.env.GEMINI_API_KEY ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);

    const analysisStartTime = Date.now();
    
    // Perform AI analysis
    const analysis = await analyzeRequest(request, request_type);
    
    const analysisDuration = Date.now() - analysisStartTime;

    const result = {
      request_id: parseInt(request_id),
      request_type,
      analysis,
      data_quality: analysis.data_quality || null,
      quality_warning: analysis.quality_warning || null,
      cached: false,
      analyzed_at: new Date().toISOString()
    };

    // Log analysis completion
    logger.info(`[AI RESPONSE] Analysis completed`, {
      request_id,
      request_type,
      total_duration_ms: analysisDuration,
      ai_provider: analysis.ai_provider || 'unknown',
      ai_used: analysis.ai_used || false,
      confidence: analysis.confidence,
      skills_found: analysis.extracted_requirements?.required_skills?.length || 0,
      data_quality_score: analysis.data_quality?.score || 0
    });
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Cache result (24 hours)
    await setCache(cacheKey, result, 86400);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error analyzing request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Match talents with AI
 * POST /api/admin/swafri/ai/match-talents
 */
exports.matchTalents = async (req, res) => {
  try {
    const { 
      request_type, 
      request_id, 
      limit = 10, 
      min_score = 0.5,
      include_reasoning = true,
      force_refresh = false
    } = req.body;

    // Log matching request
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`[AI REQUEST] Frontend requested talent matching`, {
      endpoint: 'POST /admin/swafri/ai/match-talents',
      request_id,
      request_type,
      limit,
      min_score,
      include_reasoning,
      user_ip: req.ip,
      timestamp: new Date().toISOString()
    });
    logger.info(`[AI REQUEST] Gemini API Status: ${process.env.GEMINI_API_KEY ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);

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

    const limitNum = Math.min(parseInt(limit, 10) || 10, 50);
    const minScoreNum = Math.max(0, Math.min(1, parseFloat(min_score) || 0.5));

    // Check cache
    const cacheKey = `ai:matches:request:${request_type}:${request_id}:${limitNum}:${minScoreNum}`;
    if (!force_refresh) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: {
            ...cached,
            matching_metadata: {
              ...cached.matching_metadata,
              cached: true
            }
          }
        });
      }
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

    // Get analysis (cached or fresh)
    const analysisCacheKey = `ai:analysis:request:${request_type}:${request_id}`;
    let analysis = await getCache(analysisCacheKey);
    
    if (!analysis) {
      analysis = await analyzeRequest(request, request_type);
    } else {
      analysis = analysis.analysis;
    }

    // Fetch all talents from pool
    const allTalents = await TalentPoolRegistration.findAll();
    
    // Match talents with AI
    const matchingStartTime = Date.now();
    const matchResult = await matchTalentsWithAI(
      request, 
      allTalents, 
      analysis, 
      minScoreNum
    );
    const matchingDuration = Date.now() - matchingStartTime;

    // Limit results
    const limitedMatches = matchResult.matches.slice(0, limitNum);

    logger.info(`[AI RESPONSE] Talent matching completed`, {
      request_id,
      request_type,
      total_duration_ms: matchingDuration,
      talents_analyzed: matchResult.total_talents_analyzed,
      matches_found: matchResult.matches.length,
      matches_returned: limitedMatches.length,
      ai_reasoning_used: include_reasoning && process.env.GEMINI_API_KEY ? 'yes' : 'no'
    });
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const result = {
      request_id: parseInt(request_id),
      request_type,
      matches: limitedMatches,
      total_talents_analyzed: matchResult.total_talents_analyzed,
      matching_metadata: {
        ...matchResult.matching_metadata,
        cached: false
      },
      generated_at: new Date().toISOString()
    };

    // Cache result (1 hour)
    await setCache(cacheKey, result, 3600);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error matching talents:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Analyze CV
 * POST /api/admin/swafri/ai/analyze-cv
 */
exports.analyzeCV = async (req, res) => {
  try {
    const { talent_id, cv_url, cv_file_path, force_reanalysis } = req.body;

    if (!cv_url && !cv_file_path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Either cv_url or cv_file_path is required',
        code: 'INVALID_REQUEST'
      });
    }

    // Check cache if talent_id provided
    if (talent_id && !force_reanalysis) {
      const cacheKey = `ai:cv:analysis:${talent_id}`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: {
            ...cached,
            cached: true
          }
        });
      }
    }

    // Analyze CV
    const result = await analyzeCV(cv_url, cv_file_path, talent_id);

    // Cache result (permanent until CV updated)
    if (talent_id) {
      await setCache(`ai:cv:analysis:${talent_id}`, result, 86400 * 30); // 30 days
    }

    res.json({
      success: true,
      data: {
        talent_id: talent_id ? parseInt(talent_id) : null,
        ...result
      }
    });

  } catch (error) {
    logger.error('Error analyzing CV:', error);
    res.status(500).json({
      success: false,
      error: 'CV processing failed',
      message: error.message,
      code: 'CV_PROCESSING_FAILED'
    });
  }
};

/**
 * Generate AI insights
 * GET /api/admin/swafri/ai/insights/:request_type/:request_id
 */
exports.generateInsights = async (req, res) => {
  try {
    const { request_type, request_id } = req.params;
    const { 
      include_assignments = true, 
      include_trends = true,
      force_refresh = false 
    } = req.query;

    // Validation
    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"',
        code: 'INVALID_REQUEST_TYPE'
      });
    }

    // Check cache
    const cacheKey = `ai:insights:${request_type}:${request_id}`;
    if (!force_refresh) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: {
            ...cached,
            cached: true
          }
        });
      }
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

    // Get analysis
    const analysisCacheKey = `ai:analysis:request:${request_type}:${request_id}`;
    let analysis = await getCache(analysisCacheKey);
    
    if (!analysis) {
      analysis = await analyzeRequest(request, request_type);
    } else {
      analysis = analysis.analysis;
    }

    // Generate insights
    const insights = generateInsights(request, analysis, request_type, {
      include_assignments,
      include_trends
    });

    const result = {
      request_id: parseInt(request_id),
      request_type,
      insights,
      generated_at: new Date().toISOString(),
      cached: false
    };

    // Cache result (6 hours)
    await setCache(cacheKey, result, 21600);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Batch match multiple requests
 * POST /api/admin/swafri/ai/batch-match
 */
exports.batchMatch = async (req, res) => {
  try {
    const { requests, options = {} } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'requests must be a non-empty array',
        code: 'INVALID_REQUEST'
      });
    }

    if (requests.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many requests',
        message: 'Maximum 50 requests per batch',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    const limitPerRequest = Math.min(options.limit_per_request || 10, 20);
    const minScore = Math.max(0, Math.min(1, options.min_score || 0.5));

    const startTime = Date.now();
    const results = [];

    for (const reqItem of requests) {
      try {
        const { request_type, request_id } = reqItem;

        if (!request_type || !request_id) {
          results.push({
            request_id,
            request_type,
            status: 'error',
            error: 'Missing request_type or request_id'
          });
          continue;
        }

        // Use existing match endpoint logic
        let request;
        if (request_type === 'talent') {
          request = await TalentRequest.findById(request_id);
        } else {
          request = await ProjectRequest.findById(request_id);
        }

        if (!request) {
          results.push({
            request_id,
            request_type,
            status: 'error',
            error: 'Request not found'
          });
          continue;
        }

        // Get analysis
        const analysisCacheKey = `ai:analysis:request:${request_type}:${request_id}`;
        let analysis = await getCache(analysisCacheKey);
        
        if (!analysis) {
          analysis = await analyzeRequest(request, request_type);
        } else {
          analysis = analysis.analysis;
        }

        // Get talents and match
        const allTalents = await TalentPoolRegistration.findAll();
        const matchResult = await matchTalentsWithAI(
          request, 
          allTalents, 
          analysis, 
          minScore
        );

        results.push({
          request_id: parseInt(request_id),
          request_type,
          matches_count: matchResult.matches.length,
          top_match_score: matchResult.matches[0]?.match_score || 0,
          status: 'completed'
        });

      } catch (error) {
        logger.error(`Error processing batch item ${reqItem.request_id}:`, error);
        results.push({
          request_id: reqItem.request_id,
          request_type: reqItem.request_type,
          status: 'error',
          error: error.message
        });
      }
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        results,
        processing_time_ms: processingTime,
        total_requests: requests.length,
        completed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in batch match:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Update talent profile from CV
 * POST /api/admin/swafri/ai/update-talent-from-cv
 */
exports.updateTalentFromCV = async (req, res) => {
  try {
    const { talent_id, cv_url, cv_file_path, auto_update = false, update_fields } = req.body;

    if (!talent_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'talent_id is required',
        code: 'INVALID_REQUEST'
      });
    }

    if (!cv_url && !cv_file_path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Either cv_url or cv_file_path is required',
        code: 'INVALID_REQUEST'
      });
    }

    // Analyze CV
    const cvAnalysis = await analyzeCV(cv_url, cv_file_path, talent_id);

    // Get current talent profile
    const talent = await TalentPoolRegistration.findById(talent_id);
    if (!talent) {
      return res.status(404).json({
        success: false,
        error: 'Talent not found',
        message: `Talent with ID ${talent_id} not found`,
        code: 'REQUEST_NOT_FOUND'
      });
    }

    // Determine fields to update
    const fieldsToUpdate = auto_update 
      ? ['skills', 'education_level', 'years_experience']
      : (update_fields || []);

    const updatedFields = [];
    const suggestedUpdates = [];

    // Update fields if auto_update is true or field is in update_fields
    if (fieldsToUpdate.includes('skills') && cvAnalysis.extracted_data.skills.length > 0) {
      const currentSkills = typeof talent.skills === 'string' 
        ? JSON.parse(talent.skills) 
        : (Array.isArray(talent.skills) ? talent.skills : []);
      
      const newSkills = [...new Set([...currentSkills, ...cvAnalysis.extracted_data.skills])];
      
      if (auto_update || update_fields?.includes('skills')) {
        await TalentPoolRegistration.update(talent_id, { skills: newSkills });
        updatedFields.push('skills');
      } else {
        suggestedUpdates.push({
          field: 'skills',
          current: currentSkills,
          suggested: newSkills,
          confidence: cvAnalysis.confidence.skills
        });
      }
    }

    // Update education level if available
    if (fieldsToUpdate.includes('education_level') && cvAnalysis.extracted_data.education.length > 0) {
      const highestEducation = cvAnalysis.extracted_data.education[0];
      if (auto_update || update_fields?.includes('education_level')) {
        await TalentPoolRegistration.update(talent_id, { 
          education_level: highestEducation.degree || talent.education_level 
        });
        updatedFields.push('education_level');
      }
    }

    // Update years of experience if available
    if (fieldsToUpdate.includes('years_experience') && cvAnalysis.extracted_data.experience_years) {
      const experienceYears = cvAnalysis.extracted_data.experience_years;
      // Map to range format
      let yearsRange = '3-5';
      if (experienceYears < 1) yearsRange = '0-1';
      else if (experienceYears < 3) yearsRange = '1-3';
      else if (experienceYears < 5) yearsRange = '3-5';
      else if (experienceYears < 10) yearsRange = '5-10';
      else yearsRange = '10+';

      if (auto_update || update_fields?.includes('years_experience')) {
        await TalentPoolRegistration.update(talent_id, { years_experience: yearsRange });
        updatedFields.push('years_experience');
      } else {
        suggestedUpdates.push({
          field: 'years_experience',
          current: talent.years_experience,
          suggested: yearsRange,
          confidence: cvAnalysis.confidence.experience
        });
      }
    }

    // Similar logic for other fields...

    // Invalidate caches
    await invalidateTalentCache(talent_id);

    res.json({
      success: true,
      data: {
        talent_id: parseInt(talent_id),
        updated_fields: updatedFields,
        suggested_updates: suggestedUpdates,
        requires_review: suggestedUpdates.length > 0,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error updating talent from CV:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
};

/**
 * Generate insights helper
 */
function generateInsights(request, analysis, requestType, options) {
  const insights = {
    summary: analysis.ai_summary || 'Analysis completed.',
    recommendations: [],
    market_analysis: {
      talent_availability: 'medium',
      average_match_score: 0.7,
      competition_level: 'moderate',
      estimated_time_to_fill: '2-3 weeks'
    },
    risk_assessment: {
      overall_risk: analysis.risk_factors?.length > 0 ? 'medium' : 'low',
      risks: analysis.risk_factors || []
    },
    success_prediction: {
      probability: 0.75,
      factors: [
        'Strong talent pool match',
        'Reasonable budget range',
        'Good availability of candidates'
      ]
    }
  };

  // Add recommendations based on analysis
  if (analysis.extracted_requirements.urgency === 'high') {
    insights.recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Prioritize immediate action',
      description: 'Request indicates high urgency',
      reasoning: 'Timeline requires immediate attention'
    });
  }

  if (analysis.missing_information.length > 0) {
    insights.recommendations.push({
      type: 'warning',
      priority: 'medium',
      title: 'Missing information',
      description: 'Some critical information is missing',
      reasoning: 'Consider requesting additional details'
    });
  }

  return insights;
}

