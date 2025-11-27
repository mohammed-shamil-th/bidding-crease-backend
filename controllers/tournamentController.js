// Tournament Controller
const crypto = require('crypto');
const Tournament = require('../models/Tournament');
const { isValidObjectId } = require('../utils/validators');

// Validate bid increments
const validateBidIncrements = (bidIncrements) => {
  if (!Array.isArray(bidIncrements) || bidIncrements.length === 0) {
    return { valid: false, message: 'Bid increments must be a non-empty array' };
  }

  // Sort by minPrice
  const sorted = [...bidIncrements].sort((a, b) => a.minPrice - b.minPrice);

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    // Validate required fields
    if (typeof current.minPrice !== 'number' || current.minPrice < 0) {
      return { valid: false, message: 'Each bid increment must have a valid minPrice >= 0' };
    }
    if (typeof current.increment !== 'number' || current.increment < 1) {
      return { valid: false, message: 'Each bid increment must have a valid increment >= 1' };
    }

    // Check for overlaps (except last one which can have maxPrice: null)
    if (i < sorted.length - 1) {
      if (current.maxPrice === null || current.maxPrice === undefined) {
        return { valid: false, message: 'Only the last bid increment can have maxPrice as null' };
      }
      if (typeof current.maxPrice !== 'number' || current.maxPrice <= current.minPrice) {
        return { valid: false, message: 'maxPrice must be greater than minPrice' };
      }
      // Check overlap with next
      if (i + 1 < sorted.length && current.maxPrice >= sorted[i + 1].minPrice) {
        return { valid: false, message: 'Bid increment ranges cannot overlap' };
      }
    } else {
      // Last range - maxPrice can be null or must be > minPrice
      if (current.maxPrice !== null && current.maxPrice <= current.minPrice) {
        return { valid: false, message: 'maxPrice must be greater than minPrice' };
      }
    }
  }

  return { valid: true };
};

// Validate categories
const validateCategories = (categories) => {
  if (!Array.isArray(categories)) {
    return { valid: false, message: 'Categories must be an array' };
  }

  const categoryNames = new Set();
  for (const category of categories) {
    if (!category.name || typeof category.name !== 'string' || category.name.trim() === '') {
      return { valid: false, message: 'Each category must have a valid name' };
    }
    if (typeof category.basePrice !== 'number' || category.basePrice < 0) {
      return { valid: false, message: 'Each category must have a valid basePrice >= 0' };
    }
    if (typeof category.minPlayers !== 'number' || category.minPlayers < 0) {
      return { valid: false, message: 'Each category must have a valid minPlayers >= 0' };
    }
    
    // Check for duplicate names
    const nameLower = category.name.trim().toLowerCase();
    if (categoryNames.has(nameLower)) {
      return { valid: false, message: `Duplicate category name: ${category.name}` };
    }
    categoryNames.add(nameLower);
  }

  return { valid: true };
};

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

    // Update status for each tournament based on dates
    for (const tournament of tournaments) {
      const oldStatus = tournament.status;
      tournament.updateStatus();
      // Only save if status changed to avoid unnecessary database writes
      if (oldStatus !== tournament.status) {
        await tournament.save();
      }
    }

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

    // Update status based on dates
    const oldStatus = tournament.status;
    tournament.updateStatus();
    if (oldStatus !== tournament.status) {
      await tournament.save();
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
      status,
      bidIncrements,
      categories
    } = req.body;

    // Get logo from file upload if available, otherwise use empty string
    const logo = req.file ? req.file.path : '';

    // Parse bidIncrements if provided as string (from form data)
    let parsedBidIncrements = bidIncrements;
    if (typeof bidIncrements === 'string') {
      try {
        parsedBidIncrements = JSON.parse(bidIncrements);
      } catch (e) {
        parsedBidIncrements = bidIncrements;
      }
    }

    // Parse categories if provided as string (from form data)
    let parsedCategories = categories;
    if (typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories);
      } catch (e) {
        parsedCategories = categories;
      }
    }

    // Validate bid increments if provided
    if (parsedBidIncrements !== undefined) {
      const bidValidation = validateBidIncrements(parsedBidIncrements);
      if (!bidValidation.valid) {
        return res.status(400).json({
          success: false,
          message: bidValidation.message
        });
      }
    }

    // Validate categories if provided
    if (parsedCategories !== undefined) {
      const categoryValidation = validateCategories(parsedCategories);
      if (!categoryValidation.valid) {
        return res.status(400).json({
          success: false,
          message: categoryValidation.message
        });
      }
    }

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

    // Capitalize each word in the name
    const capitalizeWords = (str) => {
      if (!str) return str;
      return str.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    };

    const tournamentData = {
      name: capitalizeWords(name),
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
    };

    // Add bidIncrements if provided
    if (parsedBidIncrements !== undefined) {
      tournamentData.bidIncrements = parsedBidIncrements;
    }

    // Add categories if provided
    if (parsedCategories !== undefined) {
      tournamentData.categories = parsedCategories;
    }

    const tournament = new Tournament(tournamentData);

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
      status,
      bidIncrements,
      categories
    } = req.body;

    // Parse bidIncrements if provided as string (from form data)
    let parsedBidIncrements = bidIncrements;
    if (bidIncrements !== undefined) {
      if (typeof bidIncrements === 'string') {
        try {
          parsedBidIncrements = JSON.parse(bidIncrements);
        } catch (e) {
          parsedBidIncrements = bidIncrements;
        }
      }
      // Validate bid increments
      const bidValidation = validateBidIncrements(parsedBidIncrements);
      if (!bidValidation.valid) {
        return res.status(400).json({
          success: false,
          message: bidValidation.message
        });
      }
      tournament.bidIncrements = parsedBidIncrements;
    }

    // Parse categories if provided as string (from form data)
    let parsedCategories = categories;
    if (categories !== undefined) {
      if (typeof categories === 'string') {
        try {
          parsedCategories = JSON.parse(categories);
        } catch (e) {
          parsedCategories = categories;
        }
      }
      // Validate categories
      const categoryValidation = validateCategories(parsedCategories);
      if (!categoryValidation.valid) {
        return res.status(400).json({
          success: false,
          message: categoryValidation.message
        });
      }
      tournament.categories = parsedCategories;
    }

    if (name) {
      // Capitalize each word in the name
      const capitalizeWords = (str) => {
        if (!str) return str;
        return str.trim().split(/\s+/).map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      };
      tournament.name = capitalizeWords(name);
    }
    // Update logo if new file uploaded
    if (req.file) {
      tournament.logo = req.file.path;
    } else if (req.body.logo !== undefined) {
      tournament.logo = req.body.logo;
    }
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

const sanitizeInvite = (invite) => {
  if (!invite) return null;
  return {
    _id: invite._id,
    label: invite.label,
    token: invite.token,
    isActive: invite.isActive,
    usageCount: invite.usageCount,
    maxUses: invite.maxUses,
    expiresAt: invite.expiresAt,
    lastUsedAt: invite.lastUsedAt,
    deactivatedAt: invite.deactivatedAt,
    createdAt: invite.createdAt,
    createdBy: invite.createdBy
  };
};

const createPlayerInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, maxUses, expiresAt } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid tournament ID' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    let token = crypto.randomBytes(20).toString('hex');
    const existingTokens = new Set(tournament.playerInvites.map((invite) => invite.token));
    while (existingTokens.has(token)) {
      token = crypto.randomBytes(20).toString('hex');
    }

    const parsedMaxUses = maxUses !== undefined && maxUses !== null
      ? Number(maxUses)
      : null;

    const invitePayload = {
      label: label?.trim() || '',
      token,
      isActive: true,
      usageCount: 0,
      maxUses: Number.isFinite(parsedMaxUses) && parsedMaxUses > 0 ? parsedMaxUses : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.adminId,
      lastUsedAt: null,
      deactivatedAt: null
    };

    tournament.playerInvites.push(invitePayload);
    // Mark the playerInvites array as modified to ensure Mongoose saves the new invite
    tournament.markModified('playerInvites');
    await tournament.save();

    return res.status(201).json({
      success: true,
      message: 'Invite link created',
      data: sanitizeInvite(tournament.playerInvites[tournament.playerInvites.length - 1])
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error creating invite link',
      error: error.message 
    });
  }
};

const listPlayerInvites = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid tournament ID' });
    }

    const tournament = await Tournament.findById(id).select('name playerInvites');
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    return res.status(200).json({
      success: true,
      data: tournament.playerInvites.map(sanitizeInvite)
    });
  } catch (error) {
    console.error('List invites error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching invites' });
  }
};

const togglePlayerInvite = async (req, res) => {
  try {
    const { id, inviteId } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(inviteId)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs provided' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const invite = tournament.playerInvites.id(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    invite.isActive = !invite.isActive;
    invite.deactivatedAt = invite.isActive ? null : new Date();
    
    // Mark the playerInvites array as modified to ensure Mongoose saves the subdocument changes
    tournament.markModified('playerInvites');
    await tournament.save();

    return res.status(200).json({
      success: true,
      message: `Invite ${invite.isActive ? 'activated' : 'deactivated'}`,
      data: sanitizeInvite(invite)
    });
  } catch (error) {
    console.error('Toggle invite error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error updating invite',
      error: error.message 
    });
  }
};

const deletePlayerInvite = async (req, res) => {
  try {
    const { id, inviteId } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(inviteId)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs provided' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const invite = tournament.playerInvites.id(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    // Remove the invite from the array using pull() method
    tournament.playerInvites.pull(inviteId);
    // Mark the playerInvites array as modified to ensure Mongoose saves the removal
    tournament.markModified('playerInvites');
    await tournament.save();

    return res.status(200).json({ success: true, message: 'Invite deleted' });
  } catch (error) {
    console.error('Delete invite error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error deleting invite',
      error: error.message 
    });
  }
};

const getInviteByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const tournament = await Tournament.findOne({ 'playerInvites.token': token }).select('name logo location categories playerInvites status');

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    const invite = tournament.playerInvites.find((inv) => inv.token === token);
    if (!invite || !invite.isActive) {
      return res.status(410).json({ success: false, message: 'Invite is inactive' });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'Invite has expired' });
    }

    if (invite.maxUses && invite.usageCount >= invite.maxUses) {
      return res.status(410).json({ success: false, message: 'Invite usage limit reached' });
    }

    return res.status(200).json({
      success: true,
      data: {
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          logo: tournament.logo,
          location: tournament.location,
          status: tournament.status,
          categories: tournament.categories
        },
        invite: sanitizeInvite(invite)
      }
    });
  } catch (error) {
    console.error('Get invite error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching invite' });
  }
};

module.exports = {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  createPlayerInvite,
  listPlayerInvites,
  togglePlayerInvite,
  deletePlayerInvite,
  getInviteByToken
};

