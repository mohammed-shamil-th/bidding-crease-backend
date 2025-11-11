// Rule Model
const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
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
ruleSchema.index({ tournamentId: 1 });

module.exports = mongoose.model('Rule', ruleSchema);

