// Cloudinary configuration
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer storage for Cloudinary - Players
const playerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'biddingcrease/players',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
  },
});

// Configure multer storage for Cloudinary - Tournaments
const tournamentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'biddingcrease/tournaments',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 300, height: 300, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
  },
});

// Configure multer storage for Cloudinary - Teams
const teamStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'biddingcrease/teams',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 300, height: 300, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
  },
});

const upload = multer({
  storage: playerStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});
const uploadTournamentLogo = multer({ storage: tournamentStorage });
const uploadTeamLogo = multer({ storage: teamStorage });

module.exports = { cloudinary, upload, uploadTournamentLogo, uploadTeamLogo };

