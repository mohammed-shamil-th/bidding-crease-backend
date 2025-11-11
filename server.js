// Express server with Socket.IO
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

// Import routes
const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const teamRoutes = require('./routes/teams');
const playerRoutes = require('./routes/players');
const ruleRoutes = require('./routes/rules');
const auctionRoutes = require('./routes/auction');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/auction', auctionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join auction room
  socket.on('join:auction', async (tournamentId) => {
    socket.join(`auction:${tournamentId}`);
    console.log(`Socket ${socket.id} joined auction:${tournamentId}`);
    
    // Send current auction state to the newly joined client
    // Note: This requires importing the auction controller's state
    // For now, clients will fetch current state on mount
  });

  // Leave auction room
  socket.on('leave:auction', (tournamentId) => {
    socket.leave(`auction:${tournamentId}`);
    console.log(`Socket ${socket.id} left auction:${tournamentId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Seed admin on first run
  seedAdmin();
  
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = { app, io };

