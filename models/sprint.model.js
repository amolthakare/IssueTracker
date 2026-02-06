const mongoose = require('mongoose');

const sprintSchema = new mongoose.Schema({
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  goal: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['planned', 'active', 'completed'],
    default: 'planned'
  },
  start_date: {
    type: Date
  },
  end_date: {
    type: Date
  },
  completed_at: {
    type: Date
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Index for finding active sprint of a project
sprintSchema.index({ project_id: 1, status: 1 });

const Sprint = mongoose.model('Sprint', sprintSchema);

module.exports = Sprint;
