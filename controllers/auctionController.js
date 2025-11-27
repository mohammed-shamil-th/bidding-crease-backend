// Auction Controller
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { isValidObjectId } = require('../utils/validators');

// Helper function to get basePrice from player's category
const getPlayerBasePrice = async (player) => {
  if (!player || !player.categoryId || !player.tournamentId) {
    return 0;
  }
  
  const tournament = await Tournament.findById(player.tournamentId);
  if (!tournament || !Array.isArray(tournament.categories)) {
    return 0;
  }
  
  const category = tournament.categories.id(player.categoryId);
  return category ? (category.basePrice || 0) : 0;
};

// Store current auction state in memory (in production, use Redis or database)
let currentAuctionState = {
  currentPlayerId: null,
  currentBidPrice: null,
  tournamentId: null,
  isActive: false
};

// Get current auction state
const getCurrentAuction = async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    let currentPlayer = null;
    if (currentAuctionState.currentPlayerId) {
      const playerDoc = await Player.findById(currentAuctionState.currentPlayerId)
        .populate('soldTo', 'name logo');
      
      // Get tournament to access category information
      const tournament = await Tournament.findById(tournamentId);
      if (tournament && tournament.categories && playerDoc && playerDoc.categoryId) {
        const category = tournament.categories.id(playerDoc.categoryId);
        if (category) {
          currentPlayer = playerDoc.toObject();
          currentPlayer.categoryId = category._id.toString();
          currentPlayer.category = category.name;
          currentPlayer.basePrice = category.basePrice;
        } else {
          currentPlayer = playerDoc;
        }
      } else {
        currentPlayer = playerDoc;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...currentAuctionState,
        currentPlayer
      }
    });
  } catch (error) {
    console.error('Get current auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction state'
    });
  }
};

// Get unsold players
const getUnsoldPlayers = async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    const unsoldPlayers = await Player.find({
      tournamentId,
      $or: [
        { soldPrice: null },
        { soldTo: null }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: unsoldPlayers.length,
      data: unsoldPlayers
    });
  } catch (error) {
    console.error('Get unsold players error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unsold players'
    });
  }
};

// Start auction - select first unsold player
const startAuction = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    // Get first unsold player
    const firstUnsoldPlayer = await Player.findOne({
      tournamentId,
      $or: [
        { soldPrice: null },
        { soldTo: null }
      ]
    }).sort({ createdAt: 1 });

    if (!firstUnsoldPlayer) {
      return res.status(404).json({
        success: false,
        message: 'No unsold players found'
      });
    }

    // Mark player as auctioned
    firstUnsoldPlayer.wasAuctioned = true;
    await firstUnsoldPlayer.save();

    // Get basePrice from category
    const basePrice = await getPlayerBasePrice(firstUnsoldPlayer);

    // Get tournament to access category information
    const tournament = await Tournament.findById(tournamentId);
    let categoryInfo = null;
    if (tournament && tournament.categories && firstUnsoldPlayer.categoryId) {
      const category = tournament.categories.id(firstUnsoldPlayer.categoryId);
      if (category) {
        categoryInfo = {
          categoryId: category._id.toString(),
          categoryName: category.name,
          basePrice: category.basePrice
        };
      }
    }

    // Update auction state
    currentAuctionState = {
      currentPlayerId: firstUnsoldPlayer._id.toString(),
      currentBidPrice: basePrice,
      tournamentId: tournamentId,
      isActive: true
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    const player = await Player.findById(firstUnsoldPlayer._id)
      .populate('soldTo', 'name logo');
    
    // Add category information to player object for socket emission
    const playerWithCategory = player.toObject();
    if (categoryInfo) {
      playerWithCategory.categoryId = categoryInfo.categoryId;
      playerWithCategory.category = categoryInfo.categoryName;
      playerWithCategory.basePrice = categoryInfo.basePrice;
    }
    
    io.to(`auction:${tournamentId}`).emit('auction:started', {
      tournamentId,
      isActive: true
    });

    io.to(`auction:${tournamentId}`).emit('player:selected', {
      player: playerWithCategory,
      currentBidPrice: currentAuctionState.currentBidPrice
    });

    // Add category information to response player
    const responsePlayer = player.toObject();
    if (categoryInfo) {
      responsePlayer.categoryId = categoryInfo.categoryId;
      responsePlayer.category = categoryInfo.categoryName;
      responsePlayer.basePrice = categoryInfo.basePrice;
    }

    res.status(200).json({
      success: true,
      message: 'Auction started',
      data: {
        currentPlayer: responsePlayer,
        currentBidPrice: currentAuctionState.currentBidPrice
      }
    });
  } catch (error) {
    console.error('Start auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting auction',
      error: error.message
    });
  }
};

// Shuffle - select random unsold player
const shufflePlayer = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    // Get all unsold players
    const unsoldPlayers = await Player.find({
      tournamentId,
      $or: [
        { soldPrice: null },
        { soldTo: null }
      ]
    });

    if (unsoldPlayers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No unsold players found'
      });
    }

    // Select random player
    const randomIndex = Math.floor(Math.random() * unsoldPlayers.length);
    const selectedPlayer = unsoldPlayers[randomIndex];

    // Mark player as auctioned
    selectedPlayer.wasAuctioned = true;
    await selectedPlayer.save();

    // Get basePrice from category
    const basePrice = await getPlayerBasePrice(selectedPlayer);

    // Get tournament to access category information
    const tournament = await Tournament.findById(tournamentId);
    let categoryInfo = null;
    if (tournament && tournament.categories && selectedPlayer.categoryId) {
      const category = tournament.categories.id(selectedPlayer.categoryId);
      if (category) {
        categoryInfo = {
          categoryId: category._id.toString(),
          categoryName: category.name,
          basePrice: category.basePrice
        };
      }
    }

    // Update auction state
    currentAuctionState = {
      currentPlayerId: selectedPlayer._id.toString(),
      currentBidPrice: basePrice,
      tournamentId: tournamentId,
      isActive: true
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    const player = await Player.findById(selectedPlayer._id)
      .populate('soldTo', 'name logo');
    
    // Add category information to player object for socket emission
    const playerWithCategory = player.toObject();
    if (categoryInfo) {
      playerWithCategory.categoryId = categoryInfo.categoryId;
      playerWithCategory.category = categoryInfo.categoryName;
      playerWithCategory.basePrice = categoryInfo.basePrice;
    }
    
    io.to(`auction:${tournamentId}`).emit('player:selected', {
      player: playerWithCategory,
      currentBidPrice: currentAuctionState.currentBidPrice
    });

    // Add category information to response player
    const responsePlayer = player.toObject();
    if (categoryInfo) {
      responsePlayer.categoryId = categoryInfo.categoryId;
      responsePlayer.category = categoryInfo.categoryName;
      responsePlayer.basePrice = categoryInfo.basePrice;
    }

    res.status(200).json({
      success: true,
      message: 'Player selected',
      data: {
        currentPlayer: responsePlayer,
        currentBidPrice: currentAuctionState.currentBidPrice
      }
    });
  } catch (error) {
    console.error('Shuffle player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error shuffling player',
      error: error.message
    });
  }
};

// Calculate bid increment based on current price and tournament
const calculateBidIncrement = (currentPrice, tournament = null) => {
  // Use tournament-specific increments if available
  if (tournament && tournament.bidIncrements && tournament.bidIncrements.length > 0) {
    // Sort by minPrice to ensure proper order
    const sorted = [...tournament.bidIncrements].sort((a, b) => a.minPrice - b.minPrice);
    
    for (const increment of sorted) {
      const minPrice = increment.minPrice;
      const maxPrice = increment.maxPrice;
      
      // Check if current price falls in this range
      if (currentPrice >= minPrice) {
        if (maxPrice === null || maxPrice === undefined) {
          // Last range with no upper limit
          return increment.increment;
        } else if (currentPrice <= maxPrice) {
          return increment.increment;
        }
      }
    }
  }
  
  // Default fallback (original logic)
  if (currentPrice >= 1 && currentPrice <= 1000) {
    return 100;
  } else if (currentPrice >= 1001 && currentPrice <= 5000) {
    return 200;
  } else if (currentPrice >= 5001) {
    return 500;
  }
  return 100; // Default
};

// Place bid
const placeBid = async (req, res) => {
  try {
    const { tournamentId, teamId, bidAmount } = req.body;

    if (!tournamentId || !teamId || !bidAmount) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID, Team ID, and bid amount are required'
      });
    }

    if (!isValidObjectId(tournamentId) || !isValidObjectId(teamId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament or team ID'
      });
    }

    // Check if auction is active
    if (!currentAuctionState.isActive || currentAuctionState.tournamentId !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Auction is not active'
      });
    }

    // Get current player
    const currentPlayer = await Player.findById(currentAuctionState.currentPlayerId);
    if (!currentPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Current player not found'
      });
    }

    // Get team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Get tournament for validation and bid increment calculation
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Validate bid amount using tournament-specific increments
    const increment = calculateBidIncrement(currentAuctionState.currentBidPrice, tournament);
    const minBid = currentAuctionState.currentBidPrice + increment;

    if (bidAmount < minBid) {
      return res.status(400).json({
        success: false,
        message: `Minimum bid is ${minBid} (current: ${currentAuctionState.currentBidPrice} + increment: ${increment})`
      });
    }

    // Allow bids even if team exceeds remaining amount (will show negative)
    // No longer blocking bids that exceed remainingAmount

    // Validate team can meet category quota requirements after this bid
    const remainingAfterBid = team.remainingAmount - bidAmount;
    
    if (tournament.categories && tournament.categories.length > 0) {
      // Get players already purchased by this team
      const purchasedPlayers = await Player.find({
        _id: { $in: team.players },
        soldPrice: { $ne: null },
        soldTo: { $ne: null }
      });

      // Count players per categoryId
      const playersByCategoryId = {};
      purchasedPlayers.forEach(player => {
        const catId = player.categoryId ? player.categoryId.toString() : null;
        if (catId) {
          if (!playersByCategoryId[catId]) {
            playersByCategoryId[catId] = 0;
          }
          playersByCategoryId[catId]++;
        }
      });

      // Check if bidding on current player would help fill a category quota
      const currentPlayerCategoryId = currentPlayer.categoryId ? currentPlayer.categoryId.toString() : null;
      
      // Calculate team size after this bid
      const currentPlayerCount = purchasedPlayers.length;
      const teamSizeAfterBid = currentPlayerCount + 1;
      const availableSlotsAfterBid = tournament.maxPlayers - teamSizeAfterBid;
      
      // Calculate total players still needed across all categories after this bid
      let totalPlayersNeeded = 0;
      const categoryNeeds = [];
      
      for (const category of tournament.categories) {
        const catId = category._id ? category._id.toString() : null;
        const currentCount = catId ? (playersByCategoryId[catId] || 0) : 0;
        const minRequired = category.minPlayers || 0;
        
        // If this bid is for a player in this category, add 1 to count
        let countAfterBid = currentCount;
        if (currentPlayerCategoryId === catId) {
          countAfterBid = currentCount + 1;
        }
        
        const remainingNeeded = Math.max(0, minRequired - countAfterBid);
        if (remainingNeeded > 0) {
          totalPlayersNeeded += remainingNeeded;
          categoryNeeds.push({
            name: category.name,
            needed: remainingNeeded
          });
        }
      }
      
      // Check if team has enough slots to meet all category requirements
      if (totalPlayersNeeded > availableSlotsAfterBid) {
        const categoryList = categoryNeeds.map(c => `${c.needed} ${c.name}`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Team cannot meet category requirements. After this bid, team will have ${availableSlotsAfterBid} slot(s) remaining but needs ${totalPlayersNeeded} more player(s) (${categoryList}). Maximum team size is ${tournament.maxPlayers}.`
        });
      }
      
      // Check each category requirement for budget validation
      for (const category of tournament.categories) {
        const catId = category._id ? category._id.toString() : null;
        const currentCount = catId ? (playersByCategoryId[catId] || 0) : 0;
        const minRequired = category.minPlayers || 0;
        
        // If this bid is for a player in this category, add 1 to count
        let countAfterBid = currentCount;
        if (currentPlayerCategoryId === catId) {
          countAfterBid = currentCount + 1;
        }
        
        const remainingNeeded = Math.max(0, minRequired - countAfterBid);
        
        if (remainingNeeded > 0) {
          // Get minimum base price for this category from unsold players (excluding current)
          const unsoldInCategory = await Player.find({
            tournamentId,
            categoryId: catId,
            _id: { $ne: currentPlayer._id },
            $or: [
              { soldPrice: null },
              { soldTo: null }
            ]
          });
          
          let requiredAmount = 0;
          if (unsoldInCategory.length > 0) {
            const basePrices = await Promise.all(unsoldInCategory.map(p => getPlayerBasePrice(p)));
            const minBasePrice = Math.min(...basePrices.filter(p => p > 0));
            requiredAmount = remainingNeeded * (minBasePrice || category.basePrice);
          } else {
            // No unsold players in this category, use category basePrice
            requiredAmount = remainingNeeded * category.basePrice;
          }
          
          if (remainingAfterBid < requiredAmount) {
            return res.status(400).json({
              success: false,
              message: `Team cannot afford minimum required players for category "${category.name}". After this bid, team needs ${remainingNeeded} more player(s) in this category but only has ${remainingAfterBid} remaining (minimum required: ${requiredAmount}).`
            });
          }
        }
      }
    } else {
      // Fallback to old logic if no categories defined
      const currentPlayerCount = team.players.length;
      const playersNeeded = tournament.minPlayers - currentPlayerCount - 1; // -1 for current bid

      if (playersNeeded > 0) {
        // Get minimum base price from unsold players
        const unsoldPlayers = await Player.find({
          tournamentId,
          _id: { $ne: currentPlayer._id },
          $or: [
            { soldPrice: null },
            { soldTo: null }
          ]
        });

        if (unsoldPlayers.length > 0) {
          // Get base prices from categories
          const basePrices = await Promise.all(unsoldPlayers.map(p => getPlayerBasePrice(p)));
          const minBasePrice = Math.min(...basePrices.filter(p => p > 0));
          const requiredAmount = playersNeeded * (minBasePrice || 0);

          if (remainingAfterBid < requiredAmount) {
            return res.status(400).json({
              success: false,
              message: `Team cannot afford minimum required players. After this bid, team needs ${playersNeeded} more players but only has ${remainingAfterBid} remaining (minimum required: ${requiredAmount}).`
            });
          }
        }
      }
    }

    // Update current bid price
    currentAuctionState.currentBidPrice = bidAmount;

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    io.to(`auction:${tournamentId}`).emit('bid:placed', {
      teamId,
      teamName: team.name,
      bidAmount,
      currentBidPrice: currentAuctionState.currentBidPrice
    });

    res.status(200).json({
      success: true,
      message: 'Bid placed successfully',
      data: {
        bidAmount,
        currentBidPrice: currentAuctionState.currentBidPrice,
        team: {
          id: team._id,
          name: team.name,
          remainingAmount: team.remainingAmount
        }
      }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing bid',
      error: error.message
    });
  }
};

// Helper function to check category requirements and return warnings
const checkCategoryRequirements = async (team, currentPlayer, tournament, bidPrice) => {
  const warnings = [];
  
  if (!tournament.categories || tournament.categories.length === 0) {
    return warnings;
  }

  // Get players already purchased by this team
  const purchasedPlayers = await Player.find({
    _id: { $in: team.players },
    soldPrice: { $ne: null },
    soldTo: { $ne: null }
  });

  // Count players per categoryId
  const playersByCategoryId = {};
  purchasedPlayers.forEach(player => {
    const catId = player.categoryId ? player.categoryId.toString() : null;
    if (catId) {
      if (!playersByCategoryId[catId]) {
        playersByCategoryId[catId] = 0;
      }
      playersByCategoryId[catId]++;
    }
  });

  // Check if selling current player would help fill a category quota
  const currentPlayerCategoryId = currentPlayer.categoryId ? currentPlayer.categoryId.toString() : null;
  
  // Calculate team size after sale
  const currentPlayerCount = purchasedPlayers.length;
  const teamSizeAfterSale = currentPlayerCount + 1;
  const availableSlotsAfterSale = tournament.maxPlayers - teamSizeAfterSale;
  
  // Calculate total players still needed across all categories after sale
  let totalPlayersNeeded = 0;
  const categoryNeeds = [];
  
  for (const category of tournament.categories) {
    const catId = category._id ? category._id.toString() : null;
    const currentCount = catId ? (playersByCategoryId[catId] || 0) : 0;
    const minRequired = category.minPlayers || 0;
    
    // If this sale is for a player in this category, add 1 to count
    let countAfterSale = currentCount;
    if (currentPlayerCategoryId === catId) {
      countAfterSale = currentCount + 1;
    }
    
    const remainingNeeded = Math.max(0, minRequired - countAfterSale);
    if (remainingNeeded > 0) {
      totalPlayersNeeded += remainingNeeded;
      categoryNeeds.push({
        name: category.name,
        needed: remainingNeeded
      });
    }
  }
  
  // Check if team has enough slots to meet all category requirements
  if (totalPlayersNeeded > availableSlotsAfterSale) {
    const categoryList = categoryNeeds.map(c => `${c.needed} ${c.name}`).join(', ');
    warnings.push({
      type: 'slot_insufficient',
      message: `Team cannot meet category requirements. After this sale, team will have ${availableSlotsAfterSale} slot(s) remaining but needs ${totalPlayersNeeded} more player(s) (${categoryList}). Maximum team size is ${tournament.maxPlayers}.`
    });
  }
  
  // Check budget requirements for each category
  const remainingAfterSale = team.remainingAmount - bidPrice;
  
  for (const category of tournament.categories) {
    const catId = category._id ? category._id.toString() : null;
    const currentCount = catId ? (playersByCategoryId[catId] || 0) : 0;
    const minRequired = category.minPlayers || 0;
    
    // If this sale is for a player in this category, add 1 to count
    let countAfterSale = currentCount;
    if (currentPlayerCategoryId === catId) {
      countAfterSale = currentCount + 1;
    }
    
    const remainingNeeded = Math.max(0, minRequired - countAfterSale);
    
    if (remainingNeeded > 0) {
      // Get minimum base price for this category from unsold players (excluding current)
      const unsoldInCategory = await Player.find({
        tournamentId: tournament._id,
        categoryId: catId,
        _id: { $ne: currentPlayer._id },
        $or: [
          { soldPrice: null },
          { soldTo: null }
        ]
      });
      
      let requiredAmount = 0;
      if (unsoldInCategory.length > 0) {
        const basePrices = await Promise.all(unsoldInCategory.map(p => getPlayerBasePrice(p)));
        const minBasePrice = Math.min(...basePrices.filter(p => p > 0));
        requiredAmount = remainingNeeded * (minBasePrice || category.basePrice);
      } else {
        // No unsold players in this category, use category basePrice
        requiredAmount = remainingNeeded * category.basePrice;
      }
      
      if (remainingAfterSale < requiredAmount) {
        warnings.push({
          type: 'budget_insufficient',
          message: `Team cannot afford minimum required players for category "${category.name}". After this sale, team needs ${remainingNeeded} more player(s) in this category but only has ${remainingAfterSale} remaining (minimum required: ${requiredAmount}).`
        });
      }
    }
  }
  
  return warnings;
};

// Sell player to team
const sellPlayer = async (req, res) => {
  try {
    const { tournamentId, teamId } = req.body;

    if (!tournamentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and Team ID are required'
      });
    }

    if (!isValidObjectId(tournamentId) || !isValidObjectId(teamId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament or team ID'
      });
    }

    // Check if auction is active
    if (!currentAuctionState.isActive || currentAuctionState.tournamentId !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Auction is not active'
      });
    }

    // Get current player
    const currentPlayer = await Player.findById(currentAuctionState.currentPlayerId);
    if (!currentPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Current player not found'
      });
    }

    // Check if player is already sold
    if (currentPlayer.soldPrice !== null && currentPlayer.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Player is already sold'
      });
    }

    // Get team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Get tournament to check for warnings
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check category requirements and get warnings
    const categoryWarnings = await checkCategoryRequirements(team, currentPlayer, tournament, currentAuctionState.currentBidPrice);

    // Allow sale even if team exceeds remaining amount (will show negative)
    const exceedsLimit = team.remainingAmount < currentAuctionState.currentBidPrice;
    const excessAmount = exceedsLimit ? currentAuctionState.currentBidPrice - team.remainingAmount : 0;

    // Update player
    currentPlayer.soldPrice = currentAuctionState.currentBidPrice;
    currentPlayer.soldTo = teamId;
    await currentPlayer.save();

    // Update team
    team.players.push(currentPlayer._id);
    await team.updateRemainingAmount();

    // Reset auction state
    currentAuctionState = {
      currentPlayerId: null,
      currentBidPrice: null,
      tournamentId: tournamentId,
      isActive: false
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    const updatedPlayer = await Player.findById(currentPlayer._id)
      .populate('soldTo', 'name logo remainingAmount');
    const updatedTeam = await Team.findById(teamId);

    io.to(`auction:${tournamentId}`).emit('player:sold', {
      player: updatedPlayer,
      team: {
        id: updatedTeam._id,
        name: updatedTeam.name,
        remainingAmount: updatedTeam.remainingAmount,
        playerCount: updatedTeam.players.length
      }
    });

    io.to(`auction:${tournamentId}`).emit('team:updated', {
      teamId: teamId,
      remainingAmount: updatedTeam.remainingAmount,
      playerCount: updatedTeam.players.length
    });

    res.status(200).json({
      success: true,
      message: 'Player sold successfully',
      data: {
        player: updatedPlayer,
        team: {
          id: updatedTeam._id,
          name: updatedTeam.name,
          remainingAmount: updatedTeam.remainingAmount,
          playerCount: updatedTeam.players.length
        },
        warnings: {
          budgetExceeded: exceedsLimit ? `Team exceeded budget limit by ${excessAmount}. Fine will be calculated externally.` : null,
          categoryRequirements: categoryWarnings.length > 0 ? categoryWarnings.map(w => w.message) : []
        }
      }
    });
  } catch (error) {
    console.error('Sell player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error selling player',
      error: error.message
    });
  }
};

// Get maximum available bid for teams
const getMaxBidsForTeams = async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    // Get tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Get all teams for this tournament
    const teams = await Team.find({ tournamentId }).populate('players');

    // Get all players for this tournament to check categories
    const allPlayers = await Player.find({ tournamentId });

    // Calculate max bid for each team based on category quotas
    const maxBids = await Promise.all(teams.map(async (team) => {
      // Get players already purchased by this team
      const purchasedPlayers = await Player.find({
        _id: { $in: team.players },
        soldPrice: { $ne: null },
        soldTo: { $ne: null }
      });

      // Count players per categoryId
      const playersByCategoryId = {};
      purchasedPlayers.forEach(player => {
        const catId = player.categoryId ? player.categoryId.toString() : null;
        if (catId) {
          if (!playersByCategoryId[catId]) {
            playersByCategoryId[catId] = 0;
          }
          playersByCategoryId[catId]++;
        }
      });

      // Calculate required amount based on category quotas
      let requiredAmount = 0;
      
      if (tournament.categories && tournament.categories.length > 0) {
        // Use tournament categories
        for (const category of tournament.categories) {
          const catId = category._id ? category._id.toString() : null;
          const currentCount = catId ? (playersByCategoryId[catId] || 0) : 0;
          const minRequired = category.minPlayers || 0;
          const remainingNeeded = Math.max(0, minRequired - currentCount);
          
          if (remainingNeeded > 0) {
            // Get minimum base price for this category from unsold players
            const unsoldInCategory = allPlayers.filter(p => {
              const pCatId = p.categoryId ? p.categoryId.toString() : null;
              return pCatId === catId && (p.soldPrice === null || p.soldTo === null);
            });
            
            if (unsoldInCategory.length > 0) {
              // Get base prices from categories
              const basePrices = await Promise.all(unsoldInCategory.map(p => getPlayerBasePrice(p)));
              const minBasePrice = Math.min(...basePrices.filter(p => p > 0));
              requiredAmount += remainingNeeded * (minBasePrice || category.basePrice);
            } else {
              // No unsold players in this category, use category basePrice
              requiredAmount += remainingNeeded * category.basePrice;
            }
          }
        }
      } else {
        // Fallback to old logic if no categories defined
        const currentPlayerCount = purchasedPlayers.length;
        const playersNeeded = tournament.minPlayers - currentPlayerCount;
        
        if (playersNeeded > 0) {
          const unsoldPlayers = allPlayers.filter(p => 
            p.soldPrice === null || p.soldTo === null
          );
          
          if (unsoldPlayers.length > 0) {
            // Get base prices from categories
            const basePrices = await Promise.all(unsoldPlayers.map(p => getPlayerBasePrice(p)));
            const minBasePrice = Math.min(...basePrices.filter(p => p > 0));
            requiredAmount = playersNeeded * (minBasePrice || 0);
          }
        }
      }

      // Max bid = remainingAmount - requiredAmount (can be negative)
      const maxBid = team.remainingAmount - requiredAmount;

      return {
        teamId: team._id.toString(),
        maxBid
      };
    }));

    res.status(200).json({
      success: true,
      data: maxBids
    });
  } catch (error) {
    console.error('Get max bids error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating max bids',
      error: error.message
    });
  }
};

// Select player manually for auction
const selectPlayer = async (req, res) => {
  try {
    const { tournamentId, playerId } = req.body;

    if (!tournamentId || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and Player ID are required'
      });
    }

    if (!isValidObjectId(tournamentId) || !isValidObjectId(playerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament or player ID'
      });
    }

    // Get player
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Check if player belongs to tournament
    if (player.tournamentId.toString() !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Player does not belong to this tournament'
      });
    }

    // Check if player is already sold
    if (player.soldPrice !== null && player.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Player is already sold'
      });
    }

    // Mark player as auctioned
    player.wasAuctioned = true;
    await player.save();

    // Get basePrice from category
    const basePrice = await getPlayerBasePrice(player);

    // Get tournament to access category information
    const tournament = await Tournament.findById(tournamentId);
    let categoryInfo = null;
    if (tournament && tournament.categories && player.categoryId) {
      const category = tournament.categories.id(player.categoryId);
      if (category) {
        categoryInfo = {
          categoryId: category._id.toString(),
          categoryName: category.name,
          basePrice: category.basePrice
        };
      }
    }

    // Set as current player
    currentAuctionState = {
      currentPlayerId: playerId,
      currentBidPrice: basePrice,
      tournamentId: tournamentId,
      isActive: true
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    const playerDoc = await Player.findById(playerId).populate('soldTo', 'name logo');
    
    // Add category information to player object for socket emission
    const playerWithCategory = playerDoc.toObject();
    if (categoryInfo) {
      playerWithCategory.categoryId = categoryInfo.categoryId;
      playerWithCategory.category = categoryInfo.categoryName;
      playerWithCategory.basePrice = categoryInfo.basePrice;
    }
    
    io.to(`auction:${tournamentId}`).emit('player:selected', {
      player: playerWithCategory,
      currentBidPrice: currentAuctionState.currentBidPrice
    });

    // Add category information to response player
    const responsePlayer = playerDoc.toObject();
    if (categoryInfo) {
      responsePlayer.categoryId = categoryInfo.categoryId;
      responsePlayer.category = categoryInfo.categoryName;
      responsePlayer.basePrice = categoryInfo.basePrice;
    }

    res.status(200).json({
      success: true,
      message: 'Player selected successfully',
      data: {
        currentPlayer: responsePlayer,
        currentBidPrice: currentAuctionState.currentBidPrice,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Select player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error selecting player',
      error: error.message
    });
  }
};

// Mark current player as unsold
const markUnsold = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    // Check if auction is active
    if (!currentAuctionState.isActive || currentAuctionState.tournamentId !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Auction is not active'
      });
    }

    // Get current player
    const currentPlayer = await Player.findById(currentAuctionState.currentPlayerId);
    if (!currentPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Current player not found'
      });
    }

    // Check if player is already sold
    if (currentPlayer.soldPrice !== null && currentPlayer.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Player is already sold'
      });
    }

    // Mark player as auctioned (if not already marked)
    if (!currentPlayer.wasAuctioned) {
      currentPlayer.wasAuctioned = true;
      await currentPlayer.save();
    }

    // Reset auction state (player remains unsold)
    currentAuctionState = {
      currentPlayerId: null,
      currentBidPrice: null,
      tournamentId: tournamentId,
      isActive: false
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    io.to(`auction:${tournamentId}`).emit('player:unsold', {
      player: currentPlayer
    });

    res.status(200).json({
      success: true,
      message: 'Player marked as unsold',
      data: {
        player: currentPlayer
      }
    });
  } catch (error) {
    console.error('Mark unsold error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking player as unsold',
      error: error.message
    });
  }
};

// Cancel current player (reset wasAuctioned flag and clear auction state)
const cancelCurrentPlayer = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID is required'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    // Check if auction is active
    if (!currentAuctionState.isActive || currentAuctionState.tournamentId !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Auction is not active'
      });
    }

    // Get current player
    const currentPlayer = await Player.findById(currentAuctionState.currentPlayerId);
    if (!currentPlayer) {
      return res.status(404).json({
        success: false,
        message: 'Current player not found'
      });
    }

    // Check if player is already sold
    if (currentPlayer.soldPrice !== null && currentPlayer.soldTo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a sold player'
      });
    }

    // Reset wasAuctioned flag to false
    currentPlayer.wasAuctioned = false;
    await currentPlayer.save();

    // Clear auction state
    currentAuctionState = {
      currentPlayerId: null,
      currentBidPrice: null,
      tournamentId: null,
      isActive: false
    };

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    io.to(`auction:${tournamentId}`).emit('auction:cancelled', {
      tournamentId,
      playerId: currentPlayer._id.toString()
    });

    res.status(200).json({
      success: true,
      message: 'Player cancelled successfully',
      data: {
        playerId: currentPlayer._id.toString()
      }
    });
  } catch (error) {
    console.error('Cancel player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling player',
      error: error.message
    });
  }
};

// Export function to get current auction state (for Socket.IO)
const getCurrentAuctionState = () => {
  return currentAuctionState;
};

module.exports = {
  getCurrentAuction,
  getUnsoldPlayers,
  getMaxBidsForTeams,
  getCurrentAuctionState,
  startAuction,
  shufflePlayer,
  selectPlayer,
  placeBid,
  sellPlayer,
  markUnsold,
  cancelCurrentPlayer
};

