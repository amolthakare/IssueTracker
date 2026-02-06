const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getReportStats } = require('../controllers/report.controller');

// All report routes are protected
router.use(auth);

router.get('/stats', getReportStats);

module.exports = router;
