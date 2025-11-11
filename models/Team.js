// Team Model
const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  owner: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  budget: {
    type: Number,
    required: true,
    min: 0
  },
  remainingAmount: {
    type: Number,
    default: function() {
      return this.budget;
    },
    min: 0
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
teamSchema.index({ tournamentId: 1 });
teamSchema.index({ 'players': 1 });

// Auto-update remainingAmount when players are added/removed
teamSchema.methods.updateRemainingAmount = async function() {
  const Player = mongoose.model('Player');
  const players = await Player.find({ _id: { $in: this.players }, soldPrice: { $ne: null } });
  const totalSpent = players.reduce((sum, player) => sum + (player.soldPrice || 0), 0);
  this.remainingAmount = this.budget - totalSpent;
  await this.save();
};

module.exports = mongoose.model('Team', teamSchema);

