const TalentRequest = require('../models/talentRequestModel');
const ProjectRequest = require('../models/projectRequestModel');
const logger = require('../utils/logger');

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /\S+@\S+\.\S+/;
  return emailRegex.test(email);
}

/**
 * Validate field length
 */
function validateLength(field, value, maxLength, fieldName) {
  if (value && value.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters`;
  }
  return null;
}

/**
 * Validate talent matching request
 */
function validateTalentRequest(body) {
  const errors = {};
  
  // Required fields
  if (!body.fullName || !body.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else {
    const lengthError = validateLength('fullName', body.fullName, 100, 'Full name');
    if (lengthError) errors.fullName = lengthError;
  }

  if (!body.companyName || !body.companyName.trim()) {
    errors.companyName = 'Company name is required';
  } else {
    const lengthError = validateLength('companyName', body.companyName, 100, 'Company name');
    if (lengthError) errors.companyName = lengthError;
  }

  if (!body.email || !body.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(body.email)) {
    errors.email = 'Invalid email format';
  }

  if (!body.phone || !body.phone.trim()) {
    errors.phone = 'Phone is required';
  }

  if (!body.aboutYourself || !body.aboutYourself.trim()) {
    errors.aboutYourself = 'About yourself is required';
  } else {
    const lengthError = validateLength('aboutYourself', body.aboutYourself, 1000, 'About yourself');
    if (lengthError) errors.aboutYourself = lengthError;
  }

  if (!body.talentNeeded || !body.talentNeeded.trim()) {
    errors.talentNeeded = 'Talent needed is required';
  } else {
    const lengthError = validateLength('talentNeeded', body.talentNeeded, 1000, 'Talent needed');
    if (lengthError) errors.talentNeeded = lengthError;
  }

  if (!body.talentType || !body.talentType.trim()) {
    errors.talentType = 'Talent type is required';
  } else {
    const validTalentTypes = [
      'software-developers',
      'ui-ux-designers',
      'devops-engineers',
      'data-professionals',
      'digital-marketers',
      'project-managers',
      'qa-engineers',
      'business-analysts',
      'mixed-team',
      'other'
    ];
    if (!validTalentTypes.includes(body.talentType)) {
      errors.talentType = 'Invalid talent type';
    }
  }

  if (!body.budgetRange || !body.budgetRange.trim()) {
    errors.budgetRange = 'Budget range is required';
  } else {
    const validBudgetRanges = [
      'under-2500',
      '2500-5000',
      '5000-10000',
      '10000-20000',
      '20000-50000',
      '50000+',
      'custom'
    ];
    if (!validBudgetRanges.includes(body.budgetRange)) {
      errors.budgetRange = 'Invalid budget range';
    }
  }

  if (!body.timeline || !body.timeline.trim()) {
    errors.timeline = 'Timeline is required';
  } else {
    const validTimelines = [
      'immediately',
      'within-week',
      'within-2-weeks',
      'within-month',
      'within-quarter',
      'planning'
    ];
    if (!validTimelines.includes(body.timeline)) {
      errors.timeline = 'Invalid timeline';
    }
  }

  // Optional field validations
  if (body.companySize) {
    const validCompanySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
    if (!validCompanySizes.includes(body.companySize)) {
      errors.companySize = 'Invalid company size';
    }
  }

  if (body.teamSize) {
    const validTeamSizes = ['1', '2-3', '4-6', '7-10', '10+'];
    if (!validTeamSizes.includes(body.teamSize)) {
      errors.teamSize = 'Invalid team size';
    }
  }

  if (body.workArrangement) {
    const validWorkArrangements = ['remote', 'hybrid', 'onsite', 'flexible'];
    if (!validWorkArrangements.includes(body.workArrangement)) {
      errors.workArrangement = 'Invalid work arrangement';
    }
  }

  if (body.experienceLevel) {
    const validExperienceLevels = ['junior', 'mid', 'senior', 'lead', 'mixed'];
    if (!validExperienceLevels.includes(body.experienceLevel)) {
      errors.experienceLevel = 'Invalid experience level';
    }
  }

  if (body.technologies) {
    const lengthError = validateLength('technologies', body.technologies, 500, 'Technologies');
    if (lengthError) errors.technologies = lengthError;
  }

  if (body.jobTitle) {
    const lengthError = validateLength('jobTitle', body.jobTitle, 100, 'Job title');
    if (lengthError) errors.jobTitle = lengthError;
  }

  // GDPR consent validation
  if (body.gdprConsent !== true) {
    errors.gdprConsent = 'GDPR consent is required and must be true';
  }

  return errors;
}

/**
 * Validate project outsourcing request
 */
function validateProjectRequest(body) {
  const errors = {};
  
  // Required fields
  if (!body.fullName || !body.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else {
    const lengthError = validateLength('fullName', body.fullName, 100, 'Full name');
    if (lengthError) errors.fullName = lengthError;
  }

  if (!body.companyName || !body.companyName.trim()) {
    errors.companyName = 'Company name is required';
  } else {
    const lengthError = validateLength('companyName', body.companyName, 100, 'Company name');
    if (lengthError) errors.companyName = lengthError;
  }

  if (!body.email || !body.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(body.email)) {
    errors.email = 'Invalid email format';
  }

  if (!body.phone || !body.phone.trim()) {
    errors.phone = 'Phone is required';
  }

  if (!body.projectDetails || !body.projectDetails.trim()) {
    errors.projectDetails = 'Project details is required';
  } else {
    const lengthError = validateLength('projectDetails', body.projectDetails, 2000, 'Project details');
    if (lengthError) errors.projectDetails = lengthError;
  }

  if (!body.projectType || !body.projectType.trim()) {
    errors.projectType = 'Project type is required';
  } else {
    const validProjectTypes = [
      'web-development',
      'mobile-app',
      'e-commerce',
      'api-development',
      'cloud-migration',
      'devops-setup',
      'ai-ml',
      'blockchain',
      'other'
    ];
    if (!validProjectTypes.includes(body.projectType)) {
      errors.projectType = 'Invalid project type';
    }
  }

  if (!body.projectBudget || !body.projectBudget.trim()) {
    errors.projectBudget = 'Project budget is required';
  } else {
    const validBudgets = [
      'under-10000',
      '10000-25000',
      '25000-50000',
      '50000-100000',
      '100000-250000',
      '250000+',
      'custom'
    ];
    if (!validBudgets.includes(body.projectBudget)) {
      errors.projectBudget = 'Invalid project budget';
    }
  }

  if (!body.projectTimeline || !body.projectTimeline.trim()) {
    errors.projectTimeline = 'Project timeline is required';
  } else {
    const validTimelines = [
      '1-3-months',
      '3-6-months',
      '6-12-months',
      '12-18-months',
      '18+months',
      'ongoing'
    ];
    if (!validTimelines.includes(body.projectTimeline)) {
      errors.projectTimeline = 'Invalid project timeline';
    }
  }

  // Optional field validations
  if (body.companySize) {
    const validCompanySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
    if (!validCompanySizes.includes(body.companySize)) {
      errors.companySize = 'Invalid company size';
    }
  }

  if (body.projectStage) {
    const validProjectStages = ['idea', 'planning', 'design', 'development', 'maintenance'];
    if (!validProjectStages.includes(body.projectStage)) {
      errors.projectStage = 'Invalid project stage';
    }
  }

  if (body.projectTechnologies) {
    const lengthError = validateLength('projectTechnologies', body.projectTechnologies, 500, 'Project technologies');
    if (lengthError) errors.projectTechnologies = lengthError;
  }

  if (body.jobTitle) {
    const lengthError = validateLength('jobTitle', body.jobTitle, 100, 'Job title');
    if (lengthError) errors.jobTitle = lengthError;
  }

  // GDPR consent validation
  if (body.gdprConsent !== true) {
    errors.gdprConsent = 'GDPR consent is required and must be true';
  }

  return errors;
}

/**
 * POST /api/talent-requests/submit
 * Submit a talent matching request
 */
exports.submitTalentRequest = async (req, res) => {
  try {
    const body = req.body || {};

    // Validate request
    const errors = validateTalentRequest(body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }

    // Create talent request
    const requestId = await TalentRequest.create({
      fullName: body.fullName.trim(),
      companyName: body.companyName.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      jobTitle: body.jobTitle ? body.jobTitle.trim() : null,
      companySize: body.companySize || null,
      aboutYourself: body.aboutYourself.trim(),
      talentNeeded: body.talentNeeded.trim(),
      talentType: body.talentType,
      teamSize: body.teamSize || null,
      budgetRange: body.budgetRange,
      timeline: body.timeline,
      workArrangement: body.workArrangement || null,
      experienceLevel: body.experienceLevel || null,
      technologies: body.technologies ? body.technologies.trim() : null,
      gdprConsent: body.gdprConsent
    });

    logger.info('Talent request submitted successfully', {
      requestId,
      email: body.email
    });

    return res.status(200).json({
      success: true,
      message: 'Request submitted successfully',
      requestId: requestId.toString()
    });

  } catch (err) {
    logger.error('Talent request submission error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * POST /api/project-requests/submit
 * Submit a project outsourcing request
 */
exports.submitProjectRequest = async (req, res) => {
  try {
    const body = req.body || {};

    // Validate request
    const errors = validateProjectRequest(body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }

    // Create project request
    const requestId = await ProjectRequest.create({
      fullName: body.fullName.trim(),
      companyName: body.companyName.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      jobTitle: body.jobTitle ? body.jobTitle.trim() : null,
      companySize: body.companySize || null,
      projectDetails: body.projectDetails.trim(),
      projectType: body.projectType,
      projectBudget: body.projectBudget,
      projectTimeline: body.projectTimeline,
      projectStage: body.projectStage || null,
      projectTechnologies: body.projectTechnologies ? body.projectTechnologies.trim() : null,
      gdprConsent: body.gdprConsent
    });

    logger.info('Project request submitted successfully', {
      requestId,
      email: body.email
    });

    return res.status(200).json({
      success: true,
      message: 'Request submitted successfully',
      requestId: requestId.toString()
    });

  } catch (err) {
    logger.error('Project request submission error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

