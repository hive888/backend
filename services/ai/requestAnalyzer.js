/**
 * Request Analyzer Service
 * Analyzes talent and project requests to extract structured requirements
 */

const logger = require('../../utils/logger');
const { getWorkingModel } = require('./geminiModelDetector');
const { isRateLimited, recordRateLimit, extractRetryDelay, isRateLimitError, waitForRateLimit } = require('./rateLimitHandler');

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
        logger.info(`Google Gemini initialized for request analysis with model: ${workingModel}`);
      } else {
        logger.warn('Google Gemini initialized but no working model found');
      }
    } else {
      logger.warn('Gemini API key not found, using rule-based analysis only');
    }
  } catch (error) {
    logger.warn('Gemini initialization failed, using rule-based analysis:', error.message);
  }
}

initGemini();

/**
 * Analyze a request and extract structured requirements
 */
async function analyzeRequest(request, requestType) {
  try {
    // Combine all text fields for analysis
    const requestText = buildRequestText(request, requestType);
    const textLength = requestText.length;

    logger.info(`[AI Analyzer] Starting analysis for ${requestType} request`, {
      request_type: requestType,
      text_length: textLength,
      gemini_available: !!gemini,
      gemini_configured: !!process.env.GEMINI_API_KEY
    });

    let analysis = null;
    let aiUsed = false;
    const aiStartTime = Date.now();

    // Try AI analysis first if available
    if (gemini) {
      try {
        logger.info(`[AI Analyzer] Attempting Gemini AI analysis for ${requestType} request`);
        analysis = await analyzeWithAI(requestText, requestType);
        const aiDuration = Date.now() - aiStartTime;
        aiUsed = true;
        logger.info(`[AI Analyzer] ✅ Gemini AI analysis successful`, {
          request_type: requestType,
          duration_ms: aiDuration,
          skills_extracted: analysis?.required_skills?.length || 0
        });
      } catch (error) {
        const aiDuration = Date.now() - aiStartTime;
        
        // Handle rate limit errors
        if (isRateLimitError(error)) {
          const retryDelay = extractRetryDelay(error);
          const modelName = workingModel || process.env.GEMINI_MODEL || 'gemini-pro';
          recordRateLimit(modelName, retryDelay);
          
          logger.warn(`[AI Analyzer] ⚠️ Rate limit exceeded for Gemini API`, {
            request_type: requestType,
            duration_ms: aiDuration,
            model: modelName,
            retry_after_seconds: retryDelay,
            message: 'Falling back to rule-based analysis. Will retry after rate limit resets.'
          });
        } else {
          logger.warn(`[AI Analyzer] ⚠️ Gemini AI analysis failed, falling back to rule-based`, {
            request_type: requestType,
            duration_ms: aiDuration,
            error: error.message,
            error_code: error.code || 'UNKNOWN'
          });
        }
        
        analysis = null;
        aiUsed = false;
      }
    } else {
      logger.info(`[AI Analyzer] ⚠️ Gemini not available, using rule-based analysis only`, {
        request_type: requestType,
        reason: process.env.GEMINI_API_KEY ? 'Gemini initialization failed' : 'GEMINI_API_KEY not set'
      });
    }

    // Fallback to rule-based analysis
    if (!analysis) {
      const fallbackStartTime = Date.now();
      analysis = fallbackAnalysis(request, requestType);
      const fallbackDuration = Date.now() - fallbackStartTime;
      logger.info(`[AI Analyzer] Using rule-based fallback analysis`, {
        request_type: requestType,
        duration_ms: fallbackDuration,
        skills_extracted: analysis?.required_skills?.length || 0
      });
    }

    // Enhance with rule-based extraction
    const enhanced = enhanceWithRules(request, analysis, requestType);

    // Assess data quality
    const dataQuality = assessDataQuality(request, requestType);
    
    // Enhance missing information detection
    const missingInfo = identifyMissingInfo(request, requestType);
    
    // Adjust confidence based on data quality
    const baseConfidence = calculateConfidence(enhanced);
    const qualityAdjustedConfidence = dataQuality.score < 0.5 ? 'low' : 
                                      dataQuality.score < 0.7 ? 'medium' : baseConfidence;

    const result = {
      extracted_requirements: {
        required_skills: enhanced.required_skills || [],
        experience_level: enhanced.experience_level || request.experience_level || 'mid',
        team_size: request.team_size || null,
        work_arrangement: enhanced.work_arrangement || request.work_arrangement || 'remote',
        budget_range: request.budget_range || request.project_budget || null,
        timeline: request.timeline || request.project_timeline || null,
        technologies: extractTechnologies(request, requestType),
        soft_skills: enhanced.soft_skills || [],
        urgency: enhanced.urgency || 'medium'
      },
      missing_information: missingInfo.length > 0 ? missingInfo : (enhanced.missing_information || []),
      data_quality: dataQuality,
      suggested_tags: generateTags(enhanced, requestType),
      complexity_score: enhanced.complexity_score || 0.5,
      risk_factors: enhanced.risk_factors || [],
      ai_summary: enhanced.ai_summary || generateSummary(request, requestType),
      confidence: qualityAdjustedConfidence,
      quality_warning: dataQuality.score < 0.5 ? 'Data quality is insufficient for comprehensive analysis. Please provide more detailed information.' : null,
      ai_used: aiUsed,
      ai_provider: aiUsed ? 'gemini' : 'rule-based'
    };

    logger.info(`[AI Analyzer] Analysis complete for ${requestType} request`, {
      request_type: requestType,
      ai_used: aiUsed,
      ai_provider: aiUsed ? 'gemini' : 'rule-based',
      skills_count: result.extracted_requirements.required_skills.length,
      data_quality_score: dataQuality.score,
      missing_info_count: missingInfo.length
    });

    return result;
  } catch (error) {
    logger.error('Request analysis error:', error);
    throw new Error('Failed to analyze request: ' + error.message);
  }
}

/**
 * Build request text from request object
 */
function buildRequestText(request, requestType) {
  if (requestType === 'talent') {
    return `
      Request Type: Talent Matching
      About: ${request.about_yourself || ''}
      Requirements: ${request.talent_needed || ''}
      Technologies: ${request.technologies || ''}
      Experience Level: ${request.experience_level || ''}
      Work Arrangement: ${request.work_arrangement || ''}
      Timeline: ${request.timeline || ''}
      Budget: ${request.budget_range || ''}
      Team Size: ${request.team_size || ''}
    `;
  } else {
    return `
      Request Type: Project Outsourcing
      Project Details: ${request.project_details || ''}
      Project Type: ${request.project_type || ''}
      Technologies: ${request.project_technologies || ''}
      Timeline: ${request.project_timeline || ''}
      Budget: ${request.project_budget || ''}
      Project Stage: ${request.project_stage || ''}
    `;
  }
}

/**
 * Analyze request using Google Gemini
 */
async function analyzeWithAI(requestText, requestType) {
  if (!gemini) return null;

  // Get working model (will detect if not already cached)
  const modelName = workingModel || await getWorkingModel(gemini) || process.env.GEMINI_MODEL || 'gemini-pro';
  
  if (!modelName) {
    logger.warn('[AI Analyzer] No working Gemini model available');
    return null;
  }

  // Check if rate limited
  if (isRateLimited(modelName)) {
    logger.warn(`[AI Analyzer] Rate limited for ${modelName}, skipping AI analysis`);
    return null;
  }

  logger.info(`[AI Analyzer] Calling Gemini API (${modelName})`, {
    model: modelName,
    request_type: requestType,
    text_length: requestText.length
  });

  const apiStartTime = Date.now();
  const model = gemini.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert talent acquisition and project management AI analyst with deep expertise in software development, team building, and business requirements analysis.

TASK: Perform a comprehensive, in-depth analysis of this ${requestType} request and extract all relevant structured information.

REQUEST DETAILS:
${requestText}

ANALYSIS REQUIREMENTS:
1. **Required Skills**: Extract ALL technical skills, frameworks, tools, and technologies mentioned or implied. Include:
   - Programming languages (e.g., JavaScript, Python, Java)
   - Frameworks and libraries (e.g., React, Django, Spring Boot)
   - Databases (e.g., PostgreSQL, MongoDB, Redis)
   - Cloud platforms (e.g., AWS, Azure, GCP)
   - DevOps tools (e.g., Docker, Kubernetes, CI/CD)
   - Any domain-specific technologies

2. **Experience Level**: Determine the required experience level based on:
   - Complexity of requirements
   - Leadership responsibilities mentioned
   - Years of experience implied
   - Technical depth required
   Options: "junior", "mid", "senior", "lead", "architect"

3. **Work Arrangement**: Identify preferred work arrangement from context
   Options: "remote", "onsite", "hybrid", "flexible"

4. **Urgency**: Assess urgency based on timeline and language used
   Options: "critical" (immediate/urgent), "high" (within 2 weeks), "medium" (1-3 months), "low" (planning phase)

5. **Missing Information**: Identify ALL gaps and areas needing clarification:
   - Critical missing details (high priority)
   - Important but not critical (medium priority)
   - Nice-to-have details (low priority)
   For each, provide specific, actionable suggestions

6. **AI Summary**: Write a comprehensive 3-4 sentence summary that:
   - Captures the essence of the request
   - Highlights key requirements
   - Notes any special considerations
   - Provides context for matching

7. **Complexity Score**: Calculate complexity (0.0 to 1.0) based on:
   - Technical complexity
   - Scope and scale
   - Integration requirements
   - Team size needed
   - Timeline constraints

8. **Risk Factors**: Identify potential risks with:
   - Type: "timeline", "budget", "skill_shortage", "scope_creep", "technical_challenge", "team_dynamics"
   - Severity: "critical", "high", "medium", "low"
   - Detailed description of the risk

9. **Soft Skills**: Extract all soft skills, personality traits, and cultural fit requirements mentioned

10. **Additional Insights**: Provide any other relevant insights that would help with talent matching or project planning

OUTPUT FORMAT:
Return a comprehensive JSON object with all fields above. Be thorough, detailed, and insightful. Think deeply about the requirements and provide valuable analysis that goes beyond surface-level extraction.

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no additional text. Pure JSON only.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2, // Lower for more consistent, focused analysis
      maxOutputTokens: 4000, // Increased for comprehensive responses
      responseMimeType: 'application/json',
      topP: 0.95,
      topK: 40
    }
  });

  const apiDuration = Date.now() - apiStartTime;
  const response = await result.response;
  const text = response.text();
  
  logger.info(`[AI Analyzer] Gemini API response received`, {
    model: modelName,
    duration_ms: apiDuration,
    response_length: text.length,
    tokens_used: response.usageMetadata?.totalTokenCount || 'unknown',
    response_preview: text.substring(0, 100)
  });
  
  // Clean the response text (remove markdown code blocks if present)
  let cleanedText = text.trim();
  
  // Remove markdown code blocks if present
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    const parsed = JSON.parse(cleanedText);
    logger.info(`[AI Analyzer] Successfully parsed Gemini JSON response`, {
      skills_found: parsed.required_skills?.length || 0,
      has_summary: !!parsed.ai_summary
    });
    return parsed;
  } catch (error) {
    logger.warn(`[AI Analyzer] Failed to parse Gemini JSON, attempting extraction`, {
      error: error.message,
      response_length: cleanedText.length,
      response_preview: cleanedText.substring(0, 500)
    });
    
    // Try to extract JSON from response (handle incomplete JSON)
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        logger.info(`[AI Analyzer] Successfully extracted JSON from response`);
        return extracted;
      } catch (extractError) {
        logger.warn(`[AI Analyzer] JSON extraction also failed:`, extractError.message);
      }
    }
    
    // If all parsing fails, log the full response for debugging
    logger.error(`[AI Analyzer] Complete response that failed to parse:`, {
      response: cleanedText,
      length: cleanedText.length
    });
    
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

/**
 * Rule-based fallback analysis
 */
function fallbackAnalysis(request, requestType) {
  const technologies = extractTechnologies(request, requestType);
  const skills = extractSkillsFromText(
    (requestType === 'talent' ? request.talent_needed : request.project_details) || ''
  );

  return {
    required_skills: [...new Set([...skills, ...technologies])],
    experience_level: request.experience_level || 'mid',
    work_arrangement: request.work_arrangement || 'remote',
    urgency: determineUrgency(request, requestType),
    missing_information: identifyMissingInfo(request, requestType),
    ai_summary: generateSummary(request, requestType),
    complexity_score: calculateComplexityScore(request, requestType),
    risk_factors: identifyRiskFactors(request, requestType),
    soft_skills: []
  };
}

/**
 * Enhance AI analysis with rule-based extraction
 */
function enhanceWithRules(request, aiAnalysis, requestType) {
  const technologies = extractTechnologies(request, requestType);
  const textSkills = extractSkillsFromText(
    (requestType === 'talent' ? request.talent_needed : request.project_details) || ''
  );

  return {
    ...aiAnalysis,
    required_skills: [
      ...new Set([
        ...(aiAnalysis.required_skills || []),
        ...technologies,
        ...textSkills
      ])
    ]
  };
}

/**
 * Extract technologies from request
 */
function extractTechnologies(request, requestType) {
  const techString = requestType === 'talent' 
    ? (request.technologies || '')
    : (request.project_technologies || '');
  
  if (!techString) return [];
  
  return techString
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Extract skills from text using keyword matching
 */
function extractSkillsFromText(text) {
  if (!text) return [];

  const commonSkills = [
    'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'JavaScript',
    'TypeScript', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Docker',
    'Kubernetes', 'GraphQL', 'REST API', 'Express', 'Next.js', 'Nuxt',
    'Django', 'Flask', 'Spring', 'Laravel', 'PHP', 'Ruby', 'Go', 'Rust',
    'Swift', 'Kotlin', 'React Native', 'Flutter', 'iOS', 'Android',
    'HTML', 'CSS', 'SASS', 'LESS', 'Tailwind', 'Bootstrap', 'Git',
    'CI/CD', 'Jenkins', 'GitLab', 'GitHub Actions', 'Terraform', 'Ansible'
  ];

  const foundSkills = [];
  const lowerText = text.toLowerCase();

  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }

  return foundSkills;
}

/**
 * Generate tags based on analysis
 */
function generateTags(analysis, requestType) {
  const tags = [];
  
  if (analysis.required_skills) {
    if (analysis.required_skills.some(s => ['React', 'Vue', 'Angular'].includes(s))) {
      tags.push('frontend');
    }
    if (analysis.required_skills.some(s => ['Node.js', 'Python', 'Java'].includes(s))) {
      tags.push('backend');
    }
    if (analysis.required_skills.some(s => ['React', 'Node.js'].includes(s))) {
      tags.push('fullstack');
    }
  }

  if (analysis.experience_level === 'senior') {
    tags.push('senior');
  }

  if (requestType === 'project') {
    tags.push('project');
  } else {
    tags.push('talent');
  }

  return tags;
}

/**
 * Calculate confidence level
 */
function calculateConfidence(analysis) {
  if (analysis.required_skills?.length > 3 && analysis.ai_summary) {
    return 'high';
  }
  if (analysis.required_skills?.length > 0) {
    return 'medium';
  }
  return 'low';
}

/**
 * Determine urgency level
 */
function determineUrgency(request, requestType) {
  const timeline = requestType === 'talent' 
    ? request.timeline 
    : request.project_timeline;

  if (!timeline) return 'medium';

  const lowerTimeline = timeline.toLowerCase();
  if (lowerTimeline.includes('immediate') || lowerTimeline.includes('urgent')) {
    return 'high';
  }
  if (lowerTimeline.includes('planning') || lowerTimeline.includes('future')) {
    return 'low';
  }
  return 'medium';
}

/**
 * Identify missing information and assess data quality
 */
function identifyMissingInfo(request, requestType) {
  const missing = [];
  const dataQuality = assessDataQuality(request, requestType);

  if (requestType === 'talent') {
    // Check for missing critical fields
    if (!request.timeline || request.timeline.trim().length < 3) {
      missing.push({
        field: 'timeline',
        suggestion: 'Please provide a specific timeline (e.g., "immediate", "within 2 weeks", "1-3 months")',
        priority: 'high',
        reason: 'Timeline is required to match talents with availability'
      });
    }
    
    if (!request.budget_range || request.budget_range.trim().length < 3) {
      missing.push({
        field: 'budget_range',
        suggestion: 'Please specify budget range to match appropriate talent levels',
        priority: 'high',
        reason: 'Budget helps filter talents within acceptable range'
      });
    }

    // Check content quality
    if (!request.talent_needed || request.talent_needed.trim().length < 50) {
      missing.push({
        field: 'talent_needed',
        suggestion: 'Please provide more details about the talent needed. Include: specific roles, required skills, responsibilities, team size, and any special requirements',
        priority: 'high',
        reason: 'Insufficient detail to accurately match talents'
      });
    }

    if (!request.about_yourself || request.about_yourself.trim().length < 30) {
      missing.push({
        field: 'about_yourself',
        suggestion: 'Please provide more information about your company, team, and project context',
        priority: 'medium',
        reason: 'Company context helps match talents who fit your culture'
      });
    }

    if (!request.technologies || request.technologies.trim().length < 5) {
      missing.push({
        field: 'technologies',
        suggestion: 'Please list specific technologies, frameworks, and tools required (e.g., "React, Node.js, PostgreSQL, AWS")',
        priority: 'high',
        reason: 'Technology stack is critical for accurate talent matching'
      });
    }

    if (!request.experience_level) {
      missing.push({
        field: 'experience_level',
        suggestion: 'Please specify required experience level (junior, mid, senior, lead)',
        priority: 'medium',
        reason: 'Experience level helps filter appropriate candidates'
      });
    }

  } else {
    // Project request checks
    if (!request.project_timeline || request.project_timeline.trim().length < 3) {
      missing.push({
        field: 'project_timeline',
        suggestion: 'Please provide a specific project timeline (e.g., "3-6 months", "6-12 months")',
        priority: 'high',
        reason: 'Timeline is essential for resource planning and feasibility assessment'
      });
    }

    if (!request.project_budget || request.project_budget.trim().length < 3) {
      missing.push({
        field: 'project_budget',
        suggestion: 'Please specify project budget range to determine scope and resources',
        priority: 'high',
        reason: 'Budget is critical for project planning and resource allocation'
      });
    }

    // Check project details quality
    if (!request.project_details || request.project_details.trim().length < 100) {
      missing.push({
        field: 'project_details',
        suggestion: 'Please provide comprehensive project details including: project goals, scope, features, target audience, technical requirements, success criteria, and any constraints',
        priority: 'high',
        reason: 'Insufficient project details make it difficult to provide accurate analysis and recommendations'
      });
    }

    if (!request.project_type || request.project_type.trim().length < 3) {
      missing.push({
        field: 'project_type',
        suggestion: 'Please specify project type (e.g., "web-development", "mobile-app", "e-commerce")',
        priority: 'high',
        reason: 'Project type determines required expertise and resources'
      });
    }

    if (!request.project_technologies || request.project_technologies.trim().length < 5) {
      missing.push({
        field: 'project_technologies',
        suggestion: 'Please list specific technologies, frameworks, and tools for the project (e.g., "React, Node.js, PostgreSQL, Docker, AWS")',
        priority: 'high',
        reason: 'Technology stack is essential for matching the right development team'
      });
    }

    if (!request.project_stage) {
      missing.push({
        field: 'project_stage',
        suggestion: 'Please indicate current project stage (idea, planning, design, development, maintenance)',
        priority: 'medium',
        reason: 'Project stage helps determine required resources and approach'
      });
    }
  }

  // Add data quality warnings
  if (dataQuality.score < 0.5) {
    missing.push({
      field: 'overall_data_quality',
      suggestion: 'The provided information is insufficient for comprehensive analysis. Please provide more detailed information about requirements, context, and expectations.',
      priority: 'high',
      reason: `Data quality score is ${(dataQuality.score * 100).toFixed(0)}% - below recommended threshold`
    });
  }

  return missing;
}

/**
 * Assess data quality and completeness
 */
function assessDataQuality(request, requestType) {
  let score = 0;
  let maxScore = 0;
  const issues = [];

  if (requestType === 'talent') {
    // Check required fields
    maxScore += 20;
    if (request.talent_needed && request.talent_needed.trim().length >= 100) {
      score += 20;
    } else if (request.talent_needed && request.talent_needed.trim().length >= 50) {
      score += 10;
      issues.push('talent_needed is too brief');
    } else {
      issues.push('talent_needed is missing or too short');
    }

    maxScore += 15;
    if (request.about_yourself && request.about_yourself.trim().length >= 50) {
      score += 15;
    } else if (request.about_yourself && request.about_yourself.trim().length >= 30) {
      score += 8;
      issues.push('about_yourself needs more detail');
    } else {
      issues.push('about_yourself is missing or too short');
    }

    maxScore += 15;
    if (request.technologies && request.technologies.trim().length >= 10) {
      score += 15;
    } else {
      issues.push('technologies list is missing or incomplete');
    }

    maxScore += 15;
    if (request.timeline && request.timeline.trim().length >= 3) {
      score += 15;
    } else {
      issues.push('timeline is missing');
    }

    maxScore += 15;
    if (request.budget_range && request.budget_range.trim().length >= 3) {
      score += 15;
    } else {
      issues.push('budget_range is missing');
    }

    maxScore += 10;
    if (request.experience_level) {
      score += 10;
    } else {
      issues.push('experience_level is missing');
    }

    maxScore += 10;
    if (request.work_arrangement) {
      score += 10;
    }

  } else {
    // Project request quality checks
    maxScore += 25;
    if (request.project_details && request.project_details.trim().length >= 200) {
      score += 25;
    } else if (request.project_details && request.project_details.trim().length >= 100) {
      score += 12;
      issues.push('project_details needs more comprehensive information');
    } else {
      issues.push('project_details is missing or insufficient');
    }

    maxScore += 20;
    if (request.project_type && request.project_type.trim().length >= 3) {
      score += 20;
    } else {
      issues.push('project_type is missing');
    }

    maxScore += 20;
    if (request.project_technologies && request.project_technologies.trim().length >= 10) {
      score += 20;
    } else {
      issues.push('project_technologies list is missing or incomplete');
    }

    maxScore += 15;
    if (request.project_timeline && request.project_timeline.trim().length >= 3) {
      score += 15;
    } else {
      issues.push('project_timeline is missing');
    }

    maxScore += 15;
    if (request.project_budget && request.project_budget.trim().length >= 3) {
      score += 15;
    } else {
      issues.push('project_budget is missing');
    }

    maxScore += 5;
    if (request.project_stage) {
      score += 5;
    }
  }

  const qualityScore = maxScore > 0 ? score / maxScore : 0;

  return {
    score: qualityScore,
    percentage: Math.round(qualityScore * 100),
    issues: issues,
    level: qualityScore >= 0.8 ? 'excellent' : 
           qualityScore >= 0.6 ? 'good' : 
           qualityScore >= 0.4 ? 'fair' : 'poor'
  };
}

/**
 * Generate summary
 */
function generateSummary(request, requestType) {
  if (requestType === 'talent') {
    return `Client needs ${request.talent_type || 'talent'} with ${request.experience_level || 'mid-level'} experience. ${request.talent_needed ? request.talent_needed.substring(0, 100) + '...' : 'Requirements specified.'}`;
  } else {
    return `Project type: ${request.project_type || 'development'}. ${request.project_details ? request.project_details.substring(0, 100) + '...' : 'Project details provided.'}`;
  }
}

/**
 * Calculate complexity score
 */
function calculateComplexityScore(request, requestType) {
  let score = 0.5;

  const text = requestType === 'talent' 
    ? (request.talent_needed || '')
    : (request.project_details || '');

  // More text = more complex
  if (text.length > 500) score += 0.2;
  if (text.length > 1000) score += 0.1;

  // More technologies = more complex
  const techCount = extractTechnologies(request, requestType).length;
  if (techCount > 5) score += 0.2;
  if (techCount > 10) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Identify risk factors
 */
function identifyRiskFactors(request, requestType) {
  const risks = [];
  const timeline = requestType === 'talent' 
    ? request.timeline 
    : request.project_timeline;

  if (timeline && (timeline.includes('immediate') || timeline.includes('urgent'))) {
    risks.push({
      type: 'timeline_conflict',
      severity: 'medium',
      description: 'Requested timeline may be too aggressive'
    });
  }

  return risks;
}

module.exports = { analyzeRequest };

