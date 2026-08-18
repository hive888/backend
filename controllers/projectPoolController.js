const ProjectPool = require('../models/projectPoolModel');
const logger = require('../utils/logger');

// Create a new project listing (Creator/Customer)
exports.createProject = async (req, res) => {
  try {
    const {
      title,
      tagline,
      category,
      project_type,
      industry,
      country,
      project_stage,
      description,
      deliverables,
      timeline,
      team_structure,
      budget,
      funding_goal,
      mentor_needed,
      required_skills,
      project_logo_url,
      cover_image_url,
      pitch_video_url,
      deck_url,
      target_audience,
      competitive_advantage,
      blockchains,
      github_link,
      twitter_link,
      discord_link,
      extra_details
    } = req.body;

    if (!title || !category || !description || !timeline || !team_structure || !budget) {
      return res.status(400).json({
        success: false,
        error: 'Missing required project details',
        code: 'VALIDATION_ERROR'
      });
    }

    const projectData = {
      creator_id: req.user.user_id,
      title,
      tagline,
      category,
      project_type,
      industry,
      country,
      project_stage,
      description,
      deliverables: typeof deliverables === 'string' ? JSON.parse(deliverables) : deliverables,
      timeline,
      team_structure,
      budget,
      funding_goal,
      funding_raised: '0',
      mentor_needed: mentor_needed === true || mentor_needed === 'true',
      required_skills: typeof required_skills === 'string' ? JSON.parse(required_skills) : required_skills,
      project_logo_url,
      cover_image_url,
      status: 0, // Always defaults to Pending admin review
      pitch_video_url,
      deck_url,
      target_audience,
      competitive_advantage,
      blockchains,
      github_link,
      twitter_link,
      discord_link,
      extra_details
    };

    const projectId = await ProjectPool.createProject(projectData);

    logger.info('Project listing created successfully', {
      creatorId: req.user.user_id,
      projectId
    });

    return res.status(201).json({
      success: true,
      message: 'Project submitted for administrative review',
      data: { id: projectId }
    });
  } catch (err) {
    logger.error('Create project error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to create project listing',
      code: 'SERVER_ERROR'
    });
  }
};

// Get active, approved projects for the marketplace
exports.getMarketplaceProjects = async (req, res) => {
  try {
    const { category, project_type, project_stage, country, industry } = req.query;
    const projects = await ProjectPool.findAllProjects({
      status: 1, // Only approved projects
      category,
      project_type,
      project_stage,
      country,
      industry
    });

    return res.status(200).json({
      success: true,
      data: projects
    });
  } catch (err) {
    logger.error('Get marketplace projects error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve marketplace projects',
      code: 'SERVER_ERROR'
    });
  }
};

// Get projects posted by the logged-in user
exports.getMyListings = async (req, res) => {
  try {
    const projects = await ProjectPool.findAllProjects({
      creator_id: req.user.user_id
    });

    return res.status(200).json({
      success: true,
      data: projects
    });
  } catch (err) {
    logger.error('Get my project listings error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve your project listings',
      code: 'SERVER_ERROR'
    });
  }
};

// Submit an application to participate in a project
exports.applyToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_type, motivation, contribution_details } = req.body;

    if (!role_type || !['contributor', 'investor', 'mentor'].includes(role_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid participation role. Choose: contributor, investor, or mentor.',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!motivation) {
      return res.status(400).json({
        success: false,
        error: 'Motivation statement is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const project = await ProjectPool.findProjectById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'NOT_FOUND'
      });
    }

    if (project.creator_id === req.user.user_id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot apply to your own project',
        code: 'BAD_REQUEST'
      });
    }

    const appData = {
      project_id: id,
      user_id: req.user.user_id,
      role_type,
      motivation,
      contribution_details,
      status: 0 // Pending creator review
    };

    const appId = await ProjectPool.createApplication(appData);

    logger.info('Project application submitted', {
      userId: req.user.user_id,
      projectId: id,
      applicationId: appId
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { id: appId }
    });
  } catch (err) {
    logger.error('Apply to project error', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'You have already applied to this project with this role',
        code: 'DUPLICATE_APPLICATION'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to submit application',
      code: 'SERVER_ERROR'
    });
  }
};

// Get user's submitted applications
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await ProjectPool.findUserApplications(req.user.user_id);
    return res.status(200).json({
      success: true,
      data: applications
    });
  } catch (err) {
    logger.error('Get my applications error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve applications',
      code: 'SERVER_ERROR'
    });
  }
};

// Get applicants for a project (Creator only)
exports.getProjectApplications = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await ProjectPool.findProjectById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        code: 'NOT_FOUND'
      });
    }

    if (project.creator_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. Only the project owner can view applicants.',
        code: 'UNAUTHORIZED'
      });
    }

    const applications = await ProjectPool.findApplicationsByProject(id);
    return res.status(200).json({
      success: true,
      data: applications
    });
  } catch (err) {
    logger.error('Get project applicants error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve applicants list',
      code: 'SERVER_ERROR'
    });
  }
};

// Accept or reject an applicant (Creator only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { appId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Choose: approved or rejected.',
        code: 'VALIDATION_ERROR'
      });
    }

    // Lookup application to find the project ID and creator
    const sqlLookup = `
      SELECT a.*, p.creator_id 
      FROM project_applications a
      JOIN project_pool p ON a.project_id = p.id
      WHERE a.id = ?
    `;
    const db = require('../config/database');
    const [rows] = await db.query(sqlLookup, [appId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
        code: 'NOT_FOUND'
      });
    }

    const application = rows[0];

    if (application.creator_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. Only the project owner can manage applications.',
        code: 'UNAUTHORIZED'
      });
    }

    const statusVal = status === 'approved' ? 1 : 2;
    await ProjectPool.updateApplicationStatus(appId, statusVal);

    logger.info('Project application status updated', {
      creatorId: req.user.user_id,
      applicationId: appId,
      newStatus: status
    });

    return res.status(200).json({
      success: true,
      message: `Applicant has been successfully ${status}`
    });
  } catch (err) {
    logger.error('Update application status error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to update applicant status',
      code: 'SERVER_ERROR'
    });
  }
};

// Get all unique project categories (dynamic)
exports.getProjectCategories = async (req, res) => {
  try {
    const categories = await ProjectPool.findUniqueCategories();
    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (err) {
    logger.error('Get project categories error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories',
      code: 'SERVER_ERROR'
    });
  }
};

// AI assistant project draft suggestions
exports.generateProjectDraft = async (req, res) => {
  try {
    const { title, category, description, required_skills } = req.body;
    if (!title || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title and category are required to generate AI draft suggestions',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      logger.warn('[AI Assistant] GEMINI_API_KEY not configured, using fallback template');
      return res.status(200).json({
        success: true,
        data: {
          description: `${description || ''}\n\n[AI Template]: draft a detailed project plan for ${title} under ${category} sector focusing on decentralized tools and web3 integration.`,
          deliverables: ['Launch initial test version', 'Deploy smart contracts on test network'],
          timeline: '2-3 Months',
          required_skills: ['Solidity', 'Web3.js', 'React']
        }
      });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert Web3 and blockchain co-founder assistant. Help me refine and expand a project submission draft.
Project Title: ${title}
Category: ${category}
Current Description: ${description || 'No description provided.'}
Current Skills Needed: ${required_skills ? required_skills.join(', ') : 'None'}

Please generate a professional, structured expansion. Focus on adding technical depth, tokenomics possibilities, roadmap milestones, and specific Web3/blockchain infrastructure.
Return a valid JSON object matching this structure EXACTLY:
{
  "description": "Expanded, highly engaging 2-3 paragraph description explaining value proposition, decentralized architecture, and technical vision.",
  "deliverables": ["Milestone 1 description", "Milestone 2 description", "Milestone 3 description"],
  "timeline": "e.g., 3 Months or 6 Months",
  "required_skills": ["Skill 1", "Skill 2", "Skill 3"]
}
Do not write markdown, code blocks, or additional text. Just raw JSON.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    const text = result.response.text().trim();
    let cleanedText = text;
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleanedText);
    return res.status(200).json({
      success: true,
      data: parsed
    });
  } catch (err) {
    logger.error('AI draft generation error', { error: err.message });
    return res.status(200).json({
      success: true,
      data: {
        description: `Project detail refinement for ${req.body.title || 'project'} focusing on decentralization, contract development, and web3 applications.`,
        deliverables: ['Design smart contract specs', 'Create frontend UI', 'Write automated tests'],
        timeline: '3 Months',
        required_skills: ['Solidity', 'React', 'TypeScript']
      }
    });
  }
};
