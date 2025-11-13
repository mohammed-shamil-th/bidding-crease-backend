// Team Controller
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { isValidObjectId, isValidMobile } = require('../utils/validators');

// Get all teams
const getAllTeams = async (req, res) => {
  try {
    const { tournamentId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = tournamentId ? { tournamentId } : {};
    
    const total = await Team.countDocuments(query);
    const teams = await Team.find(query)
      .populate('players', 'name role image soldPrice category')
      .populate('tournamentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: teams.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: teams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teams'
    });
  }
};

// Get single team
const getTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id)
      .populate('players')
      .populate('tournamentId');
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching team'
    });
  }
};

// Create team
const createTeam = async (req, res) => {
  try {
    const {
      name,
      owner,
      mobile,
      budget,
      tournamentId
    } = req.body;

    // Get logo from file upload if available
    const logo = req.file ? req.file.path : req.body.logo || '';

    // Validate required fields
    if (!name || !owner || !mobile || !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number'
      });
    }

    // Check if tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Use tournament teamBudget if budget not provided
    const teamBudget = budget !== undefined ? budget : tournament.teamBudget;

    // Capitalize each word in the name
    const capitalizeWords = (str) => {
      if (!str) return str;
      return str.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    };

    const team = new Team({
      name: capitalizeWords(name),
      logo: logo || '',
      owner,
      mobile,
      budget: teamBudget,
      remainingAmount: teamBudget,
      tournamentId
    });

    await team.save();

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating team',
      error: error.message
    });
  }
};

// Update team
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const { name, owner, mobile, budget } = req.body;

    if (name) {
      // Capitalize each word in the name
      const capitalizeWords = (str) => {
        if (!str) return str;
        return str.trim().split(/\s+/).map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      };
      team.name = capitalizeWords(name);
    }
    // Update logo if new file uploaded
    if (req.file) {
      team.logo = req.file.path;
    } else if (req.body.logo !== undefined) {
      team.logo = req.body.logo;
    }
    if (owner) team.owner = owner;
    if (mobile) {
      if (!isValidMobile(mobile)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number'
        });
      }
      team.mobile = mobile;
    }
    if (budget !== undefined) {
      team.budget = budget;
      // Recalculate remainingAmount
      await team.updateRemainingAmount();
    }

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating team',
      error: error.message
    });
  }
};

// Delete team
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if team has players
    if (team.players.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete team with players. Remove players first.'
      });
    }

    await Team.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting team'
    });
  }
};

module.exports = {
  getAllTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam
};

