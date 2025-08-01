// controllers/project.controller.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const Company = require('../models/company.model');
const multer = require('multer');

// Configure multer for project avatar uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/projects');
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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error('Only image files (jpg, jpeg, png) are allowed'));
    }
    cb(null, true);
  }
}).single('avatar');

const createProject = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).send({ error: err.message });
      }

      const { name, key, description, project_lead, team_members, end_date, categories } = req.body;

      // Validate company exists
      const company = await Company.findById(req.user.company_id);
      if (!company) {
        return res.status(404).send({ error: 'Company not found' });
      }

      // Validate project lead
      const lead = await User.findOne({ _id: project_lead, company_id: req.user.company_id });
      if (!lead) {
        return res.status(400).send({ error: 'Invalid project lead' });
      }

      // Validate team members
      if (team_members && team_members.length > 0) {
        const members = await User.find({
          _id: { $in: team_members },
          company_id: req.user.company_id
        });
        if (members.length !== team_members.length) {
          return res.status(400).send({ error: 'One or more team members are invalid' });
        }
      }

      const project = new Project({
        company_id: req.user.company_id,
        name,
        key: key.toUpperCase(),
        description,
        project_lead,
        team_members: team_members ? [...team_members, project_lead] : [project_lead],
        created_by: req.user._id,
        end_date: end_date ? new Date(end_date) : null,
        categories: categories ? categories.split(',').map(cat => cat.trim()) : [],
        avatar: req.file ? `/uploads/projects/${req.file.filename}` : null
      });

      await project.save();
      res.status(201).send(project);
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).send({ error: error.message });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const filter = { company_id: req.user.company_id };
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { created_at: -1 },
      populate: [
        { path: 'project_lead', select: 'name avatar' },
        { path: 'created_by', select: 'name avatar' },
        { path: 'team_members', select: 'name avatar' }
      ]
    };

    const projects = await Project.paginate(filter, options);
    res.send(projects);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('project_lead', 'name avatar')
      .populate('created_by', 'name avatar')
      .populate('team_members', 'name avatar role')
      .populate({
        path: 'company_id',
        select: 'name'
      });

    if (!project) {
      return res.status(404).send({ error: 'Project not found' });
    }

    res.send(project);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).send({ error: err.message });
      }

      const updates = Object.keys(req.body);
      const allowedUpdates = ['name', 'description', 'project_lead', 'team_members', 'end_date', 'status', 'categories'];
      const isValidOperation = updates.every(update => allowedUpdates.includes(update));

      if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' });
      }

      const project = req.project;

      // Handle team members update
      if (updates.includes('team_members')) {
        const team_members = JSON.parse(req.body.team_members);
        
        const members = await User.find({
          _id: { $in: team_members },
          company_id: req.user.company_id
        });
        
        if (members.length !== team_members.length) {
          return res.status(400).send({ error: 'One or more team members are invalid' });
        }

        project.team_members = team_members;
      }

      // Handle project lead update
      if (updates.includes('project_lead')) {
        const lead = await User.findOne({ 
          _id: req.body.project_lead, 
          company_id: req.user.company_id 
        });
        
        if (!lead) {
          return res.status(400).send({ error: 'Invalid project lead' });
        }

        if (!project.team_members.includes(req.body.project_lead)) {
          project.team_members.push(req.body.project_lead);
        }

        project.project_lead = req.body.project_lead;
      }

      // Handle other updates
      updates.forEach(update => {
        if (update !== 'team_members' && update !== 'project_lead') {
          if (update === 'end_date' && req.body[update]) {
            project[update] = new Date(req.body[update]);
          } else {
            project[update] = req.body[update];
          }
        }
      });

      // Handle avatar update
      if (req.file) {
        // Remove old avatar if exists
        if (project.avatar && fs.existsSync(path.join(__dirname, '../../', project.avatar))) {
          fs.unlinkSync(path.join(__dirname, '../../', project.avatar));
        }
        project.avatar = `/uploads/projects/${req.file.filename}`;
      }

      await project.save();
      res.send(project);
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).send({ error: error.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.project.created_by.toString() !== req.user._id.toString()) {
      return res.status(403).send({ error: 'Not authorized to delete this project' });
    }

    req.project.status = 'archived';
    await req.project.save();

    res.send(req.project);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getProjectStats = async (req, res) => {
  try {
    const stats = await mongoose.model('Issue').aggregate([
      { $match: { project_id: req.project._id } },
      {
        $group: {
          _id: null,
          total_issues: { $sum: 1 },
          open_issues: {
            $sum: {
              $cond: [{ $eq: ['$status', 'open'] }, 1, 0]
            }
          },
          in_progress_issues: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0]
            }
          },
          resolved_issues: {
            $sum: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
            }
          },
          closed_issues: {
            $sum: {
              $cond: [{ $eq: ['$status', 'closed'] }, 1, 0]
            }
          },
          total_story_points: { $sum: '$story_points' },
          completed_story_points: {
            $sum: {
              $cond: [{ $in: ['$status', ['resolved', 'closed']] }, '$story_points', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total_issues: 1,
          open_issues: 1,
          in_progress_issues: 1,
          resolved_issues: 1,
          closed_issues: 1,
          total_story_points: 1,
          completed_story_points: 1,
          completion_percentage: {
            $cond: [
              { $eq: ['$total_story_points', 0] },
              0,
              { $multiply: [{ $divide: ['$completed_story_points', '$total_story_points'] }, 100] }
            ]
          }
        }
      }
    ]);

    res.send(stats[0] || {
      total_issues: 0,
      open_issues: 0,
      in_progress_issues: 0,
      resolved_issues: 0,
      closed_issues: 0,
      total_story_points: 0,
      completed_story_points: 0,
      completion_percentage: 0
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const addTeamMember = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).send({ error: 'User ID is required' });
    }

    const user = await User.findOne({ 
      _id: user_id, 
      company_id: req.user.company_id 
    });
    
    if (!user) {
      return res.status(400).send({ error: 'Invalid user' });
    }

    if (req.project.team_members.includes(user_id)) {
      return res.status(400).send({ error: 'User is already a team member' });
    }

    req.project.team_members.push(user_id);
    await req.project.save();

    res.status(201).send(req.project);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.userId, 
      company_id: req.user.company_id 
    });
    
    if (!user) {
      return res.status(400).send({ error: 'Invalid user' });
    }

    if (req.project.project_lead.toString() === req.params.userId) {
      return res.status(400).send({ error: 'Cannot remove project lead' });
    }

    req.project.team_members = req.project.team_members.filter(
      memberId => memberId.toString() !== req.params.userId
    );

    await req.project.save();

    await mongoose.model('Issue').updateMany(
      { 
        project_id: req.project._id,
        assignee_id: req.params.userId
      },
      { assignee_id: null }
    );

    res.send(req.project);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectStats,
  addTeamMember,
  removeTeamMember,
  upload
};