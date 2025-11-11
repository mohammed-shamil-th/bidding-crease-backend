// Seed players for tournament
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');

const players = [
  { name: 'nikhil', category: 'Icon', basePrice: 1000 },
  { name: 'mushthak', category: 'Icon', basePrice: 1000 },
  { name: 'manu chembrashery', category: 'Icon', basePrice: 1000 },
  { name: 'Anees', category: 'Icon', basePrice: 1000 },
  { name: 'vaishak', category: 'Icon', basePrice: 1000 },
  { name: 'shamil tvr', category: 'Icon', basePrice: 1000 },
  { name: 'sanfad chokkad', category: 'Icon', basePrice: 1000 },
  { name: 'Saifu', category: 'Icon', basePrice: 1000 },
  { name: 'ARUN', category: 'Local', basePrice: 200 },
  { name: 'RAFEEK', category: 'Local', basePrice: 200 },
  { name: 'YAQOOB', category: 'Local', basePrice: 200 },
  { name: 'Vijo ms', category: 'Local', basePrice: 200 },
  { name: 'Renju tvr', category: 'Local', basePrice: 200 },
  { name: 'prasad pukkuthu', category: 'Local', basePrice: 200 },
  { name: 'shahid poolamanna', category: 'Local', basePrice: 200 },
  { name: 'jishnu kuttikadan', category: 'Local', basePrice: 200 },
  { name: 'saheer odompatta', category: 'Local', basePrice: 200 },
  { name: 'jithin chokkad', category: 'Local', basePrice: 200 },
  { name: 'monu edapetta', category: 'Local', basePrice: 200 },
  { name: 'afsal ck', category: 'Local', basePrice: 200 },
  { name: 'junu chokkad', category: 'Local', basePrice: 200 },
  { name: 'jinu chokkad', category: 'Local', basePrice: 200 },
  { name: 'jaseer chokkad', category: 'Local', basePrice: 200 },
  { name: 'abdhu chokkad', category: 'Local', basePrice: 200 },
  { name: 'athinu chokkad', category: 'Local', basePrice: 200 },
  { name: 'sajaadhchokkad', category: 'Local', basePrice: 200 },
  { name: 'sarshad chokkad', category: 'Local', basePrice: 200 },
  { name: 'unais chokkad', category: 'Local', basePrice: 200 },
  { name: 'amjad chakkala', category: 'Local', basePrice: 200 },
  { name: 'rasheed poomon', category: 'Local', basePrice: 200 },
  { name: 'amal kilikunnu', category: 'Local', basePrice: 200 },
  { name: 'haris kilikunnu', category: 'Local', basePrice: 200 },
  { name: 'Nishin', category: 'Local', basePrice: 200 },
  { name: 'favas poolamanna', category: 'Local', basePrice: 200 },
  { name: 'asaf railway', category: 'Local', basePrice: 200 },
  { name: 'siya pkd', category: 'Local', basePrice: 200 },
  { name: 'kunjippa pallipparambhu', category: 'Local', basePrice: 200 },
  { name: 'unnikrishnan', category: 'Local', basePrice: 200 },
  { name: 'dasappan', category: 'Local', basePrice: 200 },
  { name: 'christin (kili)', category: 'Local', basePrice: 200 },
  { name: 'Noushad (police)', category: 'Local', basePrice: 200 },
  { name: 'Rashad pullipadam', category: 'Local', basePrice: 200 },
  { name: 'Rasak neelanchery', category: 'Local', basePrice: 200 },
  { name: 'satheesh neelanchery', category: 'Local', basePrice: 200 },
  { name: 'rajaneesh', category: 'Local', basePrice: 200 },
  { name: 'nideesh', category: 'Local', basePrice: 200 },
  { name: 'dhileep pkd', category: 'Local', basePrice: 200 },
  { name: 'muneer pkd', category: 'Local', basePrice: 200 },
  { name: 'pranav wandoor', category: 'Local', basePrice: 200 },
  { name: 'salman pullipadam', category: 'Local', basePrice: 200 },
  { name: 'vaishnav pullipadam', category: 'Local', basePrice: 200 },
  { name: 'kunju', category: 'Local', basePrice: 200 },
  { name: 'Ansar karulai', category: 'Local', basePrice: 200 },
  { name: 'safuvan pallishery', category: 'Local', basePrice: 200 },
  { name: 'sreekuttan tvr', category: 'Local', basePrice: 200 },
  { name: 'afsal pallishery', category: 'Local', basePrice: 200 },
  { name: 'abid pallishery', category: 'Local', basePrice: 200 },
  { name: 'athul pallishery', category: 'Local', basePrice: 200 },
  { name: 'junu pallishery', category: 'Local', basePrice: 200 },
  { name: 'rafeef pallisheri', category: 'Local', basePrice: 200 },
  { name: 'ranees pallisheri', category: 'Local', basePrice: 200 },
  { name: 'vineeth police', category: 'Local', basePrice: 200 },
  { name: 'ajith neelanchery', category: 'Local', basePrice: 200 },
  { name: 'Adhil kavungal', category: 'Local', basePrice: 200 },
  { name: 'akhil kilikunnu', category: 'Local', basePrice: 200 },
  { name: 'suhaib', category: 'Local', basePrice: 200 },
  { name: 'ashith pullipadam', category: 'Local', basePrice: 200 },
  { name: 'ajith thekkunnu', category: 'Local', basePrice: 200 },
  { name: 'jameel', category: 'Local', basePrice: 200 },
  { name: 'faisel vellampuram', category: 'Local', basePrice: 200 },
  { name: 'sufaidh akkarapuram', category: 'Local', basePrice: 200 },
  { name: 'sanjay neelanchery', category: 'Local', basePrice: 200 },
  { name: 'ajith kkv', category: 'Local', basePrice: 200 },
  { name: 'nasif', category: 'Local', basePrice: 200 },
  { name: 'afsal thekkunnu', category: 'Local', basePrice: 200 },
  { name: 'ajnas', category: 'Local', basePrice: 200 },
  { name: 'ashik neelanchery', category: 'Local', basePrice: 200 },
  { name: 'anshad kaka', category: 'Local', basePrice: 200 },
  { name: 'kunjappu kannathu', category: 'Local', basePrice: 200 },
  { name: 'midhun kannath', category: 'Local', basePrice: 200 },
  { name: 'sajulesh valiyatta', category: 'Local', basePrice: 200 },
  { name: 'muneer45', category: 'Local', basePrice: 200 },
  { name: 'snehaj', category: 'Local', basePrice: 200 },
  { name: 'musafir pullipadam', category: 'Local', basePrice: 200 },
  { name: 'mahesh tvr', category: 'Local', basePrice: 200 },
  { name: 'jithu tvr', category: 'Local', basePrice: 200 },
  { name: 'dino kilikunnu', category: 'Local', basePrice: 200 },
  { name: 'thahir mash', category: 'Local', basePrice: 200 },
];

const roles = ['Batter', 'Bowler', 'All-Rounder'];

const seedPlayers = async (tournamentId) => {
  try {
    // Check if tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      console.error(`Tournament with ID ${tournamentId} not found`);
      return;
    }

    console.log(`Seeding players for tournament: ${tournament.name}`);

    let created = 0;
    let skipped = 0;

    for (const playerData of players) {
      // Check if player already exists
      // const existingPlayer = await Player.findOne({
      //   name: playerData.name,
      //   tournamentId: tournamentId,
      // });

      // if (existingPlayer) {
      //   console.log(`Player ${playerData.name} already exists, skipping...`);
      //   skipped++;
      //   continue;
      // }

      // Random role
      const role = roles[Math.floor(Math.random() * roles.length)];

      // Generate a random mobile number (10 digits)
      const mobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

      const player = new Player({
        name: playerData.name,
        mobile: mobile,
        role: role,
        category: playerData.category,
        basePrice: playerData.basePrice,
        tournamentId: tournamentId,
        image: '', // No image initially
        battingStyle: null,
        bowlingStyle: null,
      });

      await player.save();
      created++;
      console.log(`Created player: ${playerData.name} (${playerData.category}, ${role}, ₹${playerData.basePrice})`);
    }

    console.log(`\nPlayer seeding completed!`);
    console.log(`Created: ${created} players`);
    console.log(`Skipped: ${skipped} players (already exist)`);
    console.log(`Total: ${players.length} players`);
  } catch (error) {
    console.error('Error seeding players:', error);
  }
};

// Run if called directly
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();
  const connectDB = require('../config/db');

  const tournamentId = process.argv[2] || '6912c86c483dd08cf9582103';

  connectDB().then(() => {
    seedPlayers(tournamentId).then(() => {
      mongoose.connection.close();
      process.exit(0);
    });
  });
}

module.exports = seedPlayers;

