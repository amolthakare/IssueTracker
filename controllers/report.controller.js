const Issue = require('../models/issue.model');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

const getReportStats = async (req, res) => {
  try {
    const { company_id } = req.user;
    const companyObjectId = new mongoose.Types.ObjectId(company_id);

    // 1. Get all projects for this company to filter issues
    const projects = await Project.find({ company_id: companyObjectId }).select('_id name');
    const projectIds = projects.map(p => p._id);

    // 2. Volume & Progress (Status Distribution)
    const statusStats = await Issue.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 3. Issue Type Distribution
    const typeStats = await Issue.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: '$issue_type', count: { $sum: 1 } } }
    ]);

    // 4. Priority Distribution
    const priorityStats = await Issue.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // 5. Team Workload (Issues per Assignee)
    const teamStats = await Issue.aggregate([
      { $match: { project_id: { $in: projectIds }, assignee_id: { $ne: null } } },
      { $group: { _id: '$assignee_id', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          name: '$userInfo.name',
          count: 1
        }
      }
    ]);

    // 6. Issues Created Over Time (Daily - Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timeSeriesStats = await Issue.aggregate([
      { 
        $match: { 
          project_id: { $in: projectIds },
          created_at: { $gte: thirtyDaysAgo }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          created: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 7. Time series for resolved issues (Last 30 days)
    const resolutionSeriesStats = await Issue.aggregate([
      { 
        $match: { 
          project_id: { $in: projectIds },
          status: { $in: ['resolved', 'closed'] },
          updated_at: { $gte: thirtyDaysAgo }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updated_at" } },
          resolved: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusStats,
        typeStats,
        priorityStats,
        teamStats,
        timeSeries: {
          created: timeSeriesStats,
          resolved: resolutionSeriesStats
        }
      }
    });

  } catch (error) {
    console.error('Reports API error:', error);
    res.status(500).json({
      success: false,
      message: {
        error_type: 'Report generation failed',
        error_message: error.message
      }
    });
  }
};

module.exports = {
  getReportStats
};
