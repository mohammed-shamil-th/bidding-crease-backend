// Player Model
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  image: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['Batter', 'Bowler', 'All-Rounder'],
    required: true
  },
  battingStyle: {
    type: String,
    enum: ['Right', 'Left'],
    default: null
  },
  bowlingStyle: {
    type: String,
    enum: [
      'Right-arm medium',
      'Right-arm fast',
      'Right-arm spin',
      'Left-arm medium',
      'Left-arm fast',
      'Left-arm orthodox',
      'Left-arm unorthodox'
    ],
    default: null
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  soldPrice: {
    type: Number,
    default: null,
    min: 0
  },
  soldTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  wasAuctioned: {
    type: Boolean,
    default: false
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
playerSchema.index({ tournamentId: 1 });
playerSchema.index({ soldTo: 1 });
playerSchema.index({ soldPrice: 1 });
playerSchema.index({ categoryId: 1 });

// Virtual to check if player is sold
playerSchema.virtual('isSold').get(function() {
  return this.soldPrice !== null && this.soldTo !== null;
});

module.exports = mongoose.model('Player', playerSchema);

