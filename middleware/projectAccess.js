
// const Issue = require('../models/issue.model');
// const Project = require('../models/project.model');

// module.exports = async (req, res, next) => {
//   try {
//     const issue = await Issue.findById(req.params.id).populate('project_id');
//     if (!issue) {
//       return res.status(404).send({ error: 'Issue not found' });
//     }

//     // Check if user has access to the project
//     const project = await Project.findOne({
//       _id: issue.project_id._id,
//       $or: [
//         { team_members: req.user._id },
//         { created_by: req.user._id }
//       ]
//     });

//     if (!project && req.user.role !== 'admin') {
//       return res.status(403).send({ error: 'Not authorized to access this issue' });
//     }

//     req.issue = issue;
//     next();
//   } catch (error) {
//     res.status(500).send({ error: error.message });
//   }
// };// middleware/projectAccess.js
const Project = require('../models/project.model');

module.exports = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).send({ error: 'Project not found' });
    }

    // Check if user belongs to the company that owns the project
    if (project.company_id.toString() !== req.user.company_id.toString()) {
      return res.status(403).send({ error: 'Not authorized to access this project' });
    }

    // For non-admin users, check if they are team members or project lead
    if (req.user.role !== 'admin') {
      const isTeamMember = project.team_members.some(
        member => member.toString() === req.user._id.toString()
      );
      
      if (!isTeamMember && project.project_lead.toString() !== req.user._id.toString()) {
        return res.status(403).send({ error: 'Not authorized to access this project' });
      }
    }

    req.project = project;
    next();
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};