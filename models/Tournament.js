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
  },
  bidIncrements: {
    type: [{
      minPrice: {
        type: Number,
        required: true,
        min: 0
      },
      maxPrice: {
        type: Number,
        default: null // null means no upper limit (for last range)
      },
      increment: {
        type: Number,
        required: true,
        min: 1
      }
    }],
    default: [
      { minPrice: 1, maxPrice: 1000, increment: 100 },
      { minPrice: 1001, maxPrice: 5000, increment: 200 },
      { minPrice: 5001, maxPrice: null, increment: 500 }
    ]
  },
  categories: {
    type: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      basePrice: {
        type: Number,
        required: true,
        min: 0
      },
      minPlayers: {
        type: Number,
        required: true,
        min: 0
      },
      icon: {
        type: String,
        default: ''
      }
    }],
    default: []
  }
}, {
  timestamps: true
});

// Virtual to calculate status based on dates
tournamentSchema.virtual('calculatedStatus').get(function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const auctionDate = new Date(this.auctionDate);
  const auctionDay = new Date(auctionDate.getFullYear(), auctionDate.getMonth(), auctionDate.getDate());
  const tournamentDate = new Date(this.tournamentDate);
  const tournamentDay = new Date(tournamentDate.getFullYear(), tournamentDate.getMonth(), tournamentDate.getDate());

  // If tournament has ended
  if (tournamentDay < today) {
    return 'completed';
  }
  
  // If auction is today or has passed (but tournament hasn't ended)
  if (auctionDay <= today) {
    return 'ongoing';
  }
  
  // If auction is in the future
  return 'upcoming';
});

// Method to update status based on dates
tournamentSchema.methods.updateStatus = function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const auctionDate = new Date(this.auctionDate);
  const auctionDay = new Date(auctionDate.getFullYear(), auctionDate.getMonth(), auctionDate.getDate());
  const tournamentDate = new Date(this.tournamentDate);
  const tournamentDay = new Date(tournamentDate.getFullYear(), tournamentDate.getMonth(), tournamentDate.getDate());

  if (tournamentDay < today) {
    this.status = 'completed';
  } else if (auctionDay <= today) {
    this.status = 'ongoing';
  } else {
    this.status = 'upcoming';
  }
};

// Pre-save hook to automatically update status
tournamentSchema.pre('save', function(next) {
  if (this.isModified('auctionDate') || this.isModified('tournamentDate') || this.isNew) {
    this.updateStatus();
  }
  next();
});

// Index for faster queries
tournamentSchema.index({ status: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);

