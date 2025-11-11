// Rules Routes
const express = require('express');
const router = express.Router();
const {
  getRulesByTournament,
  createRule,
  updateRule,
  deleteRule
} = require('../controllers/ruleController');
const { authenticateAdmin } = require('../middleware/auth');

// Public routes
router.get('/tournament/:tournamentId', getRulesByTournament);

// Admin only routes
router.post('/', authenticateAdmin, createRule);
router.put('/:id', authenticateAdmin, updateRule);
router.delete('/:id', authenticateAdmin, deleteRule);

module.exports = router;

