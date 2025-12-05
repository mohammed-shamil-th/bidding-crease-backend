// Player Routes
const express = require('express');
const router = express.Router();
const {
  getAllPlayers,
  getPlayer,
  createPlayer,
  createPlayerPublic,
  updatePlayer,
  deletePlayer,
  bulkCreatePlayers,
  exportPlayersToExcel
} = require('../controllers/playerController');
const { authenticateAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const handlePlayerUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image must be smaller than 2MB',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading image',
      });
    }
    return next();
  });
};

// Public routes
router.get('/', getAllPlayers);
router.get('/export/excel', exportPlayersToExcel);
router.get('/:id', getPlayer);
router.post('/public/:token', handlePlayerUpload, createPlayerPublic);

// Admin only routes
router.post('/', authenticateAdmin, handlePlayerUpload, createPlayer);
router.post('/bulk', authenticateAdmin, bulkCreatePlayers);
router.put('/:id', authenticateAdmin, handlePlayerUpload, updatePlayer);
router.delete('/:id', authenticateAdmin, deletePlayer);

module.exports = router;

