// Admin Controller - Utility functions
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

// Clear all players, tournaments, and teams
const clearAllData = async (req, res) => {
  try {
    // Delete in order: players first (they reference tournaments),
    // then teams (they reference tournaments and players),
    // then tournaments
    
    // Count before deletion for response
    const playersCount = await Player.countDocuments();
    const teamsCount = await Team.countDocuments();
    const tournamentsCount = await Tournament.countDocuments();

    // Delete all players
    const playersResult = await Player.deleteMany({});
    
    // Delete all teams
    const teamsResult = await Team.deleteMany({});
    
    // Delete all tournaments
    const tournamentsResult = await Tournament.deleteMany({});

    res.status(200).json({
      success: true,
      message: 'All data cleared successfully',
      data: {
        players: {
          deleted: playersResult.deletedCount,
          total: playersCount
        },
        teams: {
          deleted: teamsResult.deletedCount,
          total: teamsCount
        },
        tournaments: {
          deleted: tournamentsResult.deletedCount,
          total: tournamentsCount
        },
        totalDeleted: playersResult.deletedCount + teamsResult.deletedCount + tournamentsResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Clear all data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing data',
      error: error.message
    });
  }
};

module.exports = {
  clearAllData
};

