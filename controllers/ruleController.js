// Rule Controller
const Rule = require('../models/Rule');
const Tournament = require('../models/Tournament');
const { isValidObjectId } = require('../utils/validators');

// Get rules for tournament
const getRulesByTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    const total = await Rule.countDocuments({ tournamentId });
    const rules = await Rule.find({ tournamentId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: rules.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: rules
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rules'
    });
  }
};

// Create rule
const createRule = async (req, res) => {
  try {
    const { title, description, tournamentId } = req.body;

    // Validate required fields
    if (!title || !description || !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and tournamentId'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
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

    const rule = new Rule({
      title,
      description,
      tournamentId
    });

    await rule.save();

    res.status(201).json({
      success: true,
      message: 'Rule created successfully',
      data: rule
    });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating rule',
      error: error.message
    });
  }
};

// Update rule
const updateRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    const rule = await Rule.findById(id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    const { title, description } = req.body;

    if (title) rule.title = title;
    if (description) rule.description = description;

    await rule.save();

    res.status(200).json({
      success: true,
      message: 'Rule updated successfully',
      data: rule
    });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating rule',
      error: error.message
    });
  }
};

// Delete rule
const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    const rule = await Rule.findById(id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    await Rule.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rule'
    });
  }
};

module.exports = {
  getRulesByTournament,
  createRule,
  updateRule,
  deleteRule
};

