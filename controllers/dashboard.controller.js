const Issue = require('../models/issue.model');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

const getDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // 1. Basic Stats
    const totalProjects = await Project.countDocuments({ company_id: companyObjectId });
    
    // We need projects of this company to filter issues
    const projectIds = await Project.find({ company_id: companyObjectId }).select('_id');
    const projectIdArray = projectIds.map(p => p._id);

    const openIssues = await Issue.countDocuments({ 
      project_id: { $in: projectIdArray },
      status: 'open'
    });

    const resolvedIssues = await Issue.countDocuments({ 
      project_id: { $in: projectIdArray },
      status: { $in: ['resolved', 'closed'] }
    });

    const teamMembers = await User.countDocuments({ company_id: companyObjectId });

    // 2. Recent Issues
    const recentIssues = await Issue.find({ project_id: { $in: projectIdArray } })
      .sort({ created_at: -1 })
      .limit(5)
      .populate('project_id', 'name')
      .populate('assignee_id', 'name');

    // 3. Project Progress
    // 3. Project Progress & All Projects
    const projectsWithProgress = await Project.aggregate([
      { $match: { company_id: companyObjectId } },
      {
        $lookup: {
          from: 'issues',
          localField: '_id',
          foreignField: 'project_id',
          as: 'projectIssues'
        }
      },
      {
        $project: {
          id: '$_id',
          name: '$name',
          total: { $size: '$projectIssues' },
          completed: {
            $size: {
              $filter: {
                input: '$projectIssues',
                as: 'issue',
                cond: { $in: ['$$issue.status', ['resolved', 'closed']] }
              }
            }
          }
        }
      },
      {
        $project: {
          id: 1,
          name: 1,
          total: 1,
          completed: 1,
          progress: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }
            ]
          }
        }
      },
      { $limit: 10 }
    ]);

    // 4. Recent Activity (Simplified)
    const recentActivity = await Issue.find({ project_id: { $in: projectIdArray } })
      .sort({ updated_at: -1 })
      .limit(5)
      .populate('reporter_id', 'name avatar')
      .populate('project_id', 'name');

    // 5. Upcoming Deadlines
    const upcomingDeadlines = await Issue.find({
      project_id: { $in: projectIdArray },
      due_date: { $gte: new Date(), $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      status: { $ne: 'resolved' }
    })
      .sort({ due_date: 1 })
      .limit(5)
      .populate('project_id', 'name');

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalProjects,
          openIssues,
          resolvedIssues,
          teamMembers
        },
        recentIssues: recentIssues.map(issue => ({
          _id: issue._id,
          title: issue.title,
          project: issue.project_id ? issue.project_id.name : 'Unknown',
          priority: issue.priority,
          status: issue.status,
          assignee: issue.assignee_id ? issue.assignee_id.name : 'Unassigned',
          date: issue.created_at
        })),
        projects: projectsWithProgress,
        activities: recentActivity.map(activity => ({
          _id: activity._id,
          user: activity.reporter_id ? activity.reporter_id.name : 'Unknown',
          action: 'updated issue',
          target: activity.title,
          time: activity.updated_at
        })),
        upcomingDeadlines: upcomingDeadlines.map(issue => ({
          _id: issue._id,
          title: issue.title,
          project: issue.project_id ? issue.project_id.name : 'Unknown',
          due_date: issue.due_date
        }))
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Dashboard data fetch failed',
        error_message: error.message
      }
    });
  }
};

module.exports = {
  getDashboardStats
};
