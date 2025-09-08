// routes/project.routes.js
const express = require('express');
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectStats,
  addTeamMember,
  removeTeamMember,
} = require('../controllers/project.controller');
const auth = require('../middleware/auth');
const projectAccess = require('../middleware/projectAccess');

// Create a new project
router.post('/', auth, createProject);

// Get all projects
router.get('/', auth, getAllProjects);

// Get a specific project
router.get('/:id', auth, getProjectById);

// Update a project
router.patch('/:id', auth, projectAccess, updateProject);
// Delete a project
router.delete('/:id', auth, projectAccess, deleteProject);

// Get project statistics
router.get('/:id/stats', auth, projectAccess, getProjectStats);

// Add team member
router.post('/:id/team', auth, projectAccess, addTeamMember);

// Remove team member
router.delete('/:id/team/:userId', auth, projectAccess, removeTeamMember);

module.exports = router;