// routes/issue.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Issue = require('../models/issue.model');
const auth = require('../middleware/auth');
const Project = require('../models/project.model');
const User = require('../models/user.model');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/issues');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and Office documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Create a new issue
router.post('/', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const { project_id, title, summary, description, issue_type, priority, assignee_id, due_date, estimated_time, labels } = req.body;

    // Validate project exists
    const project = await Project.findById(project_id);
    if (!project) {
      return res.status(404).send({ error: 'Project not found' });
    }

    // Validate assignee exists and belongs to the same company
    if (assignee_id) {
      const assignee = await User.findById(assignee_id);
      if (!assignee || assignee.company_id.toString() !== req.user.company_id.toString()) {
        return res.status(400).send({ error: 'Invalid assignee' });
      }
    }

    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size,
      uploaded_by: req.user._id
    })) : [];

    const issue = new Issue({
      project_id,
      title,
      summary: summary || title,
      description,
      issue_type: issue_type || 'task',
      priority: priority || 'medium',
      reporter_id: req.user._id,
      assignee_id,
      due_date: due_date ? new Date(due_date) : null,
      estimated_time: estimated_time || null,
      labels: labels ? labels.split(',').map(label => label.trim()) : [],
      attachments
    });

    await issue.save();
    res.status(201).send(issue);
  } catch (error) {
    // Clean up uploaded files if error occurs
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(400).send({ error: error.message });
  }
});

// Get all issues with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const { project_id, assignee_id, reporter_id, status, priority, issue_type, sprint_id, is_blocked, search, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (project_id) filter.project_id = project_id;
    if (assignee_id) filter.assignee_id = assignee_id;
    if (reporter_id) filter.reporter_id = reporter_id;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (issue_type) filter.issue_type = issue_type;
    if (sprint_id) filter.sprint_id = sprint_id;
    if (is_blocked) filter.is_blocked = is_blocked === 'true';

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { created_at: -1 },
      populate: [
        { path: 'project_id', select: 'name key' },
        { path: 'reporter_id', select: 'first_name last_name avatar' },
        { path: 'assignee_id', select: 'first_name last_name avatar' }
      ]
    };

    const issues = await Issue.paginate(filter, options);
    res.send(issues);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get a specific issue
router.get('/:id', auth, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'first_name last_name avatar')
      .populate('assignee_id', 'first_name last_name avatar')
      .populate('comments.user_id', 'first_name last_name avatar')
      .populate('subtasks.reporter_id', 'first_name last_name avatar')
      .populate('subtasks.assignee_id', 'first_name last_name avatar')
      .populate('subtasks.comments.user_id', 'first_name last_name avatar')
      .populate('history.changed_by', 'first_name last_name avatar');

    if (!issue) {
      return res.status(404).send({ error: 'Issue not found' });
    }

    res.send(issue);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update an issue
router.patch('/:id', auth, async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['title', 'summary', 'description', 'issue_type', 'status', 'story_points', 'priority', 'assignee_id', 'due_date', 'estimated_time', 'actual_time', 'environment', 'labels', 'sprint_id', 'is_blocked', 'blocked_reason'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).send({ error: 'Invalid updates!' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).send({ error: 'Issue not found' });
    }

    // Store original values for history tracking
    issue._original = { ...issue._doc };
    issue._modifiedBy = req.user._id;

    updates.forEach(update => {
      if (update === 'due_date' && req.body[update]) {
        issue[update] = new Date(req.body[update]);
      } else {
        issue[update] = req.body[update];
      }
    });

    await issue.save();
    res.send(issue);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Add a comment to an issue
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).send({ error: 'Comment content is required' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).send({ error: 'Issue not found' });
    }

    issue.comments.push({
      user_id: req.user._id,
      content: content.trim()
    });

    await issue.save();
    res.status(201).send(issue);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Add a subtask to an issue
router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const { title, description, assignee_id, due_date } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).send({ error: 'Subtask title is required' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).send({ error: 'Issue not found' });
    }

    // Validate assignee exists and belongs to the same company
    if (assignee_id) {
      const assignee = await User.findById(assignee_id);
      if (!assignee || assignee.company_id.toString() !== req.user.company_id.toString()) {
        return res.status(400).send({ error: 'Invalid assignee' });
      }
    }

    issue.subtasks.push({
      title: title.trim(),
      description: description ? description.trim() : '',
      reporter_id: req.user._id,
      assignee_id: assignee_id || null,
      due_date: due_date ? new Date(due_date) : null
    });

    await issue.save();
    res.status(201).send(issue);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Add an attachment to an issue
router.post('/:id/attachments', auth, upload.single('attachment'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: 'Attachment file is required' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      // Clean up the uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).send({ error: 'Issue not found' });
    }

    issue.attachments.push({
      file_name: req.file.originalname,
      file_path: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_by: req.user._id
    });

    await issue.save();
    res.status(201).send(issue);
  } catch (error) {
    // Clean up the uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).send({ error: error.message });
  }
});

// Delete an attachment from an issue
router.delete('/:issueId/attachments/:attachmentId', auth, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).send({ error: 'Issue not found' });
    }

    const attachmentIndex = issue.attachments.findIndex(
      att => att._id.toString() === req.params.attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).send({ error: 'Attachment not found' });
    }

    const attachment = issue.attachments[attachmentIndex];
    
    // Check if user is the uploader or has admin rights
    if (attachment.uploaded_by.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).send({ error: 'Not authorized to delete this attachment' });
    }

    // Remove the file from filesystem
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Remove the attachment from the array
    issue.attachments.splice(attachmentIndex, 1);
    await issue.save();

    res.send(issue);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

module.exports = router;