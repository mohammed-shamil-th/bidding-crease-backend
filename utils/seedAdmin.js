// Seed default admin on first run
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@biddingrease.com' });
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PSWD;
    if (!existingAdmin) {
      // Create default admin
      const admin = new Admin({
        email: email,
        password: password
      });
      
      await admin.save();
      console.log('Default admin created successfully');
    } else {
      console.log('Admin already exists');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;

