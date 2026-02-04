/**
 * Middleware to validate that request body exists for POST, PUT, and PATCH requests
 * Prevents "Cannot destructure property" errors when body is undefined
 * Allows empty bodies (undefined/null) and defaults them to {} for endpoints that don't need body data
 */
const bodyValidationMiddleware = (req, res, next) => {
  // Only validate body for methods that typically have bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Allow empty bodies - default to empty object to prevent destructuring errors
    if (req.body === undefined || req.body === null) {
      req.body = {};
      return next();
    }

    // Ensure body is an object (not an array)
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

