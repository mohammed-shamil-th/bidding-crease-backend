// Tournament Controller
const Tournament = require('../models/Tournament');
const { isValidObjectId } = require('../utils/validators');

// Get all tournaments
const getAllTournaments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Tournament.countDocuments();
    const tournaments = await Tournament.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: tournaments.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: tournaments
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tournaments'
    });
  }
};

// Get single tournament
const getTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tournament'
    });
  }
};

// Create tournament
const createTournament = async (req, res) => {
  try {
    const {
      name,
      category,
      location,
      auctionDate,
      tournamentDate,
      teamBudget,
      minPlayers,
      maxPlayers,
      totalTeams,
      totalPlayers,
      status
    } = req.body;
    
    // Get logo from file upload if available
    const logo = req.file ? req.file.path : req.body.logo || '';

    // Validate required fields
    if (!name || !category || !location || !auctionDate || !tournamentDate ||
        !teamBudget || !minPlayers || !maxPlayers || !totalTeams || !totalPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate category
    if (!['open', 'private'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Category must be either "open" or "private"'
      });
    }

    // Validate status
    if (status && !['upcoming', 'ongoing', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "upcoming", "ongoing", or "completed"'
      });
    }

    // Validate dates
    if (new Date(auctionDate) >= new Date(tournamentDate)) {
      return res.status(400).json({
        success: false,
        message: 'Auction date must be before tournament date'
      });
    }

    // Validate numbers
    if (minPlayers > maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Minimum players cannot be greater than maximum players'
      });
    }
    // Note: minPlayers can be equal to maxPlayers

    const tournament = new Tournament({
      name,
      logo: logo || '',
      category,
      location,
      auctionDate,
      tournamentDate,
      teamBudget,
      minPlayers,
      maxPlayers,
      totalTeams,
      totalPlayers,
      status: status || 'upcoming'
    });

    await tournament.save();

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: tournament
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tournament',
      error: error.message
    });
  }
};

// Update tournament
const updateTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Update fields
    const {
      name,
      category,
      location,
      auctionDate,
      tournamentDate,
      teamBudget,
      minPlayers,
      maxPlayers,
      totalTeams,
      totalPlayers,
      status
    } = req.body;
    
    // Get logo from file upload if available
    const logo = req.file ? req.file.path : req.body.logo;

    if (name) tournament.name = name;
    if (logo !== undefined) tournament.logo = logo;
    if (category) {
      if (!['open', 'private'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Category must be either "open" or "private"'
        });
      }
      tournament.category = category;
    }
    if (location) tournament.location = location;
    if (auctionDate) tournament.auctionDate = auctionDate;
    if (tournamentDate) tournament.tournamentDate = tournamentDate;
    if (teamBudget !== undefined) tournament.teamBudget = teamBudget;
    if (minPlayers !== undefined) tournament.minPlayers = minPlayers;
    if (maxPlayers !== undefined) tournament.maxPlayers = maxPlayers;
    if (totalTeams !== undefined) tournament.totalTeams = totalTeams;
    if (totalPlayers !== undefined) tournament.totalPlayers = totalPlayers;
    if (status) {
      if (!['upcoming', 'ongoing', 'completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "upcoming", "ongoing", or "completed"'
        });
      }
      tournament.status = status;
    }

    // Validate dates if both are updated
    if (auctionDate && tournamentDate) {
      if (new Date(auctionDate) >= new Date(tournamentDate)) {
        return res.status(400).json({
          success: false,
          message: 'Auction date must be before tournament date'
        });
      }
    }

    // Validate numbers
    if (minPlayers !== undefined && maxPlayers !== undefined) {
      if (minPlayers > maxPlayers) {
        return res.status(400).json({
          success: false,
          message: 'Minimum players cannot be greater than maximum players'
        });
      }
      // Note: minPlayers can be equal to maxPlayers
    }

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: tournament
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tournament',
      error: error.message
    });
  }
};

// Delete tournament
const deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    await Tournament.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully'
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tournament'
    });
  }
};

module.exports = {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament
};

