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
      .populate('players', 'name role image soldPrice basePrice wasAuctioned categoryId')
      .populate('tournamentId', 'name categories')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Attach category name to each player based on tournament categories
    const mappedTeams = teams.map((teamDoc) => {
      const team = teamDoc.toObject();

      if (
        team.tournamentId &&
        Array.isArray(team.tournamentId.categories) &&
        Array.isArray(team.players)
      ) {
        const categories = team.tournamentId.categories;
        team.players = team.players.map((player) => {
          if (player.categoryId) {
            const matchedCategory = categories.find(
              (cat) =>
                cat._id &&
                cat._id.toString() === player.categoryId.toString()
            );

            if (matchedCategory && matchedCategory.name) {
              return { ...player, category: matchedCategory.name };
            }
          }
          return player;
        });
      }

      return team;
    });
    
    res.status(200).json({
      success: true,
      count: mappedTeams.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: mappedTeams
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

    const teamDoc = await Team.findById(id)
      .populate('players')
      .populate('tournamentId', 'name categories');
    
    if (!teamDoc) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const team = teamDoc.toObject();

    // Attach category name to each player based on tournament categories
    if (
      team.tournamentId &&
      Array.isArray(team.tournamentId.categories) &&
      Array.isArray(team.players)
    ) {
      const categories = team.tournamentId.categories;
      team.players = team.players.map((player) => {
        if (player.categoryId) {
          const matchedCategory = categories.find(
            (cat) =>
              cat._id &&
              cat._id.toString() === player.categoryId.toString()
          );

          if (matchedCategory && matchedCategory.name) {
            return { 
              ...player, 
              category: matchedCategory.name,
              basePrice: matchedCategory.basePrice || 0
            };
          }
        }
        return player;
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

// ==============================
// CURRENCY FORMATTER
// ==============================
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

// ==============================
// PDF HELPER FUNCTIONS
// ==============================
const HEADER_FONT = "Helvetica-Bold";
const NORMAL_FONT = "Helvetica";
const LIGHT_FONT = "Helvetica-Oblique";

const addBrandHeader = (doc, title, subtitle) => {
  const logoPath = path.resolve(__dirname, "..", "..", "frontend", "app", "icon.png");

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 40, { width: 60 });
  }

  doc
    .font(HEADER_FONT)
    .fontSize(24)
    .fillColor("#0f172a")
    .text("BiddingCrease", 120, 50);

  doc
    .font(NORMAL_FONT)
    .fontSize(12)
    .fillColor("#475569")
    .text(title, 120, 78);

  if (subtitle) {
    doc
      .font(NORMAL_FONT)
      .fontSize(11)
      .fillColor("#64748b")
      .text(subtitle, 120, 95);
  }

  doc.moveDown(2);
};

const sectionTitle = (doc, title) => {
  doc
    .font(HEADER_FONT)
    .fontSize(16)
    .fillColor("#0f172a")
    .text(title);

  doc
    .moveTo(50, doc.y + 2)
    .lineTo(doc.page.width - 50, doc.y + 2)
    .stroke("#cbd5e1");

  doc.moveDown(1);
};

const safePageBreak = (doc, threshold = 120) => {
  if (doc.y > doc.page.height - threshold) doc.addPage();
};

// ==============================
// DOWNLOAD ALL TEAMS REPORT
// ==============================
const downloadTeamsReport = async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId || !isValidObjectId(tournamentId)) {
      return res.status(400).json({ success: false, message: "Valid tournament ID is required" });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const teams = await Team.find({ tournamentId })
      .populate({
        path: "players",
        select: "name role category basePrice soldPrice soldTo wasAuctioned",
        populate: { path: "soldTo", select: "name" }
      })
      .sort({ name: 1 });

    const fileName = `biddingcrease-team-report-${tournament.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // HEADER
    addBrandHeader(doc, "Official Auction Team Summary");

    // TOURNAMENT INFO
    sectionTitle(doc, "Tournament Details");
    doc
      .font(NORMAL_FONT)
      .fontSize(12)
      .fillColor("#475569")
      .text(`Name: ${tournament.name}`)
      .text(`Status: ${tournament.status}`)
      .text(
        `Auction Date: ${
          tournament.auctionDate
            ? new Date(tournament.auctionDate).toLocaleDateString("en-IN")
            : "N/A"
        }`
      );

    doc.moveDown(1);

    if (!teams.length) {
      doc
        .font(LIGHT_FONT)
        .fontSize(12)
        .fillColor("#64748b")
        .text("No teams have been registered yet.");
      doc.end();
      return;
    }

    // TEAMS LIST
    teams.forEach((team, index) => {
      safePageBreak(doc);

      sectionTitle(doc, `${index + 1}. ${team.name}`);

      doc
        .font(NORMAL_FONT)
        .fontSize(11)
        .fillColor("#1f2937")
        .text(`Owner: ${team.owner || "N/A"}`)
        .text(`Contact: ${team.mobile || "N/A"}`)
        .text(`Budget: ${formatCurrency(team.budget || tournament.teamBudget)}`)
        .text(`Remaining Amount: ${formatCurrency(team.remainingAmount || 0)}`);

      doc.moveDown(0.8);

      doc
        .font(HEADER_FONT)
        .fontSize(12)
        .fillColor("#0f172a")
        .text(`Players (${team.players.length})`);

      doc.moveDown(0.5);

      if (!team.players.length) {
        doc
          .font(LIGHT_FONT)
          .fontSize(10)
          .fillColor("#64748b")
          .text("No players assigned.");
      } else {
        team.players.forEach((player) => {
          safePageBreak(doc);

          const statusText = player.soldPrice
            ? `Sold for ${formatCurrency(player.soldPrice)} to ${player.soldTo?.name || "N/A"}`
            : player.wasAuctioned
            ? `Unsold (Base: ${formatCurrency(player.basePrice)})`
            : `Not auctioned yet (Base: ${formatCurrency(player.basePrice)})`;

          doc
            .font(NORMAL_FONT)
            .fontSize(11)
            .fillColor("#334155")
            .text(`• ${player.name} (${player.role || "Role N/A"} • ${player.category})`);
          doc
            .font(NORMAL_FONT)
            .fontSize(10)
            .fillColor("#64748b")
            .text(`  ${statusText}`);

          doc.moveDown(0.3);
        });
      }

      doc.moveDown(1);
    });

    doc.end();
  } catch (error) {
    console.error("Download teams report error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Error generating teams report" });
    } else res.end();
  }
};

// ==============================
// DOWNLOAD SINGLE TEAM REPORT
// ==============================
// Helper function to get role icon
const getRoleIcon = (role) => {
  switch (role) {
    case 'Batter':
      return '🏏'; // Bat icon
    case 'Bowler':
      return '⚫'; // Ball icon
    case 'All-Rounder':
      return '🏏⚫'; // Bat and ball
    case 'Wicketkeeper':
    case 'Keeper':
      return '🧤'; // Keeper glove
    default:
      return '•';
  }
};

// Helper function to get basePrice from category
const getPlayerBasePriceFromCategory = (player, tournament) => {
  if (!player || !player.categoryId || !tournament || !Array.isArray(tournament.categories)) {
    return 0;
  }
  const category = tournament.categories.id(player.categoryId);
  return category ? (category.basePrice || 0) : 0;
};

const downloadTeamReport = async (req, res) => {
  try {
    const { id } = req.params;
    const includePrices = req.query.includePrices === "true";

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const team = await Team.findById(id)
      .populate({
        path: "players",
        select: "name role categoryId soldPrice wasAuctioned",
        populate: { path: "soldTo", select: "name" }
      })
      .populate("tournamentId", "name status auctionDate categories");

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const tournament = team.tournamentId;
    
    // Resolve category names for players
    const playersWithCategories = team.players.map(player => {
      const playerObj = player.toObject ? player.toObject() : player;
      let categoryName = '';
      if (playerObj.categoryId && tournament && Array.isArray(tournament.categories)) {
        const category = tournament.categories.id(playerObj.categoryId);
        if (category) {
          categoryName = category.name || '';
        }
      }
      return { ...playerObj, category: categoryName };
    });

    const fileName = `biddingcrease-${team.name.replace(/\s+/g, "-").toLowerCase()}-players.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // TOURNAMENT HEADER (centered, large, bold)
    doc
      .font(HEADER_FONT)
      .fontSize(28)
      .fillColor("#0f172a")
      .text(tournament?.name || "Tournament", {
        align: "center",
        y: 50
      });

    doc.y = 90;

    // TEAM LOGO AND NAME
    const teamLogoPath = team.logo ? path.resolve(__dirname, "..", "..", team.logo) : null;
    const logoExists = teamLogoPath && fs.existsSync(teamLogoPath);
    
    if (logoExists) {
      try {
        doc.image(teamLogoPath, doc.page.width / 2 - 40, doc.y, { width: 80, height: 80, align: "center" });
        doc.y += 100;
      } catch (err) {
        console.error("Error loading team logo:", err);
        doc.y += 20;
      }
    } else {
      doc.y += 20;
    }

    // Team name (centered, below logo)
    doc
      .font(HEADER_FONT)
      .fontSize(20)
      .fillColor("#1e293b")
      .text(team.name, {
        align: "center"
      });

    doc.moveDown(1.5);

    // PLAYER LIST
    if (!playersWithCategories.length) {
      doc
        .font(LIGHT_FONT)
        .fontSize(12)
        .fillColor("#64748b")
        .text("No players added.", { align: "center" });
    } else {
      playersWithCategories.forEach((player, idx) => {
        safePageBreak(doc, 80);

        // Role icon
        const roleIcon = getRoleIcon(player.role);
        doc
          .font(NORMAL_FONT)
          .fontSize(14)
          .fillColor("#475569")
          .text(roleIcon, { continued: true });

        // Player name with split colors
        const nameParts = player.name.split(' ');
        const firstName = nameParts[0] || '';
        const restName = nameParts.slice(1).join(' ') || '';

        // First part (before space) - blue color
        doc
          .font(HEADER_FONT)
          .fontSize(14)
          .fillColor("#1e40af")
          .text(` ${firstName}`, { continued: true });

        // Rest of name - different color (dark gray)
        if (restName) {
          doc
            .font(HEADER_FONT)
            .fontSize(14)
            .fillColor("#374151")
            .text(` ${restName}`);
        } else {
          doc.text(''); // New line if no rest name
        }

        // Price information (if requested)
        if (includePrices) {
          const basePrice = getPlayerBasePriceFromCategory(player, tournament);
          const base = formatCurrency(basePrice);
          const sold = player.soldPrice
            ? formatCurrency(player.soldPrice)
            : player.wasAuctioned
            ? "Unsold"
            : "Not auctioned";

          doc
            .font(NORMAL_FONT)
            .fontSize(10)
            .fillColor("#64748b")
            .text(`  Base: ${base} | Sold: ${sold}`, { indent: 20 });
        }

        doc.moveDown(0.4);
      });
    }

    // FOOTER - App name and logo
    const footerY = doc.page.height - 80;
    const logoPath = path.resolve(__dirname, "..", "..", "frontend", "app", "icon.png");
    
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, doc.page.width / 2 - 30, footerY, { width: 60, height: 60 });
      } catch (err) {
        console.error("Error loading app logo:", err);
      }
    }

    doc
      .font(HEADER_FONT)
      .fontSize(16)
      .fillColor("#0f172a")
      .text("BiddingCrease", {
        align: "center",
        y: footerY + 70
      });

    doc.end();
  } catch (error) {
    console.error("Download team report error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Error generating team report" });
    } else res.end();
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

