/**
 * Middleware to validate that request body exists for POST, PUT, and PATCH requests
 * Prevents "Cannot destructure property" errors when body is undefined
 */
const bodyValidationMiddleware = (req, res, next) => {
  // Only validate body for methods that typically have bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Check if body is undefined or null
    if (req.body === undefined || req.body === null) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        code: 'MISSING_BODY',
        message: 'This endpoint requires a JSON request body'
      });
    }

    // Ensure body is an object
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body format',
        code: 'INVALID_BODY_FORMAT',
        message: 'Request body must be a valid JSON object'
      });
    }
  }

  next();
};

module.exports = bodyValidationMiddleware;

