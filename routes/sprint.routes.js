const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createSprint,
  getProjectSprints,
  startSprint,
  completeSprint
} = require('../controllers/sprint.controller');

router.use(auth);

router.post('/', createSprint);
router.get('/project/:projectId', getProjectSprints);
router.patch('/:id/start', startSprint);
router.patch('/:id/complete', completeSprint);

module.exports = router;
