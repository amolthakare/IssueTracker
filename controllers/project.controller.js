// controllers/project.controller.js
const mongoose = require('mongoose');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const Company = require('../models/company.model');

const createProject = async (req, res) => {
  try {
    const { name, key, description, project_lead, team_members, start_date, end_date, status, categories } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'key', 'project_lead'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Missing required fields',
          error_message: 'Project creation requires essential information',
          details: {
            missing_fields: missingFields,
            required_fields: requiredFields,
            suggestion: 'Please provide all required project details'
          }
        }
      });
    }

    // Validate company exists
    const company = await Company.findById(req.user.company_id);
    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: {
          error_type: 'Company not found',
          error_message: 'Your company account could not be found',
          details: {
            company_id: req.user.company_id,
            suggestion: 'Contact system administrator or check your account settings'
          }
        }
      });
    }

    // Validate project lead
    const lead = await User.findOne({ _id: project_lead, company_id: req.user.company_id });
    if (!lead) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Invalid project lead',
          error_message: 'The selected project lead is not valid for your company',
          details: {
            provided_project_lead: project_lead,
            suggestion: 'Select a team member from your company as project lead'
          }
        }
      });
    }

    // Validate team members
    if (team_members && team_members.length > 0) {
      const members = await User.find({
        _id: { $in: team_members },
        company_id: req.user.company_id
      });
      if (members.length !== team_members.length) {
        const invalidMembers = team_members.filter(memberId => 
          !members.some(m => m._id.toString() === memberId.toString())
        );
        
        return res.status(400).json({ 
          success: false,
          message: {
            error_type: 'Invalid team members',
            error_message: 'One or more selected team members are not valid for your company',
            details: {
              invalid_members: invalidMembers,
              suggestion: 'Select team members from your company only'
            }
          }
        });
      }
    }

    // Check if project key already exists
    const existingProject = await Project.findOne({ 
      key: key.toUpperCase(), 
      company_id: req.user.company_id 
    });
    
    if (existingProject) {
      return res.status(409).json({ 
        success: false,
        message: {
          error_type: 'Duplicate project key',
          error_message: 'A project with this key already exists in your company',
          details: {
            provided_key: key.toUpperCase(),
            suggestion: 'Choose a unique project key for your company'
          }
        }
      });
    }

     // Handle categories - should be an array
    let processedCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        processedCategories = categories.map(cat => cat.trim()).filter(cat => cat);
      } else if (typeof categories === 'string') {
        processedCategories = categories.split(',').map(cat => cat.trim()).filter(cat => cat);
      }
    }

    const project = new Project({
      company_id: req.user.company_id,
      name,
      key: key.toUpperCase(),
      description,
      project_lead,
      team_members: team_members || [], // Should be an array
      created_by: req.user._id,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      status: status ? status : 'active',
      categories: processedCategories
    });

    await project.save();
    
    res.status(201).json({ 
      success: true,
      message: {
        success_type: 'Project created',
        success_message: 'Project has been successfully created',
        details: {
          project_id: project._id,
          project_key: project.key
        }
      },
      project
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Project creation failed',
        error_message: 'An unexpected error occurred while creating the project',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
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
    
    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Projects retrieved',
        success_message: 'Projects list retrieved successfully',
        details: {
          total_projects: projects.totalDocs,
          current_page: projects.page,
          total_pages: projects.totalPages
        }
      },
      data: projects
    });
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Projects retrieval failed',
        error_message: 'An unexpected error occurred while retrieving projects',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
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
      return res.status(404).json({ 
        success: false,
        message: {
          error_type: 'Project not found',
          error_message: 'The requested project could not be found',
          details: {
            project_id: req.params.id,
            suggestion: 'Check the project ID or verify project existence'
          }
        }
      });
    }

    // Check if user has access to this project
    if (project.company_id.toString() !== req.user.company_id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: {
          error_type: 'Access denied',
          error_message: 'You do not have permission to access this project',
          details: {
            project_id: req.params.id,
            suggestion: 'Contact your administrator for project access'
          }
        }
      });
    }

    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Project retrieved',
        success_message: 'Project details retrieved successfully',
        details: {
          project_id: project._id,
          project_key: project.key
        }
      },
      data: project
    });
    
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Project retrieval failed',
        error_message: 'An unexpected error occurred while retrieving the project',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const updateProject = async (req, res) => {
  try {
    console.log('Update project called with ID:', req.params.id);
    console.log('Request body:', req.body);

    // Check if project exists
    if (!req.project) {
      return res.status(404).json({
        success: false,
        message: {
          error_type: 'Project not found',
          error_message: 'Project not found'
        }
      });
    }

    const updates = Object.keys(req.body);
    console.log('Requested updates:', updates);

    const allowedUpdates = ['name', 'key', 'description', 'project_lead', 'team_members', 'start_date', 'end_date', 'status', 'categories'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: {
          error_type: 'Invalid updates',
          error_message: 'One or more update fields are not allowed',
          details: {
            provided_updates: updates,
            allowed_updates: allowedUpdates,
            suggestion: 'Only update allowed fields for the project'
          }
        }
      });
    }

    const project = req.project;

    // Handle team members update
    if (updates.includes('team_members') && req.body.team_members) {
      try {
        console.log('Processing team members:', req.body.team_members);
        
        // Team members should be an array (no JSON parsing needed)
        const team_members = req.body.team_members;
        
        // Validate it's an array
        if (!Array.isArray(team_members)) {
          return res.status(400).json({
            success: false,
            message: {
              error_type: 'Invalid team members format',
              error_message: 'Team members should be provided as an array',
              details: {
                suggestion: 'Provide team members as a valid array of user IDs'
              }
            }
          });
        }
        
        const members = await User.find({
          _id: { $in: team_members },
          company_id: req.user.company_id
        });
        
        if (members.length !== team_members.length) {
          const invalidMembers = team_members.filter(memberId => 
            !members.some(m => m._id.toString() === memberId.toString())
          );
          
          return res.status(400).json({
            success: false,
            message: {
              error_type: 'Invalid team members',
              error_message: 'One or more team members are not valid for your company',
              details: {
                invalid_members: invalidMembers,
                suggestion: 'Select team members from your company only'
              }
            }
          });
        }

        project.team_members = team_members;
      } catch (error) {
        console.error('Team members error:', error);
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'Invalid team members',
            error_message: 'Team members data is not valid',
            details: {
              suggestion: 'Provide team members as a valid array of user IDs'
            }
          }
        });
      }
    }

    // Handle project lead update
    if (updates.includes('project_lead') && req.body.project_lead) {
      console.log('Processing project lead:', req.body.project_lead);
      const lead = await User.findOne({
        _id: req.body.project_lead,
        company_id: req.user.company_id
      });
      
      if (!lead) {
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'Invalid project lead',
            error_message: 'The selected project lead is not valid for your company',
            details: {
              provided_project_lead: req.body.project_lead,
              suggestion: 'Select a team member from your company as project lead'
            }
          }
        });
      }

      if (!project.team_members.includes(req.body.project_lead)) {
        project.team_members.push(req.body.project_lead);
      }

      project.project_lead = req.body.project_lead;
    }

    // Handle categories update
    if (updates.includes('categories') && req.body.categories) {
      try {
        // Categories should be an array (no JSON parsing needed)
        const categories = req.body.categories;
        
        // Validate it's an array
        if (!Array.isArray(categories)) {
          // If it's a string, try to split it
          if (typeof categories === 'string') {
            project.categories = categories.split(',').map(cat => cat.trim()).filter(cat => cat);
          } else {
            return res.status(400).json({
              success: false,
              message: {
                error_type: 'Invalid categories format',
                error_message: 'Categories should be provided as an array',
                details: {
                  suggestion: 'Provide categories as a valid array of strings'
                }
              }
            });
          }
        } else {
          project.categories = categories;
        }
      } catch (error) {
        console.error('Categories error:', error);
        return res.status(400).json({
          success: false,
          message: {
            error_type: 'Invalid categories',
            error_message: 'Categories data is not valid',
            details: {
              suggestion: 'Provide categories as a valid array of strings'
            }
          }
        });
      }
    }

    // Handle other updates
    updates.forEach(update => {
      if (update !== 'team_members' && update !== 'project_lead' && update !== 'categories') {
        if (req.body[update] !== undefined && req.body[update] !== null) {
          if (update === 'end_date' || update === 'start_date') {
            project[update] = new Date(req.body[update]);
          } else {
            project[update] = req.body[update];
          }
        }
      }
    });

    console.log('Project before save:', project);
    await project.save();
    console.log('Project saved successfully');
    
    res.status(200).json({
      success: true,
      message: {
        success_type: 'Project updated',
        success_message: 'Project has been successfully updated',
        details: {
          project_id: project._id,
          project_key: project.key,
          updated_fields: updates
        }
      },
      data: project
    });

  } catch (error) {
    console.error('Update project error details:', error);
    
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Project update failed',
        error_message: 'An unexpected error occurred while updating the project',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.project.created_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: {
          error_type: 'Delete permission denied',
          error_message: 'You are not authorized to delete this project',
          details: {
            project_id: req.project._id,
            required_role: 'admin or project creator',
            suggestion: 'Contact your administrator for deletion permissions'
          }
        }
      });
    }

    // Actually delete the project instead of archiving
    await Project.findByIdAndDelete(req.project._id);

    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Project deleted',
        success_message: 'Project has been successfully deleted',
        details: {
          project_id: req.project._id,
          project_key: req.project.key,
          note: 'This action is permanent and cannot be undone'
        }
      },
      data: null
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Project deletion failed',
        error_message: 'An unexpected error occurred while deleting the project',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
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

    const result = stats[0] || {
      total_issues: 0,
      open_issues: 0,
      in_progress_issues: 0,
      resolved_issues: 0,
      closed_issues: 0,
      total_story_points: 0,
      completed_story_points: 0,
      completion_percentage: 0
    };

    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Project stats retrieved',
        success_message: 'Project statistics retrieved successfully',
        details: {
          project_id: req.project._id,
          project_key: req.project.key
        }
      },
      data: result
    });
    
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Stats retrieval failed',
        error_message: 'An unexpected error occurred while retrieving project statistics',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const addTeamMember = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Missing user ID',
          error_message: 'User ID is required to add a team member',
          details: {
            suggestion: 'Provide a valid user ID in the request body'
          }
        }
      });
    }

    const user = await User.findOne({ 
      _id: user_id, 
      company_id: req.user.company_id 
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Invalid user',
          error_message: 'The specified user does not exist in your company',
          details: {
            provided_user_id: user_id,
            suggestion: 'Select a user from your company'
          }
        }
      });
    }

    if (req.project.team_members.includes(user_id)) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Duplicate team member',
          error_message: 'This user is already a team member of the project',
          details: {
            user_id: user_id,
            user_name: user.name,
            suggestion: 'User is already part of the project team'
          }
        }
      });
    }

    req.project.team_members.push(user_id);
    await req.project.save();

    res.status(201).json({ 
      success: true,
      message: {
        success_type: 'Team member added',
        success_message: 'Team member has been successfully added to the project',
        details: {
          project_id: req.project._id,
          user_id: user_id,
          user_name: user.name
        }
      },
      data: req.project
    });
    
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Team member addition failed',
        error_message: 'An unexpected error occurred while adding the team member',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.userId, 
      company_id: req.user.company_id 
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Invalid user',
          error_message: 'The specified user does not exist in your company',
          details: {
            provided_user_id: req.params.userId,
            suggestion: 'Provide a valid user ID from your company'
          }
        }
      });
    }

    if (req.project.project_lead.toString() === req.params.userId) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Cannot remove project lead',
          error_message: 'You cannot remove the project lead from the team',
          details: {
            user_id: req.params.userId,
            user_name: user.name,
            suggestion: 'Assign a new project lead before removing this user'
          }
        }
      });
    }

    if (!req.project.team_members.some(memberId => memberId.toString() === req.params.userId)) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'User not in team',
          error_message: 'The specified user is not a member of this project team',
          details: {
            user_id: req.params.userId,
            user_name: user.name,
            suggestion: 'User is not part of the project team'
          }
        }
      });
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

    res.status(200).json({ 
      success: true,
      message: {
        success_type: 'Team member removed',
        success_message: 'Team member has been successfully removed from the project',
        details: {
          project_id: req.project._id,
          user_id: req.params.userId,
          user_name: user.name,
          note: 'Assigned issues have been unassigned from this user'
        }
      },
      data: req.project
    });
    
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Team member removal failed',
        error_message: 'An unexpected error occurred while removing the team member',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
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
  removeTeamMember
};