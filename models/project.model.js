// models/project.model.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const projectSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  key: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 10,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  project_lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team_members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  start_date: {
    type: Date,
    default: Date.now
  },
  end_date: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'archived'],
    default: 'active'
  },
  categories: [{
    type: String,
    trim: true
  }],
  settings: {
    issue_types: {
      type: [String],
      default: ['bug', 'task', 'story', 'epic']
    },
    priorities: {
      type: [String],
      default: ['lowest', 'low', 'medium', 'high', 'highest', 'critical']
    },
    workflow: {
      type: Map,
      of: [String], // Defines allowed status transitions
      default: {
        'open': ['in_progress', 'closed'],
        'in_progress': ['resolved', 'open'],
        'resolved': ['closed', 'in_progress'],
        'closed': ['reopened'],
        'reopened': ['in_progress', 'closed']
      }
    }
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
projectSchema.plugin(mongoosePaginate);

// Indexes for better query performance
projectSchema.index({ company_id: 1, status: 1 });
projectSchema.index({ project_lead: 1 });
projectSchema.index({ team_members: 1 });

// Virtual for active issue count
projectSchema.virtual('issue_count', {
  ref: 'Issue',
  localField: '_id',
  foreignField: 'project_id',
  count: true
});

// Virtual for active sprint count
projectSchema.virtual('active_sprint_count', {
  ref: 'Sprint',
  localField: '_id',
  foreignField: 'project_id',
  count: true,
  match: { status: 'active' }
});

// Pre-save hook to validate project lead is a team member
projectSchema.pre('save', async function(next) {
  if (this.isModified('project_lead') || this.isModified('team_members')) {
    if (!this.team_members.includes(this.project_lead)) {
      this.team_members.push(this.project_lead);
    }
  }
  next();
});

// Pre-remove hook to handle cleanup
projectSchema.pre('remove', async function(next) {
  // In a real application, you might want to archive issues instead of deleting them
  await mongoose.model('Issue').deleteMany({ project_id: this._id });
  await mongoose.model('Sprint').deleteMany({ project_id: this._id });
  next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;