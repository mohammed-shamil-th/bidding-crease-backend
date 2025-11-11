// Tournament Model
const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['open', 'private'],
    required: true,
    default: 'open'
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  auctionDate: {
    type: Date,
    required: true
  },
  tournamentDate: {
    type: Date,
    required: true
  },
  teamBudget: {
    type: Number,
    required: true,
    min: 0
  },
  minPlayers: {
    type: Number,
    required: true,
    min: 1
  },
  maxPlayers: {
    type: Number,
    required: true,
    min: 1
  },
  totalTeams: {
    type: Number,
    required: true,
    min: 1
  },
  totalPlayers: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

// Index for faster queries
tournamentSchema.index({ status: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);

