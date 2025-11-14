// Team Routes
const express = require('express');
const router = express.Router();
const {
  getAllTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  downloadTeamsReport,
  downloadTeamReport
} = require('../controllers/teamController');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadTeamLogo } = require('../config/cloudinary');

// Public routes
router.get('/', getAllTeams);
router.get('/download/pdf', downloadTeamsReport);
router.get('/:id/download/pdf', downloadTeamReport);
router.get('/:id', getTeam);

// Admin only routes
router.post('/', authenticateAdmin, uploadTeamLogo.single('logo'), createTeam);
router.put('/:id', authenticateAdmin, uploadTeamLogo.single('logo'), updateTeam);
router.delete('/:id', authenticateAdmin, deleteTeam);

module.exports = router;

