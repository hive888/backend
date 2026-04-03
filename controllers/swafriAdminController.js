const TalentRequest = require('../models/talentRequestModel');
const ProjectRequest = require('../models/projectRequestModel');
const RequestAssignment = require('../models/requestAssignmentModel');
const TalentPoolRegistration = require('../models/talentPoolModel');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * SWAFRI Admin Controller
 * Handles admin operations for talent and project requests
 */

/**
 * Get all talent requests with filtering and pagination
 * GET /api/admin/swafri/talent-requests
 */
exports.getTalentRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      talentType,
      budgetRange,
      timeline,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1 and limit must be between 1 and 100'
      });
    }

    const result = await TalentRequest.getAll({
      page: pageNum,
      limit: limitNum,
      status,
      talentType,
      budgetRange,
      timeline,
      search,
      sortBy,
      sortOrder
    });

    return res.status(200).json({
      success: true,
      data: result.requests,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    logger.error('Get talent requests error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get single talent request by ID
 * GET /api/admin/swafri/talent-requests/:id
 */
exports.getTalentRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await TalentRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Talent request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });
  } catch (err) {
    logger.error('Get talent request by ID error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update talent request status
 * PATCH /api/admin/swafri/talent-requests/:id/status
 */
exports.updateTalentRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
        message: 'Please provide a status value'
      });
    }

    const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await TalentRequest.updateStatus(id, status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Talent request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update talent request status error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update talent request
 * PUT /api/admin/swafri/talent-requests/:id
 */
exports.updateTalentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    const updated = await TalentRequest.update(id, updateData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Talent request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update talent request error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Delete talent request
 * DELETE /api/admin/swafri/talent-requests/:id
 */
exports.deleteTalentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TalentRequest.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Talent request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (err) {
    logger.error('Delete talent request error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get talent requests statistics
 * GET /api/admin/swafri/talent-requests/stats
 */
exports.getTalentRequestsStats = async (req, res) => {
  try {
    const stats = await TalentRequest.getStats();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    logger.error('Get talent requests stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get all project requests with filtering and pagination
 * GET /api/admin/swafri/project-requests
 */
exports.getProjectRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      projectType,
      projectBudget,
      projectTimeline,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1 and limit must be between 1 and 100'
      });
    }

    const result = await ProjectRequest.getAll({
      page: pageNum,
      limit: limitNum,
      status,
      projectType,
      projectBudget,
      projectTimeline,
      search,
      sortBy,
      sortOrder
    });

    return res.status(200).json({
      success: true,
      data: result.requests,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    logger.error('Get project requests error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get single project request by ID
 * GET /api/admin/swafri/project-requests/:id
 */
exports.getProjectRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ProjectRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Project request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });
  } catch (err) {
    logger.error('Get project request by ID error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update project request status
 * PATCH /api/admin/swafri/project-requests/:id/status
 */
exports.updateProjectRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
        message: 'Please provide a status value'
      });
    }

    const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await ProjectRequest.updateStatus(id, status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Project request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update project request status error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update project request
 * PUT /api/admin/swafri/project-requests/:id
 */
exports.updateProjectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    const updated = await ProjectRequest.update(id, updateData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Project request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update project request error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Delete project request
 * DELETE /api/admin/swafri/project-requests/:id
 */
exports.deleteProjectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ProjectRequest.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `Project request with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (err) {
    logger.error('Delete project request error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get project requests statistics
 * GET /api/admin/swafri/project-requests/stats
 */
exports.getProjectRequestsStats = async (req, res) => {
  try {
    const stats = await ProjectRequest.getStats();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    logger.error('Get project requests stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get combined SWAFRI dashboard statistics
 * GET /api/admin/swafri/dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [talentStats, projectStats] = await Promise.all([
      TalentRequest.getStats(),
      ProjectRequest.getStats()
    ]);

    // Calculate combined totals
    const totalRequests = talentStats.total + projectStats.total;
    const totalPending = (talentStats.byStatus.pending || 0) + (projectStats.byStatus.pending || 0);
    const totalReviewed = (talentStats.byStatus.reviewed || 0) + (projectStats.byStatus.reviewed || 0);
    const totalContacted = (talentStats.byStatus.contacted || 0) + (projectStats.byStatus.contacted || 0);
    const totalClosed = (talentStats.byStatus.closed || 0) + (projectStats.byStatus.closed || 0);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRequests,
          totalTalentRequests: talentStats.total,
          totalProjectRequests: projectStats.total,
          totalPending,
          totalReviewed,
          totalContacted,
          totalClosed,
          recent: {
            last7Days: talentStats.recent.last7Days + projectStats.recent.last7Days,
            last30Days: talentStats.recent.last30Days + projectStats.recent.last30Days
          }
        },
        talentRequests: talentStats,
        projectRequests: projectStats
      }
    });
  } catch (err) {
    logger.error('Get SWAFRI dashboard stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

// ============================================
// ASSIGNMENT MANAGEMENT
// ============================================

/**
 * Get comprehensive summary for client requests dashboard
 * GET /api/admin/swafri/summary
 */
exports.getClientRequestsSummary = async (req, res) => {
  try {
    const [talentStats, projectStats, assignmentStats] = await Promise.all([
      TalentRequest.getStats(),
      ProjectRequest.getStats(),
      RequestAssignment.getStats()
    ]);

    // Calculate combined totals
    const totalRequests = talentStats.total + projectStats.total;
    const totalPending = (talentStats.byStatus.pending || 0) + (projectStats.byStatus.pending || 0);
    const totalReviewed = (talentStats.byStatus.reviewed || 0) + (projectStats.byStatus.reviewed || 0);
    const totalContacted = (talentStats.byStatus.contacted || 0) + (projectStats.byStatus.contacted || 0);
    const totalClosed = (talentStats.byStatus.closed || 0) + (projectStats.byStatus.closed || 0);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRequests,
          totalTalentRequests: talentStats.total,
          totalProjectRequests: projectStats.total,
          totalAssignments: assignmentStats.total,
          totalPending,
          totalReviewed,
          totalContacted,
          totalClosed,
          recent: {
            last7Days: talentStats.recent.last7Days + projectStats.recent.last7Days,
            last30Days: talentStats.recent.last30Days + projectStats.recent.last30Days
          }
        },
        talentRequests: {
          ...talentStats,
          breakdown: {
            byStatus: talentStats.byStatus,
            byTalentType: talentStats.byTalentType,
            byBudgetRange: talentStats.byBudgetRange
          }
        },
        projectRequests: {
          ...projectStats,
          breakdown: {
            byStatus: projectStats.byStatus,
            byProjectType: projectStats.byProjectType,
            byBudget: projectStats.byBudget
          }
        },
        assignments: {
          ...assignmentStats,
          breakdown: {
            byStatus: assignmentStats.byStatus,
            byRequestType: assignmentStats.byRequestType
          }
        }
      }
    });
  } catch (err) {
    logger.error('Get client requests summary error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Create assignment - Assign talent to request
 * POST /api/admin/swafri/assignments
 */
exports.createAssignment = async (req, res) => {
  try {
    const {
      request_type,
      request_id,
      talent_pool_id,
      assignment_status = 'pending',
      notes = null,
      interview_date = null
    } = req.body;

    // Validate required fields
    if (!request_type || !request_id || !talent_pool_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'request_type, request_id, and talent_pool_id are required'
      });
    }

    // Validate request type
    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"'
      });
    }

    // Verify request exists
    const RequestModel = request_type === 'talent' ? TalentRequest : ProjectRequest;
    const request = await RequestModel.findById(request_id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `${request_type} request with ID ${request_id} not found`
      });
    }

    // Verify talent exists
    const talent = await TalentPoolRegistration.findById(talent_pool_id);
    if (!talent) {
      return res.status(404).json({
        success: false,
        error: 'Talent not found',
        message: `Talent with ID ${talent_pool_id} not found in talent pool`
      });
    }

    // Get assigned_by from authenticated user
    const assignedBy = req.user?.user_id || null;

    // Create assignment
    const assignment = await RequestAssignment.create({
      requestType: request_type,
      requestId: request_id,
      talentPoolId: talent_pool_id,
      assignedBy: assignedBy,
      assignmentStatus: assignment_status,
      notes: notes,
      interviewDate: interview_date
    });

    return res.status(201).json({
      success: true,
      message: 'Talent assigned successfully',
      data: assignment
    });
  } catch (err) {
    logger.error('Create assignment error:', err);
    
    if (err.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Assignment already exists',
        message: err.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get all assignments with filtering and pagination
 * GET /api/admin/swafri/assignments
 */
exports.getAssignments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      request_type,
      request_id,
      talent_pool_id,
      status,
      assigned_by,
      search,
      sortBy = 'assigned_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1 and limit must be between 1 and 100'
      });
    }

    const result = await RequestAssignment.getAll({
      page: pageNum,
      limit: limitNum,
      requestType: request_type,
      requestId: request_id,
      talentPoolId: talent_pool_id,
      status: status,
      assignedBy: assigned_by,
      search: search,
      sortBy: sortBy,
      sortOrder: sortOrder
    });

    return res.status(200).json({
      success: true,
      data: result.assignments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    logger.error('Get assignments error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get assignment by ID
 * GET /api/admin/swafri/assignments/:id
 */
exports.getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await RequestAssignment.findById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
        message: `Assignment with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: assignment
    });
  } catch (err) {
    logger.error('Get assignment by ID error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get assignments for a specific request
 * GET /api/admin/swafri/assignments/request/:request_type/:request_id
 */
exports.getAssignmentsByRequest = async (req, res) => {
  try {
    const { request_type, request_id } = req.params;
    const { status } = req.query;

    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"'
      });
    }

    const assignments = await RequestAssignment.getByRequest(request_type, request_id, {
      status: status
    });

    return res.status(200).json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (err) {
    logger.error('Get assignments by request error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get assignments for a specific talent
 * GET /api/admin/swafri/assignments/talent/:talent_pool_id
 */
exports.getAssignmentsByTalent = async (req, res) => {
  try {
    const { talent_pool_id } = req.params;
    const { status, request_type } = req.query;

    const assignments = await RequestAssignment.getByTalent(talent_pool_id, {
      status: status,
      requestType: request_type
    });

    return res.status(200).json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (err) {
    logger.error('Get assignments by talent error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update assignment
 * PUT /api/admin/swafri/assignments/:id
 */
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate status if provided
    if (updateData.assignment_status) {
      const validStatuses = ['pending', 'contacted', 'interviewed', 'accepted', 'rejected', 'withdrawn'];
      if (!validStatuses.includes(updateData.assignment_status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `assignment_status must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    const updated = await RequestAssignment.update(id, updateData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
        message: `Assignment with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update assignment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Update assignment status
 * PATCH /api/admin/swafri/assignments/:id/status
 */
exports.updateAssignmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignment_status } = req.body;

    if (!assignment_status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
        message: 'Please provide an assignment_status value'
      });
    }

    const validStatuses = ['pending', 'contacted', 'interviewed', 'accepted', 'rejected', 'withdrawn'];
    if (!validStatuses.includes(assignment_status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `assignment_status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await RequestAssignment.updateStatus(id, assignment_status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
        message: `Assignment with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment status updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('Update assignment status error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Delete assignment (soft delete)
 * DELETE /api/admin/swafri/assignments/:id
 */
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await RequestAssignment.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
        message: `Assignment with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (err) {
    logger.error('Delete assignment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get assignment statistics
 * GET /api/admin/swafri/assignments/stats
 */
exports.getAssignmentStats = async (req, res) => {
  try {
    const { request_type, request_id } = req.query;

    const stats = await RequestAssignment.getStats({
      requestType: request_type,
      requestId: request_id
    });

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    logger.error('Get assignment stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Bulk assign talents to a request
 * POST /api/admin/swafri/assignments/bulk
 */
exports.bulkCreateAssignments = async (req, res) => {
  try {
    const {
      request_type,
      request_id,
      talent_pool_ids,
      assignment_status = 'pending',
      notes = null
    } = req.body;

    // Validate required fields
    if (!request_type || !request_id || !talent_pool_ids || !Array.isArray(talent_pool_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'request_type, request_id, and talent_pool_ids (array) are required'
      });
    }

    if (talent_pool_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Empty talent list',
        message: 'talent_pool_ids array cannot be empty'
      });
    }

    if (talent_pool_ids.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many talents',
        message: 'Cannot assign more than 50 talents at once'
      });
    }

    // Validate request type
    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"'
      });
    }

    // Verify request exists
    const RequestModel = request_type === 'talent' ? TalentRequest : ProjectRequest;
    const request = await RequestModel.findById(request_id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `${request_type} request with ID ${request_id} not found`
      });
    }

    const assignedBy = req.user?.user_id || null;
    const results = {
      total: talent_pool_ids.length,
      created: 0,
      skipped: 0,
      errors: []
    };

    // Process each talent assignment
    for (const talentPoolId of talent_pool_ids) {
      try {
        // Verify talent exists
        const talent = await TalentPoolRegistration.findById(talentPoolId);
        if (!talent) {
          results.skipped++;
          results.errors.push(`Talent ${talentPoolId} not found`);
          continue;
        }

        // Try to create assignment
        await RequestAssignment.create({
          requestType: request_type,
          requestId: request_id,
          talentPoolId: talentPoolId,
          assignedBy: assignedBy,
          assignmentStatus: assignment_status,
          notes: notes
        });

        results.created++;
      } catch (err) {
        results.skipped++;
        if (err.message.includes('already exists')) {
          results.errors.push(`Talent ${talentPoolId} already assigned`);
        } else {
          results.errors.push(`Talent ${talentPoolId}: ${err.message}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk assignment completed: ${results.created} created, ${results.skipped} skipped`,
      data: results
    });
  } catch (err) {
    logger.error('Bulk create assignments error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Get matching talents for a request (suggestions)
 * GET /api/admin/swafri/assignments/suggestions/:request_type/:request_id
 */
exports.getTalentSuggestions = async (req, res) => {
  try {
    const { request_type, request_id } = req.params;
    const { limit = 10 } = req.query;

    if (!['talent', 'project'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type',
        message: 'request_type must be "talent" or "project"'
      });
    }

    // Get request details
    const RequestModel = request_type === 'talent' ? TalentRequest : ProjectRequest;
    const request = await RequestModel.findById(request_id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: `${request_type} request with ID ${request_id} not found`
      });
    }

    // Get already assigned talent IDs
    const existingAssignments = await RequestAssignment.getByRequest(request_type, request_id);
    const assignedTalentIds = existingAssignments.map(a => a.talent_pool_id);

    // Build query based on request requirements
    let query = `
      SELECT 
        tpr.*,
        CASE 
          WHEN tpr.skills LIKE ? THEN 1 ELSE 0 
        END as skills_match
      FROM talent_pool_registration tpr
      WHERE tpr.status = 0
    `;

    const params = [];
    const conditions = [];

    // Exclude already assigned talents
    if (assignedTalentIds.length > 0) {
      conditions.push(`tpr.id NOT IN (${assignedTalentIds.map(() => '?').join(',')})`);
      params.push(...assignedTalentIds);
    }

    // Match based on request type
    if (request_type === 'talent') {
      // Match by experience level, work arrangement, etc.
      if (request.experience_level) {
        // This is a simplified matching - you can enhance it
        conditions.push(`tpr.years_experience IS NOT NULL`);
      }
      if (request.work_arrangement) {
        conditions.push(`(tpr.preferred_work_type = ? OR tpr.preferred_work_type = 'Open to all')`);
        params.push(request.work_arrangement);
      }
      if (request.technologies) {
        const techArray = request.technologies.split(',').map(t => t.trim());
        const techConditions = techArray.map(() => `tpr.skills LIKE ?`);
        conditions.push(`(${techConditions.join(' OR ')})`);
        techArray.forEach(tech => params.push(`%"${tech}"%`));
      }
    } else if (request_type === 'project') {
      // Match by project technologies
      if (request.project_technologies) {
        const techArray = request.project_technologies.split(',').map(t => t.trim());
        const techConditions = techArray.map(() => `tpr.skills LIKE ?`);
        conditions.push(`(${techConditions.join(' OR ')})`);
        techArray.forEach(tech => params.push(`%"${tech}"%`));
      }
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    // Add skills matching for scoring
    if (request.technologies || request.project_technologies) {
      const techString = request.technologies || request.project_technologies || '';
      params.unshift(`%${techString}%`);
    } else {
      params.unshift('%');
    }

    query += ` ORDER BY skills_match DESC, tpr.created_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(query, params);

    // Parse JSON fields safely
    const talents = rows.map(talent => {
      // Helper function to safely parse JSON or return array
      const safeParseJSON = (value) => {
        if (!value) return [];
        if (typeof value === 'string') {
          // Check if it's already a JSON string
          if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
            try {
              return JSON.parse(value);
            } catch (e) {
              // If parsing fails, treat as comma-separated string
              return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
            }
          } else {
            // Plain string - treat as comma-separated values
            return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        }
        // Already an array or object
        if (Array.isArray(value)) return value;
        return [];
      };

      return {
        ...talent,
        skills: safeParseJSON(talent.skills),
        spoken_languages: safeParseJSON(talent.spoken_languages)
      };
    });

    return res.status(200).json({
      success: true,
      data: talents,
      count: talents.length
    });
  } catch (err) {
    logger.error('Get talent suggestions error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

