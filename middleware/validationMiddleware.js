// middleware/validationMiddleware.js
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg.toLowerCase() // Ensure consistent casing
    }));
    
    return res.status(400).json({
      success: false,
      errors: formattedErrors
    });
  }
  next();
};

module.exports = validate;