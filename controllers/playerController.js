// Player Controller
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { isValidObjectId, isValidMobile } = require('../utils/validators');

const validateInviteAvailability = (invite) => {
  if (!invite) {
    return { valid: false, message: 'Invite not found' };
  }
  if (!invite.isActive) {
    return { valid: false, message: 'Invite is inactive' };
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { valid: false, message: 'Invite has expired' };
  }
  if (invite.maxUses && invite.usageCount >= invite.maxUses) {
    return { valid: false, message: 'Invite usage limit reached' };
  }
  return { valid: true };
};

// Get all players
const getAllPlayers = async (req, res) => {
  try {
    const {
      tournamentId,
      sold,
      unsold,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      wasAuctioned,
    } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (tournamentId) {
      if (!isValidObjectId(tournamentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tournament ID',
        });
      }
      query.tournamentId = tournamentId;
    }

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by wasAuctioned status
    if (wasAuctioned === 'true') {
      query.wasAuctioned = true;
    } else if (wasAuctioned === 'false') {
      query.wasAuctioned = false;
    }

    // Filter by sold/unsold status
    if (sold === 'true') {
      query.soldPrice = { $ne: null };
      query.soldTo = { $ne: null };
    } else if (unsold === 'true') {
      query.$or = [{ soldPrice: null }, { soldTo: null }];
    }

    // Filter by category name via categoryId resolved from tournament categories
    if (category) {
      const categoryName = String(category).trim();

      if (categoryName) {
        let categoryIds = [];

        if (tournamentId) {
          // Single tournament: resolve category IDs from this tournament only
          const tournament = await Tournament.findById(tournamentId).select('categories');
          if (!tournament) {
            return res.status(404).json({
              success: false,
              message: 'Tournament not found',
            });
          }

          if (Array.isArray(tournament.categories) && tournament.categories.length > 0) {
            categoryIds = tournament.categories
              .filter(
                (cat) =>
                  cat.name && cat.name.toLowerCase() === categoryName.toLowerCase(),
              )
              .map((cat) => cat._id);
          }
        } else {
          // All tournaments: find any categories matching this name
          const tournaments = await Tournament.find({
            'categories.name': { $regex: new RegExp(`^${categoryName}$`, 'i') },
          }).select('categories');

          tournaments.forEach((t) => {
            if (Array.isArray(t.categories)) {
              t.categories.forEach((cat) => {
                if (
                  cat.name &&
                  cat.name.toLowerCase() === categoryName.toLowerCase()
                ) {
                  categoryIds.push(cat._id);
                }
              });
            }
          });
        }

        if (!categoryIds.length) {
          // No matching category IDs -> no players
          return res.status(200).json({
            success: true,
            count: 0,
            total: 0,
            page,
            totalPages: 0,
            data: [],
          });
        }

        query.categoryId = { $in: categoryIds };
      }
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
      .populate('tournamentId', 'name categories')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Derive category name from tournament categories using categoryId
    const mappedPlayers = players.map((doc) => {
      const player = doc.toObject();

      if (
        player.categoryId &&
        player.tournamentId &&
        Array.isArray(player.tournamentId.categories)
      ) {
        const matchedCategory = player.tournamentId.categories.find(
          (cat) =>
            cat._id &&
            cat._id.toString() === player.categoryId.toString(),
        );

        if (matchedCategory && matchedCategory.name) {
          player.category = matchedCategory.name;
          player.basePrice = matchedCategory.basePrice || 0;
        }
      }

      return player;
    });

    res.status(200).json({
      success: true,
      count: mappedPlayers.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: mappedPlayers,
    });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching players',
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
        message: 'Invalid player ID',
      });
    }

    const playerDoc = await Player.findById(id)
      .populate('soldTo')
      .populate('tournamentId', 'name categories');

    if (!playerDoc) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }

    const player = playerDoc.toObject();

    // Derive category name from tournament categories using categoryId
    if (
      player.categoryId &&
      player.tournamentId &&
      Array.isArray(player.tournamentId.categories)
    ) {
      const matchedCategory = player.tournamentId.categories.find(
        (cat) =>
          cat._id &&
          cat._id.toString() === player.categoryId.toString(),
      );

        if (matchedCategory && matchedCategory.name) {
          player.category = matchedCategory.name;
          player.basePrice = matchedCategory.basePrice || 0;
        }
      }

      res.status(200).json({
      success: true,
      data: player,
    });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching player',
    });
  }
};

// Create player
const createPlayer = async (req, res) => {
  try {
    const {
      name,
      mobile,
      location,
      role,
      battingStyle,
      bowlingStyle,
      categoryId,
      tournamentId,
      note
    } = req.body;

    // Validate required fields
    if (!name || !mobile || !role || !categoryId || !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID',
      });
    }

    if (!isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number',
      });
    }

    // Validate role
    if (!['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be "Batter", "Bowler", "All-Rounder", or "Wicket Keeper"',
      });
    }

    // Check if tournament exists and categoryId belongs to it
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (!Array.isArray(tournament.categories) || tournament.categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tournament has no categories configured',
      });
    }

    const resolvedCategory = tournament.categories.id(categoryId);
    if (!resolvedCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category is not valid for this tournament',
      });
    }

    const sanitizedNote = typeof note === 'string' ? note.trim() : '';

    if (sanitizedNote.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Note must be 500 characters or fewer',
      });
    }

    // Get image URL from Cloudinary upload (if uploaded)
    const image = req.file ? req.file.path : '';

    // Capitalize each word in the name
    const capitalizeWords = (str) => {
      if (!str) return str;
      return str
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const player = new Player({
      image,
      name: capitalizeWords(name),
      mobile,
      location,
      role,
      battingStyle: battingStyle || null,
      bowlingStyle: bowlingStyle || null,
      categoryId: resolvedCategory._id,
      tournamentId,
      note: sanitizedNote,
    });

    await player.save();

    res.status(201).json({
      success: true,
      message: 'Player created successfully',
      data: player,
    });
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating player',
      error: error.message,
    });
  }
};

const createPlayerPublic = async (req, res) => {
  try {
    const { token } = req.params;
    const {
      name,
      mobile,
      location,
      role,
      battingStyle,
      bowlingStyle,
      categoryId,
      note,
    } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invite token is required',
      });
    }

    if (!name || !mobile || !role || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number',
      });
    }

    if (!['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be "Batter", "Bowler", "All-Rounder", or "Wicket Keeper"',
      });
    }

    const tournament = await Tournament.findOne({ 'playerInvites.token': token });
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found',
      });
    }

    const invite = tournament.playerInvites.find((inv) => inv.token === token);
    const inviteValidation = validateInviteAvailability(invite);
    if (!inviteValidation.valid) {
      return res.status(410).json({
        success: false,
        message: inviteValidation.message,
      });
    }

    if (!Array.isArray(tournament.categories) || tournament.categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tournament has no categories configured',
      });
    }

    if (!isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    const resolvedCategory = tournament.categories.id(categoryId);
    if (!resolvedCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category is not valid for this tournament',
      });
    }

    const sanitizedNote = typeof note === 'string' ? note.trim() : '';
    if (sanitizedNote.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Note must be 500 characters or fewer',
      });
    }

    const image = req.file ? req.file.path : '';

    const capitalizeWords = (str) => {
      if (!str) return str;
      return str
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const player = new Player({
      image,
      name: capitalizeWords(name),
      mobile,
      location,
      role,
      battingStyle: battingStyle || null,
      bowlingStyle: bowlingStyle || null,
      categoryId: resolvedCategory._id,
      tournamentId: tournament._id,
      note: sanitizedNote,
    });

    await player.save();
    invite.usageCount += 1;
    invite.lastUsedAt = new Date();

    if (invite.maxUses && invite.usageCount >= invite.maxUses) {
      invite.isActive = false;
      invite.deactivatedAt = new Date();
    }

    // Mark the playerInvites array as modified to ensure Mongoose saves the subdocument changes
    tournament.markModified('playerInvites');
    await tournament.save();

    res.status(201).json({
      success: true,
      message: 'Player submitted successfully',
      data: player,
    });
  } catch (error) {
    console.error('Public player create error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting player',
      error: error.message,
    });
  }
};

const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid player ID',
      });
    }

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }

    const oldSoldTo = player.soldTo;

    const {
      name,
      mobile,
      location,
      role,
      battingStyle,
      bowlingStyle,
      categoryId,
      tournamentId,
      soldPrice,
      soldTo,
      note
    } = req.body;

    // Update basic player fields
    if (name !== undefined) {
      const capitalizeWords = (str) => {
        if (!str) return str;
        return str
          .trim()
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };
      player.name = capitalizeWords(name);
    }

    if (mobile !== undefined) {
      if (mobile && !isValidMobile(mobile)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number',
        });
      }
      player.mobile = mobile;
    }

    if (location !== undefined) {
      player.location = location;
    }

    if (role !== undefined) {
      if (role && !['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role must be "Batter", "Bowler", "All-Rounder", or "Wicket Keeper"',
        });
      }
      player.role = role;
    }

    if (battingStyle !== undefined) {
      player.battingStyle = battingStyle || null;
    }

    if (bowlingStyle !== undefined) {
      player.bowlingStyle = bowlingStyle || null;
    }

    // Validate categoryId format if provided
    if (categoryId !== undefined && categoryId && !isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID',
      });
    }

    // Update tournamentId if provided
    if (tournamentId !== undefined) {
      const currentTournamentId = player.tournamentId?.toString() || player.tournamentId;
      const newTournamentId = tournamentId?.toString() || tournamentId;
      const isTournamentChanging = currentTournamentId !== newTournamentId;

      if (isTournamentChanging && player.soldPrice !== null && player.soldTo !== null) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change tournament for a sold player',
        });
      }

      if (tournamentId && !isValidObjectId(tournamentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tournament ID',
        });
      }

      if (isTournamentChanging) {
        player.tournamentId = tournamentId || player.tournamentId;
      }
    }

    // Update categoryId if provided
    if (categoryId !== undefined) {
      const targetTournamentId =
        tournamentId !== undefined && tournamentId
          ? tournamentId
          : player.tournamentId;

      const targetTournament = await Tournament.findById(targetTournamentId);
      if (
        !targetTournament ||
        !Array.isArray(targetTournament.categories) ||
        targetTournament.categories.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Tournament has no categories configured',
        });
      }

      const resolvedCategory = targetTournament.categories.id(categoryId);
      if (!resolvedCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category is not valid for this tournament',
        });
      }

      player.categoryId = resolvedCategory._id;
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
            message: 'Invalid team ID',
          });
        }
        player.soldTo = soldTo;
      }
    }

    // Update image if new file uploaded
    if (req.file) {
      player.image = req.file.path;
    }
    if (note !== undefined) {
      if (typeof note === 'string' && note.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Note must be 500 characters or fewer',
        });
      }
      player.note = typeof note === 'string' ? note.trim() : '';
    }


    // Save player first
    await player.save();

    // Update team relationships if sold details changed
    if (soldPrice !== undefined || soldTo !== undefined) {
      if (player.soldPrice === null && player.soldTo === null) {
        // Player became unsold - remove from old team
        if (oldSoldTo) {
          const oldTeam = await Team.findById(oldSoldTo);
          if (oldTeam) {
            oldTeam.players = oldTeam.players.filter(
              (p) => p.toString() !== player._id.toString(),
            );
            await oldTeam.updateRemainingAmount();
          }
        }
      } else if (player.soldPrice !== null && player.soldTo !== null) {
        // Player is sold/updated - sync team
        const teamChanged =
          oldSoldTo && oldSoldTo.toString() !== player.soldTo.toString();

        if (teamChanged && oldSoldTo) {
          const oldTeam = await Team.findById(oldSoldTo);
          if (oldTeam) {
            oldTeam.players = oldTeam.players.filter(
              (p) => p.toString() !== player._id.toString(),
            );
            await oldTeam.updateRemainingAmount();
          }
        }

        const targetTeam = await Team.findById(player.soldTo);
        if (targetTeam) {
          if (!targetTeam.players.includes(player._id)) {
            targetTeam.players.push(player._id);
            await targetTeam.save();
          }
          await targetTeam.updateRemainingAmount();
        }
      } else if (oldSoldTo && (player.soldPrice === null || player.soldTo === null)) {
        // Player was sold but now partially unsold - remove from old team
        const oldTeam = await Team.findById(oldSoldTo);
        if (oldTeam) {
          oldTeam.players = oldTeam.players.filter(
            (p) => p.toString() !== player._id.toString(),
          );
          await oldTeam.updateRemainingAmount();
        }
      }
    }

    // Fetch updated player with populated fields
    const updatedPlayer = await Player.findById(id)
      .populate('soldTo', 'name logo')
      .populate('tournamentId', 'name categories');

    res.status(200).json({
      success: true,
      message: 'Player updated successfully',
      data: updatedPlayer,
    });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating player',
      error: error.message,
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
        message: 'Invalid player ID',
      });
    }

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }

    // Don't allow deleting sold players
    if (player.soldPrice !== null && player.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a sold player',
      });
    }

    await Player.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Player deleted successfully',
    });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting player',
    });
  }
};

// Bulk create players
const bulkCreatePlayers = async (req, res) => {
  try {
    const { players, tournamentId } = req.body;

    // Validate required fields
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of players',
      });
    }

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required',
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID',
      });
    }

    // Check if tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (!Array.isArray(tournament.categories) || tournament.categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tournament has no categories configured',
      });
    }

    // Capitalize each word in the name
    const capitalizeWords = (str) => {
      if (!str) return str;
      return str
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const createdPlayers = [];
    const errors = [];

    // Process each player
    for (let i = 0; i < players.length; i++) {
      const playerData = players[i];

      try {
        // Validate name (required)
        if (!playerData.name || !playerData.name.trim()) {
          errors.push({
            index: i,
            name: playerData.name || 'Unknown',
            error: 'Name is required',
          });
          continue;
        }

        // Validate mobile if provided
        if (playerData.mobile && !isValidMobile(playerData.mobile)) {
          errors.push({
            index: i,
            name: playerData.name,
            error: 'Invalid mobile number',
          });
          continue;
        }

        // Validate role if provided
        if (playerData.role && !['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'].includes(playerData.role)) {
          errors.push({
            index: i,
            name: playerData.name,
            error: 'Role must be "Batter", "Bowler", "All-Rounder", or "Wicket Keeper"',
          });
          continue;
        }

        // Resolve and validate category
        let resolvedCategory = null;

        // Prefer explicit categoryId if present
        if (playerData.categoryId && isValidObjectId(playerData.categoryId)) {
          resolvedCategory = tournament.categories.id(playerData.categoryId);
        }

        // Fallback: resolve by category name
        if (!resolvedCategory && playerData.category) {
          resolvedCategory = tournament.categories.find(
            (cat) =>
              cat.name &&
              typeof playerData.category === 'string' &&
              cat.name.toLowerCase() === playerData.category.toLowerCase(),
          );
        }

        if (!resolvedCategory) {
          errors.push({
            index: i,
            name: playerData.name,
            error: 'Invalid category for this tournament',
          });
          continue;
        }

        // Create player with optional fields
        const player = new Player({
          image: '',
          name: capitalizeWords(playerData.name.trim()),
          mobile:
            playerData.mobile ||
            `9${Math.floor(100000000 + Math.random() * 900000000)}`, // Generate random if not provided
          location: playerData.location || '',
          role: playerData.role || 'Batter', // Default to 'Batter' if not provided
          battingStyle: playerData.battingStyle || null,
          bowlingStyle: playerData.bowlingStyle || null,
          categoryId: resolvedCategory._id,
          tournamentId,
          wasAuctioned: false,
          note:
            typeof playerData.note === 'string'
              ? playerData.note.trim().slice(0, 500)
              : '',
        });

        await player.save();
        createdPlayers.push({
          index: i,
          name: player.name,
          id: player._id,
        });
      } catch (error) {
        errors.push({
          index: i,
          name: playerData.name || 'Unknown',
          error: error.message || 'Error creating player',
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk upload completed. Created: ${createdPlayers.length}, Errors: ${errors.length}`,
      data: {
        created: createdPlayers.length,
        errors: errors.length,
        total: players.length,
        createdPlayers,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Bulk create players error:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating players',
      error: error.message,
    });
  }
};

module.exports = {
  getAllPlayers,
  getPlayer,
  createPlayer,
  createPlayerPublic,
  updatePlayer,
  deletePlayer,
  bulkCreatePlayers,
};
