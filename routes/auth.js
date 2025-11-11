// Authentication Routes
const express = require('express');
const router = express.Router();
const { login, verify } = require('../controllers/authController');
const { authenticateAdmin } = require('../middleware/auth');

// Public routes
router.post('/login', login);
router.get('/verify', authenticateAdmin, verify);

module.exports = router;

