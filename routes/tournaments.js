// Tournament Routes
const express = require('express');
const router = express.Router();
const {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament
} = require('../controllers/tournamentController');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadTournamentLogo } = require('../config/cloudinary');

// Public routes
router.get('/', getAllTournaments);
router.get('/:id', getTournament);

// Admin only routes
router.post('/', authenticateAdmin, uploadTournamentLogo.single('logo'), createTournament);
router.put('/:id', authenticateAdmin, uploadTournamentLogo.single('logo'), updateTournament);
router.delete('/:id', authenticateAdmin, deleteTournament);

module.exports = router;

