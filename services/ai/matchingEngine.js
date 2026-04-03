/**
 * AI Matching Engine Service
 * Matches talents from the talent pool to requests with enhanced scoring
 */

const logger = require('../../utils/logger');
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
        logger.info(`Google Gemini initialized for talent matching with model: ${workingModel}`);
      } else {
        logger.warn('Google Gemini initialized but no working model found');
      }
    }
  } catch (error) {
    logger.warn('Gemini initialization failed for matching:', error.message);
  }
}

initGemini();

/**
 * Match talents with AI-enhanced scoring
 */
async function matchTalentsWithAI(request, talents, analysis, minScore = 0.5) {
  logger.info(`[AI Matching] Starting talent matching process`, {
    total_talents: talents.length,
    min_score: minScore,
    gemini_available: !!gemini,
    gemini_configured: !!process.env.GEMINI_API_KEY
  });

  const matches = [];
  const startTime = Date.now();
  let aiReasoningCount = 0;
  let templateReasoningCount = 0;

  for (const talent of talents) {
    try {
      const matchScore = await calculateMatchScore(request, talent, analysis);
      
      if (matchScore.overall_score >= minScore) {
        const match = {
          talent_id: talent.id,
          talent_name: talent.full_name,
          talent_email: talent.email,
          match_score: matchScore.overall_score,
          confidence: matchScore.confidence,
          reasoning: await generateReasoning(request, talent, matchScore, (used) => {
            if (used) aiReasoningCount++;
            else templateReasoningCount++;
          }),
          strengths: matchScore.strengths,
          concerns: matchScore.concerns,
          skill_match: matchScore.skill_match,
          experience_match: matchScore.experience_match,
          availability_match: matchScore.availability_match,
          work_preference_match: matchScore.work_preference_match,
          overall_fit: getFitLevel(matchScore.overall_score),
          recommendation: getRecommendation(matchScore.overall_score)
        };

        matches.push(match);
      }
    } catch (error) {
      logger.error(`Error matching talent ${talent.id}:`, error);
      // Continue with next talent
    }
  }

  // Sort by match score descending
  matches.sort((a, b) => b.match_score - a.match_score);

  const processingTime = Date.now() - startTime;

  logger.info(`[AI Matching] Matching process completed`, {
    total_talents: talents.length,
    matches_found: matches.length,
    processing_time_ms: processingTime,
    avg_time_per_talent_ms: Math.round(processingTime / talents.length),
    ai_reasoning_count: aiReasoningCount,
    template_reasoning_count: templateReasoningCount,
    gemini_used: aiReasoningCount > 0
  });

  return {
    matches,
    total_talents_analyzed: talents.length,
    matching_metadata: {
      algorithm_version: '1.0',
      processing_time_ms: processingTime,
      cached: false,
      ai_reasoning_used: aiReasoningCount > 0
    }
  };
}

/**
 * Calculate comprehensive match score
 */
async function calculateMatchScore(request, talent, analysis) {
  // Parse talent skills (stored as JSON string)
  let talentSkills = [];
  try {
    if (typeof talent.skills === 'string') {
      talentSkills = JSON.parse(talent.skills);
    } else if (Array.isArray(talent.skills)) {
      talentSkills = talent.skills;
    }
  } catch (error) {
    logger.warn('Error parsing talent skills:', error);
  }

  // 1. Skill matching (40% weight)
  const skillMatch = calculateSkillMatch(
    analysis.extracted_requirements.required_skills || [],
    talentSkills
  );

  // 2. Experience matching (25% weight)
  const experienceMatch = calculateExperienceMatch(
    analysis.extracted_requirements.experience_level,
    talent.years_experience
  );

  // 3. Availability matching (15% weight)
  const availabilityMatch = calculateAvailabilityMatch(
    request.timeline || request.project_timeline,
    talent.availability
  );

  // 4. Work preference matching (10% weight)
  const workPreferenceMatch = calculateWorkPreferenceMatch(
    request.work_arrangement || analysis.extracted_requirements.work_arrangement,
    talent.preferred_work_type
  );

  // 5. Education matching (10% weight)
  const educationMatch = calculateEducationMatch(talent.education_level);

  // Calculate overall score
  const overallScore = (
    skillMatch.score * 0.40 +
    experienceMatch.score * 0.25 +
    availabilityMatch.score * 0.15 +
    workPreferenceMatch.score * 0.10 +
    educationMatch.score * 0.10
  );

  // Determine confidence
  const confidence = overallScore > 0.8 ? 'high' :
                    overallScore > 0.6 ? 'medium' : 'low';

  return {
    overall_score: Math.round(overallScore * 100) / 100, // Round to 2 decimals
    confidence,
    skill_match: skillMatch,
    experience_match: experienceMatch,
    availability_match: availabilityMatch,
    work_preference_match: workPreferenceMatch,
    education_match: educationMatch,
    strengths: identifyStrengths(skillMatch, experienceMatch, availabilityMatch, workPreferenceMatch),
    concerns: identifyConcerns(skillMatch, experienceMatch, availabilityMatch, workPreferenceMatch)
  };
}

/**
 * Calculate skill match score
 */
function calculateSkillMatch(requiredSkills, talentSkills) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return { 
      score: 0.5, 
      required: [], 
      matched: [], 
      missing: [],
      match_percentage: 50
    };
  }

  const required = requiredSkills.map(s => s.toLowerCase().trim());
  const talent = talentSkills.map(s => {
    const skill = typeof s === 'string' ? s.toLowerCase().trim() : String(s).toLowerCase().trim();
    return skill;
  });

  const matched = required.filter(skill => 
    talent.some(t => {
      // Exact match or contains match
      return t === skill || t.includes(skill) || skill.includes(t);
    })
  );
  
  const missing = required.filter(skill => !matched.includes(skill));
  const matchPercentage = matched.length / required.length;

  return {
    score: matchPercentage,
    required: requiredSkills,
    matched: matched.map(m => {
      // Find original case from required skills
      return requiredSkills.find(r => r.toLowerCase().trim() === m) || m;
    }),
    missing: missing.map(m => {
      return requiredSkills.find(r => r.toLowerCase().trim() === m) || m;
    }),
    match_percentage: Math.round(matchPercentage * 100)
  };
}

/**
 * Calculate experience match score
 */
function calculateExperienceMatch(requiredLevel, talentExperience) {
  const levelMap = {
    'junior': 1,
    'mid': 2,
    'mid-level': 2,
    'senior': 3,
    'lead': 4,
    'expert': 4
  };

  const experienceMap = {
    '0-1': 1,
    '1-3': 1.5,
    '3-5': 2,
    '5-10': 3,
    '10+': 4,
    '10-15': 3.5,
    '15+': 4
  };

  const required = levelMap[requiredLevel?.toLowerCase()] || 2;
  const talent = experienceMap[talentExperience] || 2;

  // Calculate score: closer values = higher score
  const diff = Math.abs(required - talent);
  const score = Math.max(0, 1 - (diff / 3)); // Normalize to 0-1

  return {
    score: Math.round(score * 100) / 100,
    required: requiredLevel || 'mid',
    talent_level: getExperienceLevel(talentExperience),
    match: score > 0.7
  };
}

/**
 * Calculate availability match score
 */
function calculateAvailabilityMatch(requestTimeline, talentAvailability) {
  const availabilityMap = {
    'immediate': 1.0,
    'immediately': 1.0,
    'within-week': 0.9,
    'within-2-weeks': 0.8,
    'within-month': 0.7,
    'within-2-months': 0.6,
    'within-quarter': 0.5,
    'planning': 0.3,
    'not-available': 0.1
  };

  const score = availabilityMap[talentAvailability?.toLowerCase()] || 0.5;

  // If request timeline is urgent, penalize non-immediate availability
  let adjustedScore = score;
  if (requestTimeline && (
    requestTimeline.toLowerCase().includes('immediate') || 
    requestTimeline.toLowerCase().includes('urgent')
  )) {
    if (score < 0.8) {
      adjustedScore = score * 0.7; // Penalize
    }
  }

  return {
    score: Math.round(adjustedScore * 100) / 100,
    required: 'immediate',
    talent_availability: talentAvailability || 'unknown',
    match: adjustedScore >= 0.7
  };
}

/**
 * Calculate work preference match score
 */
function calculateWorkPreferenceMatch(requestPreference, talentPreference) {
  if (!requestPreference || !talentPreference) {
    return { 
      score: 0.5, 
      required: requestPreference || 'flexible',
      talent_preference: talentPreference || 'flexible',
      match: false 
    };
  }

  const req = requestPreference.toLowerCase();
  const tal = talentPreference.toLowerCase();

  const match = req === tal ||
                req === 'flexible' ||
                tal === 'flexible' ||
                (req === 'remote' && tal === 'hybrid') ||
                (req === 'hybrid' && tal === 'remote');

  return {
    score: match ? 1.0 : 0.3,
    required: requestPreference,
    talent_preference: talentPreference,
    match
  };
}

/**
 * Calculate education match score
 */
function calculateEducationMatch(educationLevel) {
  if (!educationLevel) {
    return { score: 0.7 }; // Default score if unknown
  }

  const educationScores = {
    'phd': 1.0,
    'doctorate': 1.0,
    'master': 0.9,
    'masters': 0.9,
    'bachelor': 0.8,
    'bachelors': 0.8,
    'degree': 0.8,
    'diploma': 0.6,
    'certificate': 0.5,
    'high-school': 0.4,
    'high school': 0.4
  };

  const level = educationLevel.toLowerCase();
  const score = educationScores[level] || 0.7;

  return { score };
}

/**
 * Identify strengths
 */
function identifyStrengths(skillMatch, experienceMatch, availabilityMatch, workPreferenceMatch) {
  const strengths = [];
  
  if (skillMatch.score > 0.8) {
    strengths.push(`Excellent skill match (${skillMatch.match_percentage}% overlap)`);
  } else if (skillMatch.score > 0.6) {
    strengths.push(`Good skill match (${skillMatch.match_percentage}% overlap)`);
  }
  
  if (experienceMatch.match) {
    strengths.push('Experience level matches requirement');
  }
  
  if (availabilityMatch.score > 0.8) {
    strengths.push('Available immediately');
  } else if (availabilityMatch.score > 0.6) {
    strengths.push('Good availability');
  }
  
  if (workPreferenceMatch.match) {
    strengths.push('Work arrangement preference aligns');
  }

  return strengths;
}

/**
 * Identify concerns
 */
function identifyConcerns(skillMatch, experienceMatch, availabilityMatch, workPreferenceMatch) {
  const concerns = [];
  
  if (skillMatch.missing.length > 0) {
    concerns.push(`Missing skills: ${skillMatch.missing.slice(0, 3).join(', ')}${skillMatch.missing.length > 3 ? '...' : ''}`);
  }
  
  if (!experienceMatch.match) {
    concerns.push('Experience level may not match requirement');
  }
  
  if (availabilityMatch.score < 0.5) {
    concerns.push('Availability may not align with timeline');
  }
  
  if (!workPreferenceMatch.match) {
    concerns.push('Work arrangement preference may not align');
  }

  return concerns;
}

/**
 * Generate reasoning for match
 */
async function generateReasoning(request, talent, matchScore, trackUsage = null) {
  // Try AI-generated reasoning if available
  if (gemini && matchScore.overall_score > 0.6) {
    try {
      logger.info(`[AI Matching] Using Gemini for reasoning generation`, {
        talent_id: talent.id,
        match_score: matchScore.overall_score
      });
      
      // Get working model (will detect if not already cached)
      const modelName = workingModel || await getWorkingModel(gemini) || process.env.GEMINI_MODEL || 'gemini-pro';
      
      if (!modelName) {
        logger.warn('[AI Matching] No working Gemini model available, using template reasoning');
        if (trackUsage) trackUsage(false);
        return generateTemplateReasoning(matchScore);
      }
      
      const apiStartTime = Date.now();
      const model = gemini.getGenerativeModel({ model: modelName });

      const prompt = `You are an expert talent matching AI with deep understanding of software development roles and team dynamics.

TASK: Write a compelling, detailed explanation of why this talent is an excellent match for this request.

REQUEST REQUIREMENTS:
${request.talent_needed || request.project_details || 'N/A'}

TALENT PROFILE:
- Skills: ${Array.isArray(talent.skills) ? talent.skills.join(', ') : (talent.skills || 'N/A')}
- Experience: ${talent.years_experience || 'N/A'} years
- Education: ${talent.education_level || 'N/A'}
- Availability: ${talent.availability || 'N/A'}
- Work Preference: ${talent.preferred_work_type || 'N/A'}

MATCH ANALYSIS:
- Overall Match Score: ${(matchScore.overall_score * 100).toFixed(0)}%
- Skill Match: ${(matchScore.skill_match.match_percentage || 0)}% (Matched: ${matchScore.skill_match.matched?.join(', ') || 'N/A'})
- Experience Match: ${matchScore.experience_match.match ? 'Yes' : 'No'}
- Key Strengths: ${matchScore.strengths.join(', ')}

INSTRUCTIONS:
Write a professional, detailed 2-3 sentence explanation that:
1. Highlights the specific skills and experience that make this talent ideal
2. Explains how their background aligns with the project requirements
3. Mentions any standout qualifications or unique value they bring
4. Uses persuasive, professional language suitable for client presentation

Be specific, detailed, and compelling. Focus on concrete matches rather than generic statements.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6, // Balanced for creativity and accuracy
          maxOutputTokens: 300, // Increased for more detailed reasoning
          topP: 0.9,
          topK: 40
        }
      });

      const apiDuration = Date.now() - apiStartTime;
      const response = await result.response;
      const reasoning = response.text().trim();
      
      logger.info(`[AI Matching] ✅ Gemini reasoning generated`, {
        talent_id: talent.id,
        duration_ms: apiDuration,
        reasoning_length: reasoning.length
      });
      
      if (trackUsage) trackUsage(true);
      return reasoning;
    } catch (error) {
      logger.warn(`[AI Matching] ⚠️ Gemini reasoning generation failed, using template`, {
        talent_id: talent.id,
        error: error.message
      });
      if (trackUsage) trackUsage(false);
    }
  } else {
    if (matchScore.overall_score <= 0.6) {
      logger.info(`[AI Matching] Using template reasoning (score ${matchScore.overall_score} <= 0.6)`, {
        talent_id: talent.id
      });
    } else if (!gemini) {
      logger.info(`[AI Matching] Using template reasoning (Gemini not available)`, {
        talent_id: talent.id
      });
    }
    if (trackUsage) trackUsage(false);
  }

  // Fallback to template-based reasoning
  return generateTemplateReasoning(matchScore);
}

/**
 * Generate template-based reasoning
 */
function generateTemplateReasoning(matchScore) {
  if (matchScore.overall_score > 0.8) {
    return `Excellent match: ${matchScore.strengths[0] || 'Meets all critical requirements'}. ${matchScore.strengths[1] || ''}`;
  } else if (matchScore.overall_score > 0.6) {
    return `Good match: ${matchScore.strengths[0] || 'Meets most requirements'}.`;
  } else {
    return `Fair match: Consider if ${matchScore.concerns[0] || 'requirements can be flexible'}.`;
  }
}

/**
 * Get fit level from score
 */
function getFitLevel(score) {
  if (score >= 0.8) return 'excellent';
  if (score >= 0.6) return 'good';
  if (score >= 0.4) return 'fair';
  return 'poor';
}

/**
 * Get recommendation from score
 */
function getRecommendation(score) {
  if (score >= 0.8) return 'strongly_recommend';
  if (score >= 0.6) return 'recommend';
  if (score >= 0.4) return 'consider';
  return 'not_recommended';
}

/**
 * Get experience level from years
 */
function getExperienceLevel(yearsExperience) {
  if (!yearsExperience) return 'mid';
  
  const map = {
    '0-1': 'junior',
    '1-3': 'junior',
    '3-5': 'mid',
    '5-10': 'senior',
    '10+': 'senior',
    '10-15': 'senior',
    '15+': 'senior'
  };
  
  return map[yearsExperience] || 'mid';
}

module.exports = { matchTalentsWithAI };

