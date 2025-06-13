const express = require('express');
const router = express.Router();
const {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyByCode,
  updateCompany,
  deleteCompany
} = require('../controllers/company.controller');

// Create a new company
router.post('/', createCompany);

// Get all companies
router.get('/', getAllCompanies);

// Get a specific company by ID
router.get('/:id', getCompanyById);

// Get a specific company by CODE (new route)
router.get('/code/:code', getCompanyByCode);

// Update a company by ID
router.patch('/:id', updateCompany);

// Delete a company by ID
router.delete('/:id', deleteCompany);

module.exports = router;