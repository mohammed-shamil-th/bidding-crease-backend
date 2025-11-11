// Player Routes
const express = require('express');
const router = express.Router();
const {
  getAllPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer
} = require('../controllers/playerController');
const { authenticateAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getAllPlayers);
router.get('/:id', getPlayer);

// Admin only routes
router.post('/', authenticateAdmin, upload.single('image'), createPlayer);
router.put('/:id', authenticateAdmin, upload.single('image'), updatePlayer);
router.delete('/:id', authenticateAdmin, deletePlayer);

module.exports = router;

