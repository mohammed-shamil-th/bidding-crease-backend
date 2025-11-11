// Team Routes
const express = require('express');
const router = express.Router();
const {
  getAllTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam
} = require('../controllers/teamController');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadTeamLogo } = require('../config/cloudinary');

// Public routes
router.get('/', getAllTeams);
router.get('/:id', getTeam);

// Admin only routes
router.post('/', authenticateAdmin, uploadTeamLogo.single('logo'), createTeam);
router.put('/:id', authenticateAdmin, uploadTeamLogo.single('logo'), updateTeam);
router.delete('/:id', authenticateAdmin, deleteTeam);

module.exports = router;

