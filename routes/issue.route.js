// routes/issue.routes.js
const express = require('express');
const router = express.Router();
const {
  createIssue,
  getBoardData,
  getBacklog,
  getAllIssues,
  getIssueById,
  updateIssue,
  deleteIssue,
  addComment,
  addSubtask,
  uploadAttachment,
  deleteAttachment,
  upload
} = require('../controllers/issue.controller');
const auth = require('../middleware/auth');

// Create a new issue
router.post('/', auth, upload, createIssue);

// Get all issues
router.get('/', auth, getAllIssues);

// Get board data for active sprint
router.get('/board/:project_id', auth, getBoardData);

// Get backlog data (planned sprints + issues)
router.get('/backlog/:project_id', auth, getBacklog);

// Get a specific issue
router.get('/:id', auth, getIssueById);

// Update an issue
router.patch('/:id', auth, updateIssue);

// Delete an issue
router.delete('/:id', auth, deleteIssue);

// Add a comment
router.post('/:id/comments', auth, addComment);


// Add a subtask
router.post('/:id/subtasks', auth, addSubtask);

// Add an attachment
router.post('/:id/attachments', auth, upload, uploadAttachment);

// Delete an attachment
router.delete('/:issueId/attachments/:attachmentId', auth, deleteAttachment);

module.exports = router;