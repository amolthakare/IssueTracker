// routes/company.routes.js
const express = require('express');
const router = express.Router();
const {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
} = require('../controllers/company.controller');

// Create a new company
router.post('/', createCompany);

// Get all companies
router.get('/', getAllCompanies);

// Get a specific company by ID
router.get('/:id', getCompanyById);

// Update a company by ID
router.patch('/:id', updateCompany);

// Delete a company by ID
router.delete('/:id', deleteCompany);

module.exports = router;