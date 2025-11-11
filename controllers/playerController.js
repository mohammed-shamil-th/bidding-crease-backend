// Player Controller
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const { isValidObjectId, isValidMobile } = require('../utils/validators');

// Get all players
const getAllPlayers = async (req, res) => {
  try {
    const { tournamentId, sold, unsold, category, sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    
    if (tournamentId) {
      if (!isValidObjectId(tournamentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tournament ID'
        });
      }
      query.tournamentId = tournamentId;
    }
    
    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Filter by category
    if (category && ['Icon', 'Guest', 'Local'].includes(category)) {
      query.category = category;
    }
    
    // Filter by sold/unsold status
    if (sold === 'true') {
      query.soldPrice = { $ne: null };
      query.soldTo = { $ne: null };
    } else if (unsold === 'true') {
      query.$or = [
        { soldPrice: null },
        { soldTo: null }
      ];
    }
    
    // Sort options
    const sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'updatedAt') {
      sortOptions.updatedAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    
    const total = await Player.countDocuments(query);
    const players = await Player.find(query)
      .populate('soldTo', 'name logo')
      .populate('tournamentId', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: players.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: players
    });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching players'
    });
  }
};

// Get single player
const getPlayer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid player ID'
      });
    }

    const player = await Player.findById(id)
      .populate('soldTo')
      .populate('tournamentId');
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.status(200).json({
      success: true,
      data: player
    });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching player'
    });
  }
};

// Create player
const createPlayer = async (req, res) => {
  try {
    const {
      name,
      mobile,
      role,
      battingStyle,
      bowlingStyle,
      category,
      basePrice,
      tournamentId
    } = req.body;

    // Validate required fields
    if (!name || !mobile || !role || !category || !basePrice || !tournamentId) {
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

    // Validate role
    if (!['Batter', 'Bowler', 'All-Rounder'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be "Batter", "Bowler", or "All-Rounder"'
      });
    }

    // Validate category
    if (!['Icon', 'Guest', 'Local'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Category must be "Icon", "Guest", or "Local"'
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

    // Get image URL from Cloudinary upload (if uploaded)
    const image = req.file ? req.file.path : '';

    const player = new Player({
      image,
      name,
      mobile,
      role,
      battingStyle: battingStyle || null,
      bowlingStyle: bowlingStyle || null,
      category,
      basePrice,
      tournamentId
    });

    await player.save();

    res.status(201).json({
      success: true,
      message: 'Player created successfully',
      data: player
    });
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating player',
      error: error.message
    });
  }
};

// Update player
const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid player ID'
      });
    }

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const Team = require('../models/Team');
    // Store old values before updating (for team updates)
    const oldSoldPrice = player.soldPrice;
    const oldSoldTo = player.soldTo;

    // Extract all fields from request body
    const {
      name,
      mobile,
      role,
      battingStyle,
      bowlingStyle,
      category,
      basePrice,
      tournamentId,
      soldPrice,
      soldTo
    } = req.body;

    // Update basic player fields
    if (name !== undefined) player.name = name;
    if (mobile !== undefined) {
      if (mobile && !isValidMobile(mobile)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number'
        });
      }
      player.mobile = mobile;
    }
    if (role !== undefined) {
      if (role && !['Batter', 'Bowler', 'All-Rounder'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role must be "Batter", "Bowler", or "All-Rounder"'
        });
      }
      player.role = role;
    }
    if (battingStyle !== undefined) player.battingStyle = battingStyle || null;
    if (bowlingStyle !== undefined) player.bowlingStyle = bowlingStyle || null;
    if (category !== undefined) {
      if (category && !['Icon', 'Guest', 'Local'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Category must be "Icon", "Guest", or "Local"'
        });
      }
      player.category = category;
    }
    if (basePrice !== undefined) {
      player.basePrice = parseFloat(basePrice) || 0;
    }
    
    // Update tournamentId if provided
    if (tournamentId !== undefined) {
      // Check if tournament is actually being changed
      const currentTournamentId = player.tournamentId?.toString() || player.tournamentId;
      const newTournamentId = tournamentId?.toString() || tournamentId;
      const isTournamentChanging = currentTournamentId !== newTournamentId;
      
      // Only prevent tournament change if player is sold AND tournament is actually changing
      if (isTournamentChanging && player.soldPrice !== null && player.soldTo !== null) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change tournament for a sold player'
        });
      }
      if (tournamentId && !isValidObjectId(tournamentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tournament ID'
        });
      }
      // Only update if tournament is actually changing
      if (isTournamentChanging) {
        player.tournamentId = tournamentId || player.tournamentId;
      }
    }

    // Update sold details if provided
    if (soldPrice !== undefined) {
      if (soldPrice === '' || soldPrice === null) {
        player.soldPrice = null;
      } else {
        player.soldPrice = parseFloat(soldPrice);
      }
    }
    if (soldTo !== undefined) {
      if (soldTo === '' || soldTo === null) {
        player.soldTo = null;
      } else {
        if (!isValidObjectId(soldTo)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid team ID'
          });
        }
        player.soldTo = soldTo;
      }
    }

    // Update image if new file uploaded
    if (req.file) {
      player.image = req.file.path;
    }

    // Save player first
    await player.save();

    // Update team relationships if sold details changed
    if (soldPrice !== undefined || soldTo !== undefined) {
      // If both are null, player becomes unsold - need to remove from team
      if (player.soldPrice === null && player.soldTo === null) {
        // Remove player from old team's players array
        if (oldSoldTo) {
          const oldTeam = await Team.findById(oldSoldTo);
          if (oldTeam) {
            oldTeam.players = oldTeam.players.filter(
              (p) => p.toString() !== player._id.toString()
            );
            await oldTeam.updateRemainingAmount();
          }
        }
      } else if (player.soldPrice !== null && player.soldTo !== null) {
        // Player is being sold/updated - update team
        const teamChanged = oldSoldTo && oldSoldTo.toString() !== player.soldTo.toString();
        
        // Remove from old team if team changed
        if (teamChanged && oldSoldTo) {
          const oldTeam = await Team.findById(oldSoldTo);
          if (oldTeam) {
            oldTeam.players = oldTeam.players.filter(
              (p) => p.toString() !== player._id.toString()
            );
            await oldTeam.updateRemainingAmount();
          }
        }
        
        // Update the team (could be same team or new team)
        const targetTeam = await Team.findById(player.soldTo);
        if (targetTeam) {
          // Add to team if not already there (in case team changed)
          if (!targetTeam.players.includes(player._id)) {
            targetTeam.players.push(player._id);
            await targetTeam.save(); // Save before recalculating
          }
          // Always recalculate remaining amount (handles price changes and team changes)
          await targetTeam.updateRemainingAmount();
        }
      } else if (oldSoldTo && (player.soldPrice === null || player.soldTo === null)) {
        // Player was sold but now partially unsold - remove from team
        const oldTeam = await Team.findById(oldSoldTo);
        if (oldTeam) {
          oldTeam.players = oldTeam.players.filter(
            (p) => p.toString() !== player._id.toString()
          );
          await oldTeam.updateRemainingAmount();
        }
      }
    }

    // Fetch updated player with populated fields
    const updatedPlayer = await Player.findById(id)
      .populate('soldTo', 'name logo')
      .populate('tournamentId', 'name');

    res.status(200).json({
      success: true,
      message: 'Player updated successfully',
      data: updatedPlayer
    });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating player',
      error: error.message
    });
  }
};

// Delete player
const deletePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid player ID'
      });
    }

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Don't allow deleting sold players
    if (player.soldPrice !== null && player.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a sold player'
      });
    }

    await Player.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Player deleted successfully'
    });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting player'
    });
  }
};

module.exports = {
  getAllPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer
};

