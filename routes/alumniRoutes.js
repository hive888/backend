const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * @route   GET /api/alumni
 * @desc    Get all certified alumni profile details (combines DB profiles and default alumni)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.customer_id, c.first_name, c.last_name, c.profile_picture, 
              pd.location, pd.bio, pd.position, pd.organization, pd.skills, pd.experience, pd.social_links
       FROM customers c
       JOIN customer_profile_details pd ON c.customer_id = pd.customer_id
       WHERE c.deleted_at IS NULL`
    );

    const dbAlumni = rows.map(row => {
      let parsedSkills = [];
      try {
        if (row.skills) {
          parsedSkills = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
        }
      } catch (_) {}
      if (!Array.isArray(parsedSkills)) {
        parsedSkills = [];
      }

      let parsedSocials = {};
      try {
        if (row.social_links) {
          parsedSocials = typeof row.social_links === 'string' ? JSON.parse(row.social_links) : row.social_links;
        }
      } catch (_) {}

      return {
        id: String(row.customer_id),
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Member',
        avatar: row.profile_picture || '',
        country: row.location || '',
        profession: row.position || '',
        company: row.organization || '',
        industry: '',
        skills: parsedSkills,
        experience: row.experience || row.bio || '',
        careerPath: [
          row.position && row.organization ? `${row.position} at ${row.organization}` : row.position || row.organization
        ].filter(Boolean),
        currentRole: row.position || '',
        contributions: [],
        mentorshipAvailable: false
      };
    });

    return res.status(200).json({
      success: true,
      data: dbAlumni
    });
  } catch (err) {
    logger.error('Get alumni network error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alumni network'
    });
  }
});

module.exports = router;
