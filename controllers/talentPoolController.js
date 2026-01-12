const TalentPoolRegistration = require('../models/talentPoolModel');
const { sendTalentRegistrationEmail } = require('../utils/email');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/cv/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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
          skills_description
        } = req.body;

        // Validate required fields
        if (!full_name || !email || !country || !phone_number || !age_range || 
            !education_level || !years_experience || !skills || !spoken_languages || 
            !preferred_work_type || !availability || !heard_about_us || !skills_description) {
          
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          
          return res.status(400).json({ 
            error: 'Missing required fields. Please check all fields are filled.' 
          });
        }

        // Check if email already exists
        const existingRegistration = await TalentPoolRegistration.findByEmail(email);
        if (existingRegistration) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(409).json({ 
            error: 'Email already registered in our talent pool' 
          });
        }

        // Parse JSON fields
        let skillsArray, languagesArray;
        try {
          skillsArray = JSON.parse(skills);
          languagesArray = JSON.parse(spoken_languages);
        } catch (parseError) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ 
            error: 'Invalid JSON format for skills or spoken_languages' 
          });
        }

        const registrationData = {
          full_name,
          email,
          country,
          city: city || null,
          phone_number,
          age_range,
          gender: gender || 'Prefer not to say',
          education_level,
          years_experience,
          skills: skillsArray,
          spoken_languages: languagesArray,
          preferred_work_type,
          availability,
          heard_about_us,
          heard_about_other: heard_about_other || null,
          skills_description,
          cv_file_path: req.file ? req.file.path : null,
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
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
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
    if (registration.cv_file_path && fs.existsSync(registration.cv_file_path)) {
      fs.unlinkSync(registration.cv_file_path);
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