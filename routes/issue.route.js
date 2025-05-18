// routes/issue.routes.js
const express = require('express');
const router = express.Router();
const {
  createIssue,
  getAllIssues,
  getIssueById,
  updateIssue,
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

// Get a specific issue
router.get('/:id', auth, getIssueById);

// Update an issue
router.patch('/:id', auth, updateIssue);

// Add a comment
router.post('/:id/comments', auth, addComment);

// Add a subtask
router.post('/:id/subtasks', auth, addSubtask);

// Add an attachment
router.post('/:id/attachments', auth, upload, uploadAttachment);

// Delete an attachment
router.delete('/:issueId/attachments/:attachmentId', auth, deleteAttachment);

module.exports = router;