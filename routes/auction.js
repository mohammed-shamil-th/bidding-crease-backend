// Auction Routes
const express = require('express');
const router = express.Router();
const {
  getCurrentAuction,
  getUnsoldPlayers,
  getMaxBidsForTeams,
  startAuction,
  shufflePlayer,
  selectPlayer,
  placeBid,
  sellPlayer,
  markUnsold,
  cancelCurrentPlayer
} = require('../controllers/auctionController');
const { authenticateAdmin } = require('../middleware/auth');

// Public routes
router.get('/current', getCurrentAuction);
router.get('/unsold', getUnsoldPlayers);
router.get('/max-bids', getMaxBidsForTeams);

// Admin only routes
router.post('/start', authenticateAdmin, startAuction);
router.post('/shuffle', authenticateAdmin, shufflePlayer);
router.post('/select-player', authenticateAdmin, selectPlayer);
router.post('/bid', authenticateAdmin, placeBid);
router.post('/sell', authenticateAdmin, sellPlayer);
router.post('/mark-unsold', authenticateAdmin, markUnsold);
router.post('/cancel-player', authenticateAdmin, cancelCurrentPlayer);

module.exports = router;

