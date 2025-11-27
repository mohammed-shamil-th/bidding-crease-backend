// Tournament Routes
const express = require('express');
const router = express.Router();
const {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  createPlayerInvite,
  listPlayerInvites,
  togglePlayerInvite,
  deletePlayerInvite,
  getInviteByToken
} = require('../controllers/tournamentController');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadTournamentLogo } = require('../config/cloudinary');

// Public routes
router.get('/', getAllTournaments);
router.get('/player-invites/:token', getInviteByToken);
router.get('/:id', getTournament);

// Admin only routes
router.post('/', authenticateAdmin, uploadTournamentLogo.single('logo'), createTournament);
router.put('/:id', authenticateAdmin, uploadTournamentLogo.single('logo'), updateTournament);
router.delete('/:id', authenticateAdmin, deleteTournament);
router.get('/:id/player-invites', authenticateAdmin, listPlayerInvites);
router.post('/:id/player-invites', authenticateAdmin, createPlayerInvite);
router.patch('/:id/player-invites/:inviteId/toggle', authenticateAdmin, togglePlayerInvite);
router.delete('/:id/player-invites/:inviteId', authenticateAdmin, deletePlayerInvite);

module.exports = router;

