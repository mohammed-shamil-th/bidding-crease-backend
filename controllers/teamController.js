// Team Controller
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { isValidObjectId, isValidMobile } = require('../utils/validators');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Get all teams
const getAllTeams = async (req, res) => {
  try {
    const { tournamentId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = tournamentId ? { tournamentId } : {};
    
    const total = await Team.countDocuments(query);
    const teams = await Team.find(query)
      .populate('players', 'name role image soldPrice category')
      .populate('tournamentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: teams.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: teams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teams'
    });
  }
};

// Get single team
const getTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id)
      .populate('players')
      .populate('tournamentId');
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching team'
    });
  }
};

// Create team
const createTeam = async (req, res) => {
  try {
    const {
      name,
      owner,
      mobile,
      budget,
      tournamentId
    } = req.body;

    // Get logo from file upload if available
    const logo = req.file ? req.file.path : req.body.logo || '';

    // Validate required fields
    if (!name || !owner || !mobile || !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament ID'
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number'
      });
    }

    // Check if tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Use tournament teamBudget if budget not provided
    const teamBudget = budget !== undefined ? budget : tournament.teamBudget;

    // Capitalize each word in the name
    const capitalizeWords = (str) => {
      if (!str) return str;
      return str.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    };

    const team = new Team({
      name: capitalizeWords(name),
      logo: logo || '',
      owner,
      mobile,
      budget: teamBudget,
      remainingAmount: teamBudget,
      tournamentId
    });

    await team.save();

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating team',
      error: error.message
    });
  }
};

// Update team
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const { name, owner, mobile, budget } = req.body;

    if (name) {
      // Capitalize each word in the name
      const capitalizeWords = (str) => {
        if (!str) return str;
        return str.trim().split(/\s+/).map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      };
      team.name = capitalizeWords(name);
    }
    // Update logo if new file uploaded
    if (req.file) {
      team.logo = req.file.path;
    } else if (req.body.logo !== undefined) {
      team.logo = req.body.logo;
    }
    if (owner) team.owner = owner;
    if (mobile) {
      if (!isValidMobile(mobile)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number'
        });
      }
      team.mobile = mobile;
    }
    if (budget !== undefined) {
      team.budget = budget;
      // Recalculate remainingAmount
      await team.updateRemainingAmount();
    }

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating team',
      error: error.message
    });
  }
};

// Delete team
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if team has players
    if (team.players.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete team with players. Remove players first.'
      });
    }

    await Team.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting team'
    });
  }
};

// Helper to format currency consistently
const formatCurrency = (amount = 0) => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  } catch (error) {
    return `₹${amount || 0}`;
  }
};

// Download teams PDF report
const downloadTeamsReport = async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId || !isValidObjectId(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tournament ID is required'
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const teams = await Team.find({ tournamentId })
      .populate({
        path: 'players',
        select: 'name role category basePrice soldPrice soldTo wasAuctioned',
        populate: {
          path: 'soldTo',
          select: 'name'
        }
      })
      .sort({ name: 1 });

    const fileName = `biddingcrease-team-report-${tournament.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Branding header
    const appName = 'BiddingCrease';
    const logoPath = path.resolve(__dirname, '..', '..', 'frontend', 'app', 'icon.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 60, height: 60 });
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#0f172a')
      .text(appName, 120, 50);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#475569')
      .text('Official Auction Team Summary', 120, 78);

    doc.moveDown(2);
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#0f172a')
      .text(`Tournament: ${tournament.name}`);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#475569')
      .text(`Status: ${tournament.status}`);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#475569')
      .text(`Auction Date: ${tournament.auctionDate ? new Date(tournament.auctionDate).toLocaleDateString('en-IN') : 'N/A'}`);

    doc.moveDown(1.5);

    if (!teams.length) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#64748b')
        .text('No teams have been registered for this tournament yet.');
      doc.end();
      return;
    }

    teams.forEach((team, index) => {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#0f172a')
        .text(`${index + 1}. ${team.name}`);
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#1f2937')
        .text(`Owner: ${team.owner || 'N/A'}`)
        .text(`Contact: ${team.mobile || 'N/A'}`)
        .text(`Budget: ${formatCurrency(team.budget || tournament.teamBudget)}`)
        .text(`Remaining Amount: ${formatCurrency(team.remainingAmount || 0)}`);

      doc.moveDown(0.5);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#0f172a')
        .text(`Players (${team.players.length})`);
      doc.moveDown(0.2);

      if (!team.players.length) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(10)
          .fillColor('#64748b')
          .text('No players assigned yet.');
      } else {
        team.players.forEach((player) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
          }

          const statusText = player.soldPrice
            ? `Sold for ${formatCurrency(player.soldPrice)} to ${player.soldTo?.name || 'N/A'}`
            : player.wasAuctioned
            ? `Unsold (Base: ${formatCurrency(player.basePrice || 0)})`
            : `Not auctioned yet (Base: ${formatCurrency(player.basePrice || 0)})`;

          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#334155')
            .text(`• ${player.name} (${player.role || 'Role N/A'} • ${player.category || 'Category'})`);
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748b')
            .text(`  ${statusText}`);
          doc.moveDown(0.2);
        });
      }

      doc.moveDown(1);
    });

    doc.end();
  } catch (error) {
    console.error('Download teams report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating teams report'
      });
    } else {
      res.end();
    }
  }
};

const downloadTeamReport = async (req, res) => {
  try {
    const { id } = req.params;
    const includePrices = req.query.includePrices === 'true';

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID'
      });
    }

    const team = await Team.findById(id)
      .populate({
        path: 'players',
        select: 'name role category basePrice soldPrice wasAuctioned',
        populate: {
          path: 'soldTo',
          select: 'name'
        }
      })
      .populate('tournamentId', 'name status auctionDate');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const fileName = `biddingcrease-${team.name.replace(/\s+/g, '-').toLowerCase()}-players.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const appName = 'BiddingCrease';
    const logoPath = path.resolve(__dirname, '..', '..', 'frontend', 'app', 'icon.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 60, height: 60 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#0f172a')
      .text(appName, 120, 50);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#475569')
      .text('Team Player Report', 120, 78);

    doc.moveDown(2);
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#0f172a')
      .text(team.name);
    doc
      .moveTo(doc.x, doc.y + 2)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
      .stroke('#cbd5f5');
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#475569')
      .text(`Owner: ${team.owner || 'N/A'}`)
      .text(`Tournament: ${team.tournamentId?.name || 'N/A'}`)
      .text(`Status: ${team.tournamentId?.status || 'N/A'}`)
      .text(
        `Auction Date: ${
          team.tournamentId?.auctionDate
            ? new Date(team.tournamentId.auctionDate).toLocaleDateString('en-IN')
            : 'N/A'
        }`
      );

    doc.moveDown(1.5);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#0f172a')
      .text('Squad');
    doc.moveDown(0.5);

    if (!team.players.length) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#64748b')
        .text('No players have been added to this team yet.');
    } else {
      team.players.forEach((player, index) => {
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#0f172a')
          .text(`${index + 1}. ${player.name}`);
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#475569')
          .text(`Role: ${player.role || 'N/A'} • Category: ${player.category || 'N/A'}`);

        if (includePrices) {
          const basePrice = formatCurrency(player.basePrice || 0);
          const soldPrice = player.soldPrice
            ? formatCurrency(player.soldPrice)
            : player.wasAuctioned
            ? 'Unsold'
            : 'Not auctioned yet';
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#64748b')
            .text(`Base Price: ${basePrice} | Sold Price: ${soldPrice}`);
        }

        doc.moveDown(0.6);
      });
    }

    if (includePrices) {
      const totalSpent = team.players.reduce(
        (sum, player) => sum + (player.soldPrice || 0),
        0
      );
      const totalRemaining = team.remainingAmount || 0;

      doc.moveDown(1);
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#0f172a')
        .text('Financial Summary');
      doc.moveDown(0.4);
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#0f172a')
        .text(`Total Auctioned Amount: ${formatCurrency(totalSpent)}`)
        .text(`Remaining Balance: ${formatCurrency(totalRemaining)}`)
        .text(`Initial Budget: ${formatCurrency(team.budget || 0)}`);
    }

    doc.end();
  } catch (error) {
    console.error('Download team report error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating team report'
      });
    } else {
      res.end();
    }
  }
};

module.exports = {
  getAllTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  downloadTeamsReport,
  downloadTeamReport
};

