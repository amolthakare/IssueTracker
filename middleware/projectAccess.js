// middleware/projectAccess.js
const Project = require('../models/project.model');

module.exports = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Project not found',
          error_message: 'Project not found'
        }
      });
    }

    // Check if user belongs to the company that owns the project
    // Make sure both are converted to string for comparison
    if (project.company_id.toString() !== req.user.company_id.toString()) {
      return res.status(403).json({
        success: false,
        message: {
          error_type: 'Access denied',
          error_message: 'Not authorized to access this project'
        }
      });
    }

    // For non-admin users, check if they are team members or project lead
    if (req.user.role !== 'admin') {
      const isTeamMember = project.team_members.some(
        member => member.toString() === req.user._id.toString()
      );
      
      const isProjectLead = project.project_lead.toString() === req.user._id.toString();
      
      if (!isTeamMember && !isProjectLead) {
        return res.status(403).json({
          success: false,
          message: {
            error_type: 'Access denied',
            error_message: 'Not authorized to access this project'
          }
        });
      }
    }

    req.project = project;
    next();
  } catch (error) {
    console.error('Project access middleware error:', error);
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Server error',
        error_message: 'Failed to verify project access'
      }
    });
  }
};