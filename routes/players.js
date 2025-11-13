// Player Routes
const express = require('express');
const router = express.Router();
const {
  getAllPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  bulkCreatePlayers
} = require('../controllers/playerController');
const { authenticateAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getAllPlayers);
router.get('/:id', getPlayer);

// Admin only routes
router.post('/', authenticateAdmin, upload.single('image'), createPlayer);
router.post('/bulk', authenticateAdmin, bulkCreatePlayers);
router.put('/:id', authenticateAdmin, upload.single('image'), updatePlayer);
router.delete('/:id', authenticateAdmin, deletePlayer);

module.exports = router;

