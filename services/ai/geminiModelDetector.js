/**
 * Gemini Model Detector
 * Automatically detects which Gemini model is available and supported
 */

const logger = require('../../utils/logger');
const { getCache, setCache } = require('./cacheService');

// List of models to try in order of preference
// Based on Google's Gemini API documentation
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',           // Latest and fastest model
  'gemini-2.0-flash-exp',       // Experimental 2.0 model
  'gemini-1.5-flash',           // Stable 1.5 flash
  'gemini-1.5-flash-001',       // Versioned 1.5 flash
  'gemini-1.5-flash-latest',    // Latest 1.5 flash
  'gemini-1.5-pro',             // More capable 1.5 model
  'gemini-1.5-pro-001',         // Versioned 1.5 pro
  'gemini-1.5-pro-latest',      // Latest 1.5 pro
  'gemini-pro',                 // Legacy model (fallback)
  'gemini-pro-vision'           // Vision-capable model
];

let cachedModel = null;
const CACHE_KEY = 'gemini:working_model';
const CACHE_TTL = 86400; // 24 hours

/**
 * Test if a model is available
 */
async function testModel(gemini, modelName) {
  try {
    const model = gemini.getGenerativeModel({ model: modelName });
    
    // Try a simple test request with timeout
    const testPromise = model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      generationConfig: {
        maxOutputTokens: 10
      }
    });

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Model test timeout')), 5000)
    );

    const result = await Promise.race([testPromise, timeoutPromise]);
    await result.response; // Wait for response
    return true;
  } catch (error) {
    logger.debug(`Model ${modelName} test failed:`, error.message);
    return false;
  }
}

/**
 * Detect which Gemini model is available
 */
async function detectAvailableModel(gemini) {
  // Check cache first
  const cached = await getCache(CACHE_KEY);
  if (cached && MODEL_CANDIDATES.includes(cached)) {
    logger.info(`[Gemini Model] Using cached working model: ${cached}`);
    return cached;
  }

  // Get model from env or use candidates
  const envModel = process.env.GEMINI_MODEL;
  const modelsToTry = envModel 
    ? [envModel, ...MODEL_CANDIDATES.filter(m => m !== envModel)]
    : MODEL_CANDIDATES;

  logger.info(`[Gemini Model] Detecting available model, trying ${modelsToTry.length} candidates...`);
  logger.info(`[Gemini Model] Models to try: ${modelsToTry.join(', ')}`);

  // Try each model
  for (const modelName of modelsToTry) {
    logger.info(`[Gemini Model] Testing model: ${modelName}`);
    const isAvailable = await testModel(gemini, modelName);
    
    if (isAvailable) {
      logger.info(`[Gemini Model] ✅ Found working model: ${modelName}`);
      logger.info(`[Gemini Model] This model will be cached and used for all AI requests`);
      
      // Cache the working model
      await setCache(CACHE_KEY, modelName, CACHE_TTL);
      cachedModel = modelName;
      
      return modelName;
    } else {
      logger.warn(`[Gemini Model] ❌ Model ${modelName} is not available (will try next)`);
    }
  }

  // No model found
  logger.error(`[Gemini Model] ⚠️ No available Gemini models found!`);
  return null;
}

/**
 * Get the working model name (with caching)
 */
async function getWorkingModel(gemini) {
  if (cachedModel) {
    return cachedModel;
  }

  const model = await detectAvailableModel(gemini);
  if (model) {
    cachedModel = model;
  }
  
  return model;
}

/**
 * Clear the cached model (useful for testing or when API changes)
 */
function clearCache() {
  cachedModel = null;
}

module.exports = {
  detectAvailableModel,
  getWorkingModel,
  clearCache,
  MODEL_CANDIDATES
};

