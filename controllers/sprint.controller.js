const Sprint = require('../models/sprint.model');
const Issue = require('../models/issue.model');
const Project = require('../models/project.model');

const createSprint = async (req, res) => {
  try {
    const { project_id, name, goal, start_date, end_date } = req.body;

    // Validate project existence
    const project = await Project.findById(project_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: { error_type: 'Not Found', error_message: 'Project not found' }
      });
    }

    const sprint = new Sprint({
      project_id,
      name,
      goal,
      start_date,
      end_date,
      created_by: req.user._id
    });

    await sprint.save();

    res.status(201).json({
      success: true,
      data: sprint
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: { error_type: 'Creation Failed', error_message: error.message }
    });
  }
};

const getProjectSprints = async (req, res) => {
  try {
    const sprints = await Sprint.find({ project_id: req.params.projectId })
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      data: sprints
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: { error_type: 'Fetch Failed', error_message: error.message }
    });
  }
};

const startSprint = async (req, res) => {
  try {
    // Check if there is already an active sprint for this project
    const currentSprint = await Sprint.findById(req.params.id);
    if (!currentSprint) {
      return res.status(404).json({
        success: false,
        message: { error_type: 'Not Found', error_message: 'Sprint not found' }
      });
    }

    const activeSprint = await Sprint.findOne({ 
      project_id: currentSprint.project_id, 
      status: 'active' 
    });

    if (activeSprint) {
      return res.status(400).json({
        success: false,
        message: { 
          error_type: 'Validation Error', 
          error_message: 'A sprint is already active for this project. Complete it first.' 
        }
      });
    }

    currentSprint.status = 'active';
    currentSprint.start_date = req.body.start_date || new Date();
    currentSprint.end_date = req.body.end_date || currentSprint.end_date;
    
    await currentSprint.save();

    res.status(200).json({
      success: true,
      data: currentSprint
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: { error_type: 'Update Failed', error_message: error.message }
    });
  }
};

const completeSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: { error_type: 'Not Found', error_message: 'Sprint not found' }
      });
    }

    sprint.status = 'completed';
    sprint.completed_at = new Date();
    await sprint.save();

    // Move incomplete issues to the next planned sprint or backlog
    // Optional: req.body.moveToSprintId
    if (req.body.moveToSprintId) {
      await Issue.updateMany(
        { sprint_id: sprint._id, status: { $ne: 'closed' } },
        { sprint_id: req.body.moveToSprintId }
      );
    } else {
      // Move to backlog (null sprint_id)
      await Issue.updateMany(
        { sprint_id: sprint._id, status: { $ne: 'closed' } },
        { sprint_id: null }
      );
    }

    res.status(200).json({
      success: true,
      data: sprint
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: { error_type: 'Update Failed', error_message: error.message }
    });
  }
};

module.exports = {
  createSprint,
  getProjectSprints,
  startSprint,
  completeSprint
};
