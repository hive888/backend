const express = require('express');
const router = express.Router();
const projectPoolController = require('../controllers/projectPoolController');
const authMiddleware = require('../middleware/authMiddleware');

// Project pool listings & management
router.post('/', authMiddleware.authenticate, projectPoolController.createProject);
router.get('/', authMiddleware.authenticate, projectPoolController.getMarketplaceProjects);
router.get('/my-listings', authMiddleware.authenticate, projectPoolController.getMyListings);
router.get('/my-applications', authMiddleware.authenticate, projectPoolController.getMyApplications);
router.get('/categories', authMiddleware.authenticate, projectPoolController.getProjectCategories);
router.post('/generate-draft', authMiddleware.authenticate, projectPoolController.generateProjectDraft);

// Applications to projects
router.post('/:id/apply', authMiddleware.authenticate, projectPoolController.applyToProject);
router.get('/:id/applications', authMiddleware.authenticate, projectPoolController.getProjectApplications);
router.put('/applications/:appId', authMiddleware.authenticate, projectPoolController.updateApplicationStatus);

module.exports = router;
