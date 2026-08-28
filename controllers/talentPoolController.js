const TalentPoolRegistration = require('../models/talentPoolModel');
const RequestAssignment = require('../models/requestAssignmentModel');
const { sendTalentRegistrationEmail } = require('../utils/email');
const { uploadToS3, deleteFromS3 } = require('../config/s3Config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
}).single('cv_file');

// Status definitions
const STATUS = {
  PENDING: 0,      // New registration, needs review
  APPROVED: 1,     // Approved for opportunities
  REJECTED: 2,     // Not suitable
  SHORTLISTED: 3   // Shortlisted for specific roles
};

exports.handleTalentRegistration = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const {
          full_name,
          email,
          country,
          city,
          phone_number,
          age_range,
          gender,
          education_level,
          years_experience,
          skills,
          spoken_languages,
          preferred_work_type,
          availability,
          heard_about_us,
          heard_about_other,
          skills_description,
          github_url,
          linkedin_url,
          portfolio_url,
          job_title,
          expected_salary,
          years_web3_experience,
          certifications,
          projects
        } = req.body;

        // Validate required fields (only basic contact details)
        if (!full_name || !email || !country || !phone_number) {
          return res.status(400).json({ 
            error: 'Missing required fields. Name, Email, Country, and Phone Number are required.' 
          });
        }

        // Check if email already exists
        const existingRegistration = await TalentPoolRegistration.findByEmail(email);
        if (existingRegistration) {
          return res.status(409).json({ 
            error: 'Email already registered in our talent pool' 
          });
        }

        // Parse JSON fields
        let skillsArray = [];
        let languagesArray = [];
        let certificationsArray = null;
        let projectsArray = null;
        
        try {
          if (skills) {
            skillsArray = typeof skills === 'string' ? JSON.parse(skills) : skills;
          }
          if (spoken_languages) {
            languagesArray = typeof spoken_languages === 'string' ? JSON.parse(spoken_languages) : spoken_languages;
          }
          if (certifications) {
            certificationsArray = typeof certifications === 'string' ? JSON.parse(certifications) : certifications;
          }
          if (projects) {
            projectsArray = typeof projects === 'string' ? JSON.parse(projects) : projects;
          }
        } catch (parseError) {
          return res.status(400).json({ 
            error: 'Invalid JSON format for skills, spoken_languages, certifications, or projects' 
          });
        }

        // Upload CV to S3 if provided
        let cv_file_path = null;
        if (req.file) {
          try {
            cv_file_path = await uploadToS3(req.file, 'cv/');
          } catch (uploadErr) {
            console.error('Failed to upload CV to S3:', uploadErr);
            return res.status(500).json({
              error: 'Failed to upload CV file to S3 storage'
            });
          }
        }

        const registrationData = {
          full_name,
          email,
          country,
          city: city || null,
          phone_number,
          age_range: age_range || 'Prefer not to say',
          gender: gender || 'Prefer not to say',
          education_level: education_level || 'Not Specified',
          years_experience: years_experience || '0 years',
          skills: skillsArray,
          spoken_languages: languagesArray,
          preferred_work_type: preferred_work_type || 'Remote',
          availability: availability || 'Immediate',
          heard_about_us: heard_about_us || 'Social Media',
          heard_about_other: heard_about_other || null,
          skills_description: skills_description || '',
          cv_file_path,
          github_url: github_url || null,
          linkedin_url: linkedin_url || null,
          portfolio_url: portfolio_url || null,
          job_title: job_title || null,
          expected_salary: expected_salary || null,
          years_web3_experience: years_web3_experience || null,
          certifications: certificationsArray,
          projects: projectsArray,
          status: STATUS.PENDING // Default status for new registrations
        };

        // Save to database
        const registrationId = await TalentPoolRegistration.create(registrationData);

        res.status(201).json({
          success: true,
          message: 'Talent registration successful. Welcome to our talent pool!',
          registration_id: registrationId,
          status: STATUS.PENDING
        });

      } catch (error) {
        throw error;
      }
    });
  } catch (error) {
    console.error('Error processing talent registration:', error);
    res.status(500).json({ 
      error: 'Internal server error. Please try again later.' 
    });
  }
};

exports.getAllRegistrations = async (req, res) => {
  try {
    const { status } = req.query;
    const statusFilter = status !== undefined ? parseInt(status) : null;
    
    const registrations = await TalentPoolRegistration.findAll(statusFilter);
    
    res.json({
      success: true,
      data: registrations,
      count: registrations.length,
      status_filter: statusFilter
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

exports.getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await TalentPoolRegistration.findById(id);
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      success: true,
      data: registration
    });
  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
};

exports.getRegistrationStats = async (req, res) => {
  try {
    const stats = await TalentPoolRegistration.getStats();
    res.json({
      success: true,
      data: stats,
      status_definitions: STATUS
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

exports.getFilteredRegistrations = async (req, res) => {
  try {
    const filters = req.query;
    
    // Convert status to number if provided
    if (filters.status !== undefined) {
      filters.status = parseInt(filters.status);
    }
    
    const registrations = await TalentPoolRegistration.getByFilters(filters);
    
    res.json({
      success: true,
      data: registrations,
      count: registrations.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching filtered registrations:', error);
    res.status(500).json({ error: 'Failed to fetch filtered registrations' });
  }
};

// NEW ENDPOINTS FOR ADMIN MANAGEMENT

exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined || !Object.values(STATUS).includes(parseInt(status))) {
      return res.status(400).json({ 
        error: 'Valid status is required (0: Pending, 1: Approved, 2: Rejected, 3: Shortlisted)' 
      });
    }

    const registration = await TalentPoolRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const success = await TalentPoolRegistration.updateStatus(id, parseInt(status));
    
    if (success) {
      res.json({
        success: true,
        message: `Registration status updated to ${getStatusText(status)}`,
        registration_id: parseInt(id),
        previous_status: registration.status,
        new_status: parseInt(status)
      });
    } else {
      res.status(500).json({ error: 'Failed to update status' });
    }
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
};

exports.updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.email; // Prevent email changes
    delete updateData.created_at;
    delete updateData.cv_file_path;

    // Parse JSON fields if present
    if (updateData.skills && typeof updateData.skills === 'string') {
      try {
        updateData.skills = JSON.parse(updateData.skills);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid skills JSON format' });
      }
    }

    if (updateData.spoken_languages && typeof updateData.spoken_languages === 'string') {
      try {
        updateData.spoken_languages = JSON.parse(updateData.spoken_languages);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid spoken_languages JSON format' });
      }
    }

    if (updateData.certifications && typeof updateData.certifications === 'string') {
      try {
        updateData.certifications = JSON.parse(updateData.certifications);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid certifications JSON format' });
      }
    }

    if (updateData.projects && typeof updateData.projects === 'string') {
      try {
        updateData.projects = JSON.parse(updateData.projects);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid projects JSON format' });
      }
    }

    const registration = await TalentPoolRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const success = await TalentPoolRegistration.update(id, updateData);
    
    if (success) {
      const updatedRegistration = await TalentPoolRegistration.findById(id);
      res.json({
        success: true,
        message: 'Registration updated successfully',
        data: updatedRegistration
      });
    } else {
      res.status(500).json({ error: 'Failed to update registration' });
    }
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
};

exports.deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await TalentPoolRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Delete CV file if exists
    if (registration.cv_file_path) {
      if (registration.cv_file_path.startsWith('http://') || registration.cv_file_path.startsWith('https://')) {
        try {
          await deleteFromS3(registration.cv_file_path);
        } catch (s3Err) {
          console.error('Failed to delete CV from S3:', s3Err);
        }
      } else if (fs.existsSync(registration.cv_file_path)) {
        fs.unlinkSync(registration.cv_file_path);
      }
    }

    const success = await TalentPoolRegistration.delete(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Registration deleted successfully',
        deleted_id: parseInt(id)
      });
    } else {
      res.status(500).json({ error: 'Failed to delete registration' });
    }
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
};

exports.getMyRegistration = async (req, res) => {
  try {
    const email = req.user?.username; // username holds the email in JWT payload
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
    }

    const registration = await TalentPoolRegistration.findByEmail(email);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const fullRegistration = await TalentPoolRegistration.findById(registration.id);

    res.json({
      success: true,
      data: fullRegistration
    });
  } catch (error) {
    console.error('Error in getMyRegistration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getMyOpportunities = async (req, res) => {
  try {
    const email = req.user?.username;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
    }

    const registration = await TalentPoolRegistration.findByEmail(email);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const opportunities = await RequestAssignment.getByTalent(registration.id);

    res.json({
      success: true,
      data: opportunities
    });
  } catch (error) {
    console.error('Error in getMyOpportunities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.respondToOpportunity = async (req, res) => {
  try {
    const email = req.user?.username;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
    }

    const { assignmentId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'withdrawn'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "withdrawn"' });
    }

    const registration = await TalentPoolRegistration.findByEmail(email);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const assignment = await RequestAssignment.findById(assignmentId);
    if (!assignment || assignment.talent_pool_id !== registration.id) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const updated = await RequestAssignment.updateStatus(assignmentId, status);

    res.json({
      success: true,
      message: `Opportunity marked as ${status}`,
      data: updated
    });
  } catch (error) {
    console.error('Error in respondToOpportunity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getStatusDefinitions = async (req, res) => {
  res.json({
    success: true,
    data: STATUS,
    descriptions: {
      0: 'Pending - New registration, needs review',
      1: 'Approved - Approved for opportunities',
      2: 'Rejected - Not suitable',
      3: 'Shortlisted - Shortlisted for specific roles'
    }
  });
};

// Helper function to get status text
function getStatusText(status) {
  const statusMap = {
    0: 'Pending',
    1: 'Approved',
    2: 'Rejected',
    3: 'Shortlisted'
  };
  return statusMap[status] || 'Unknown';
}

exports.updateMyRegistration = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const email = req.user?.username; // username holds the email in JWT payload
        if (!email) {
          return res.status(401).json({ error: 'Unauthorized: User email not found in token' });
        }

        const registration = await TalentPoolRegistration.findByEmail(email);
        if (!registration) {
          return res.status(404).json({ error: 'Registration not found' });
        }

        const id = registration.id;
        const updateData = { ...req.body };

        // Remove fields that shouldn't be updated by user directly
        delete updateData.id;
        delete updateData.email;
        delete updateData.created_at;
        delete updateData.status;

        // Parse JSON fields
        if (updateData.skills && typeof updateData.skills === 'string') {
          try {
            updateData.skills = JSON.parse(updateData.skills);
          } catch (e) {
            return res.status(400).json({ error: 'Invalid skills JSON format' });
          }
        }

        if (updateData.spoken_languages && typeof updateData.spoken_languages === 'string') {
          try {
            updateData.spoken_languages = JSON.parse(updateData.spoken_languages);
          } catch (e) {
            return res.status(400).json({ error: 'Invalid spoken_languages JSON format' });
          }
        }

        if (updateData.certifications && typeof updateData.certifications === 'string') {
          try {
            updateData.certifications = JSON.parse(updateData.certifications);
          } catch (e) {
            return res.status(400).json({ error: 'Invalid certifications JSON format' });
          }
        }

        if (updateData.projects && typeof updateData.projects === 'string') {
          try {
            updateData.projects = JSON.parse(updateData.projects);
          } catch (e) {
            return res.status(400).json({ error: 'Invalid projects JSON format' });
          }
        }

        // Upload CV to S3 if a new one is provided
        if (req.file) {
          try {
            const new_cv_path = await uploadToS3(req.file, 'cv/');

            // Delete old CV from S3/disk if exists
            const fullReg = await TalentPoolRegistration.findById(id);
            if (fullReg && fullReg.cv_file_path) {
              if (fullReg.cv_file_path.startsWith('http://') || fullReg.cv_file_path.startsWith('https://')) {
                await deleteFromS3(fullReg.cv_file_path).catch(err => console.error('Failed to delete old S3 CV:', err));
              } else if (fs.existsSync(fullReg.cv_file_path)) {
                fs.unlinkSync(fullReg.cv_file_path);
              }
            }

            updateData.cv_file_path = new_cv_path;
          } catch (uploadErr) {
            console.error('Failed to upload new CV:', uploadErr);
            return res.status(500).json({ error: 'Failed to upload new CV file' });
          }
        }

        const success = await TalentPoolRegistration.update(id, updateData);
        
        if (success) {
          const updatedRegistration = await TalentPoolRegistration.findById(id);
          res.json({
            success: true,
            message: 'Talent profile updated successfully',
            data: updatedRegistration
          });
        } else {
          res.status(500).json({ error: 'Failed to update talent profile' });
        }
      } catch (innerErr) {
        console.error('Error in updateMyRegistration inner handler:', innerErr);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  } catch (error) {
    console.error('Error in updateMyRegistration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};