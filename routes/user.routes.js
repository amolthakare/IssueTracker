// routes/user.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  logout,
  getAllUsersByCompany
} = require('../controllers/user.controller');

// Register new user
router.post('/register', register);

// Login user
router.post('/login', login);

// Get current user profile
router.get('/me', auth, getProfile);

// Logout user
router.post('/logout', auth, logout);

// Get all users by company ID
router.get('/company/:company_id', auth, getAllUsersByCompany);

module.exports = router;