// models/issue.model.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const subTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  reporter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  due_date: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  comments: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }]
});

const historySchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changed_at: {
    type: Date,
    default: Date.now
  }
});

const attachmentSchema = new mongoose.Schema({
  file_name: {
    type: String,
    required: true
  },
  file_path: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true
  },
  file_size: {
    type: Number,
    required: true
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploaded_at: {
    type: Date,
    default: Date.now
  }
});

const commentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

const issueSchema = new mongoose.Schema({
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  summary: {
    type: String,
    // trim: true,
    maxlength: 500
  },
  description: {
    type: String,
    // trim: true
  },
  issue_type: {
    type: String,
    enum: ['bug', 'task', 'story', 'epic'],
    default: 'task'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
    default: 'open'
  },
  story_points: {
    type: Number,
    min: 0,
    max: 30
  },
  priority: {
    type: String,
    enum: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
    default: 'medium'
  },
  reporter_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: true,
    index: true
  },
  assignee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  due_date: {
    type: Date,
    index: true
  },
  estimated_time: {
    type: Number, // in hours
    min: 0
  },
  actual_time: {
    type: Number, // in hours
    min: 0
  },
  environment: {
    type: String,
    trim: true
  },
  attachments: [attachmentSchema],
  comments: [commentSchema],
  history: [historySchema],
  subtasks: [subTaskSchema],
  labels: [{
    type: String,
    trim: true
  }],
  sprint_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    index: true
  },
  is_blocked: {
    type: Boolean,
    default: false
  },
  blocked_reason: {
    type: String,
    trim: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Add pagination plugin
issueSchema.plugin(mongoosePaginate);

// Indexes for better query performance
issueSchema.index({ project_id: 1, status: 1 });
issueSchema.index({ assignee_id: 1, status: 1 });
issueSchema.index({ reporter_id: 1, status: 1 });
issueSchema.index({ sprint_id: 1, status: 1 });

// Virtual for formatted issue ID
issueSchema.virtual('issue_key').get(function() {
  if (!this.project_id) return `ISSUE-${this._id.toString().substring(0, 4)}`;
  return `${this.project_id.toString().substring(0, 3).toUpperCase()}-${this._id.toString().substring(0, 4)}`;
});

// Pre-save hook to update history
issueSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew && this._original) {
    const modifiedPaths = this.modifiedPaths();
    modifiedPaths.forEach(path => {
      if (path !== 'updated_at' && path !== 'history' && !path.startsWith('comments') && !path.startsWith('subtasks') && !path.startsWith('attachments')) {
        this.history.push({
          field: path,
          old_value: this._original[path],
          new_value: this[path],
          changed_by: this._modifiedBy || this.reporter_id
        });
      }
    });
  }
  next();
});


const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;