// Seed default admin on first run
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@biddingrease.com' });
    
    if (!existingAdmin) {
      // Create default admin
      const admin = new Admin({
        email: 'admin@biddingrease.com',
        password: 'biddingcrease2025.'
      });
      
      await admin.save();
      console.log('Default admin created successfully');
      console.log('Email: admin@biddingrease.com');
      console.log('Password: biddingcrease2025.');
    } else {
      console.log('Admin already exists');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;

