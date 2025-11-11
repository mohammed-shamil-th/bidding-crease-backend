// Validation utilities
const mongoose = require('mongoose');

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate mobile number (basic)
const isValidMobile = (mobile) => {
  const mobileRegex = /^[0-9]{10,15}$/;
  return mobileRegex.test(mobile);
};

module.exports = {
  isValidObjectId,
  isValidEmail,
  isValidMobile
};

