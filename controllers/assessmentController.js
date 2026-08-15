const Assessment = require('../models/assessmentModel');
const logger = require('../utils/logger');

exports.submitAssessment = async (req, res) => {
    try {
        const body = req.body || {};

        // Basic validation
        if (!body.fullName || !body.email) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Full Name and Email are required'
            });
        }

        // Create assessment in db
        const assessmentId = await Assessment.create(body);

        logger.info('Assessment submitted successfully', {
            assessmentId,
            email: body.email
        });

        return res.status(201).json({
            success: true,
            message: 'Assessment submitted successfully',
            assessmentId: assessmentId.toString()
        });

    } catch (err) {
        logger.error('Assessment submission error:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: err.message
        });
    }
};
