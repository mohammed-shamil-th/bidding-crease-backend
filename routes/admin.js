// Admin Routes - Utility operations
const express = require('express');
const router = express.Router();
const { clearAllData } = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/auth');

// Admin only routes
router.delete('/clear-all', authenticateAdmin, clearAllData);

module.exports = router;

