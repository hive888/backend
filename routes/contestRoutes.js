// routes/contestRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const contestController = require('../controllers/contestController');

router.post('/',  authMiddleware.authenticate, authMiddleware.authorize('administrator'), contestController.createContest);
router.get('/',  contestController.listContests);
router.get('/:slug',  contestController.getContestBySlug);
router.patch('/:slug',  authMiddleware.authenticate, authMiddleware.authorize('administrator'), contestController.updateContestBySlug);
router.delete('/:slug',   authMiddleware.authenticate, authMiddleware.authorize('administrator'), contestController.deleteContestBySlug);

router.get('/:slug/registrations',  authMiddleware.authenticate, authMiddleware.authorize('administrator'), contestController.listRegistrationsByContest);

router.post('/join', authMiddleware.authenticate,contestController.joinContest);
router.get('/check/me',  authMiddleware.authenticate,contestController.getMyContestStatus);
router.get('/:slug/leaderboard',  contestController.getLeaderboardBySlug);

router.post('/registrations/:id/metrics', authMiddleware.authenticate, contestController.upsertMetricsForRegistration);

module.exports = router;
