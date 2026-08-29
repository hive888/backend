const express = require('express');
const router = express.Router();
const interestController = require('../controllers/interestController');

router.get('/', interestController.getInterests);

module.exports = router;
