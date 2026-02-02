// controllers/issue.controller.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Issue = require('../models/issue.model');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/issues');
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
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
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
}).array('attachments', 5);

const createIssue = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'File upload failed',
            error_message: err.message
          }
        });
      }

      const { project_id, title, summary, description, issue_type, priority, assignee_id, due_date, estimated_time, labels } = req.body;

      // Validate project exists
      const project = await Project.findById(project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: {
            error_type: 'Project not found',
            error_message: 'The specified project does not exist'
          }
        });
      }

      // Validate assignee
      if (assignee_id) {
        const assignee = await User.findById(assignee_id);
        if (!assignee || assignee.company_id.toString() !== req.user.company_id.toString()) {
          return res.status(400).json({
            success: false,
            message: {
              error_type: 'Invalid assignee',
              error_message: 'The assigned user is not valid or does not belong to your company'
            }
          });
        }
      }

      // Process labels - handle both array and string formats
      let processedLabels = [];
      if (labels) {
        if (Array.isArray(labels)) {
          processedLabels = labels.map(label => label.trim()).filter(label => label.length > 0);
        } else if (typeof labels === 'string') {
          processedLabels = labels.split(',').map(label => label.trim()).filter(label => label.length > 0);
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
        labels: processedLabels,
        attachments
      });

      await issue.save();

      // Populate the response
      const populatedIssue = await Issue.findById(issue._id)
        .populate('project_id', 'name key')
        .populate('reporter_id', 'name avatar')
        .populate('assignee_id', 'name avatar');

      res.status(201).json({
        success: true,
        message: {
          success_type: 'Issue created',
          success_message: 'Issue has been created successfully',
          details: {
            issue_id: issue._id,
            project_key: populatedIssue.project_id.key
          }
        },
        data: populatedIssue
      });
    });
  } catch (error) {
    // Clean up uploaded files
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Issue creation failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const getAllIssues = async (req, res) => {
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
    if (is_blocked !== undefined) filter.is_blocked = is_blocked === 'true';

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { created_at: -1 },
      populate: [
        { 
          path: 'project_id', 
          select: 'key name' 
        },
        { 
          path: 'reporter_id', 
          select: 'name avatar' 
        },
        { 
          path: 'assignee_id', 
          select: 'name avatar' 
        }
      ]
    };

    const issues = await Issue.paginate(filter, options);
    
    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Issues retrieved',
        success_message: 'Issues list retrieved successfully',
        details: {
          total_issues: issues.totalDocs,
          current_page: issues.page,
          total_pages: issues.totalPages
        }
      },
      data: issues
    });
    
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Issues retrieval failed',
        error_message: 'An unexpected error occurred while retrieving issues',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const getIssueById = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'name avatar')
      .populate('assignee_id', 'name avatar')
      .populate('comments.user_id', 'name avatar')
      .populate('subtasks.reporter_id', 'name avatar')
      .populate('subtasks.assignee_id', 'name avatar')
      .populate('subtasks.comments.user_id', 'name avatar')
      .populate('history.changed_by', 'name avatar');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: {
        success_type: 'Issue retrieved',
        success_message: 'Issue details retrieved successfully'
      },
      data: issue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Issue retrieval failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const updateIssue = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['title', 'summary', 'description', 'issue_type', 'status', 'story_points', 'priority', 'assignee_id', 'due_date', 'estimated_time', 'actual_time', 'environment', 'labels', 'sprint_id', 'is_blocked', 'blocked_reason'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: {
          error_type: 'Invalid updates',
          error_message: 'One or more update fields are not allowed'
        }
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    // Process labels if being updated
    if (updates.includes('labels')) {
      let processedLabels = [];
      if (req.body.labels) {
        if (Array.isArray(req.body.labels)) {
          processedLabels = req.body.labels.map(label => label.trim()).filter(label => label.length > 0);
        } else if (typeof req.body.labels === 'string') {
          processedLabels = req.body.labels.split(',').map(label => label.trim()).filter(label => label.length > 0);
        }
      }
      req.body.labels = processedLabels;
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

    // Populate the updated issue
    const updatedIssue = await Issue.findById(issue._id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'name avatar')
      .populate('assignee_id', 'name avatar')
      .populate('comments.user_id', 'name avatar');

    res.status(200).json({
      success: true,
      message: {
        success_type: 'Issue updated',
        success_message: 'Issue has been updated successfully'
      },
      data: updatedIssue
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Issue update failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          error_type: 'Invalid comment',
          error_message: 'Comment content is required'
        }
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    issue.comments.push({
      user_id: req.user._id,
      content: content.trim()
    });

    await issue.save();

    // Populate the updated issue with comments
    const updatedIssue = await Issue.findById(issue._id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'name avatar')
      .populate('assignee_id', 'name avatar')
      .populate('comments.user_id', 'name avatar');

    res.status(201).json({
      success: true,
      message: {
        success_type: 'Comment added',
        success_message: 'Comment has been added successfully'
      },
      data: updatedIssue
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Comment addition failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const addSubtask = async (req, res) => {
  try {
    const { title, description, assignee_id, due_date } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          error_type: 'Invalid subtask',
          error_message: 'Subtask title is required'
        }
      });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    // Validate assignee
    if (assignee_id) {
      const assignee = await User.findById(assignee_id);
      if (!assignee || assignee.company_id.toString() !== req.user.company_id.toString()) {
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'Invalid assignee',
            error_message: 'The assigned user is not valid or does not belong to your company'
          }
        });
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

    // Populate the updated issue
    const updatedIssue = await Issue.findById(issue._id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'name avatar')
      .populate('assignee_id', 'name avatar')
      .populate('subtasks.reporter_id', 'name avatar')
      .populate('subtasks.assignee_id', 'name avatar');

    res.status(201).json({
      success: true,
      message: {
        success_type: 'Subtask added',
        success_message: 'Subtask has been added successfully'
      },
      data: updatedIssue
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Subtask addition failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const uploadAttachment = async (req, res) => {
  try {
    upload.single('attachment')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'File upload failed',
            error_message: err.message
          }
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'Attachment required',
            error_message: 'Attachment file is required'
          }
        });
      }

      const issue = await Issue.findById(req.params.id);
      if (!issue) {
        // Clean up the uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({
          success: false,
          message: {
            error_type: 'Issue not found',
            error_message: 'The requested issue does not exist'
          }
        });
      }

      issue.attachments.push({
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user._id
      });

      await issue.save();

      // Populate the updated issue
      const updatedIssue = await Issue.findById(issue._id)
        .populate('project_id', 'name key')
        .populate('reporter_id', 'name avatar')
        .populate('assignee_id', 'name avatar')
        .populate('attachments.uploaded_by', 'name avatar');

      res.status(201).json({
        success: true,
        message: {
          success_type: 'Attachment uploaded',
          success_message: 'Attachment has been uploaded successfully'
        },
        data: updatedIssue
      });
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Attachment upload failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const deleteAttachment = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    const attachmentIndex = issue.attachments.findIndex(
      att => att._id.toString() === req.params.attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Attachment not found',
          error_message: 'The requested attachment does not exist'
        }
      });
    }

    const attachment = issue.attachments[attachmentIndex];
    
    // Check permissions
    if (attachment.uploaded_by.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: {
          error_type: 'Permission denied',
          error_message: 'Not authorized to delete this attachment'
        }
      });
    }

    // Remove the file from filesystem
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Remove the attachment
    issue.attachments.splice(attachmentIndex, 1);
    await issue.save();

    // Populate the updated issue
    const updatedIssue = await Issue.findById(issue._id)
      .populate('project_id', 'name key')
      .populate('reporter_id', 'name avatar')
      .populate('assignee_id', 'name avatar');

    res.status(200).json({
      success: true,
      message: {
        success_type: 'Attachment deleted',
        success_message: 'Attachment has been deleted successfully'
      },
      data: updatedIssue
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: {
        error_type: 'Attachment deletion failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const deleteIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Issue not found',
          error_message: 'The requested issue does not exist'
        }
      });
    }

    // Check permissions - only reporter or admin can delete
    if (issue.reporter_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: {
          error_type: 'Permission denied',
          error_message: 'Not authorized to delete this issue'
        }
      });
    }

    // Clean up attachments from filesystem
    if (issue.attachments && issue.attachments.length > 0) {
      issue.attachments.forEach(attachment => {
        if (fs.existsSync(attachment.file_path)) {
          fs.unlinkSync(attachment.file_path);
        }
      });
    }

    await Issue.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: {
        success_type: 'Issue deleted',
        success_message: 'Issue and its attachments have been deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Issue deletion failed',
        error_message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

module.exports = {
  createIssue,
  getAllIssues,
  getIssueById,
  updateIssue,
  deleteIssue,
  addComment,
  addSubtask,
  uploadAttachment,
  deleteAttachment,
  upload
};