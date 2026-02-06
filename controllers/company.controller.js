// controllers/company.controller.js
const Company = require('../models/company.model');

const createCompany = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Check if company with this email already exists
    if (email) {
      const existingCompany = await Company.findOne({ email });
      if (existingCompany) {
        return res.status(201).send({
          ...existingCompany.toObject(),
          company_code: existingCompany.company_code
        });
      }
    }

    const company = new Company({
      name: name || 'Default Company',
      email: email || `comp-${Date.now()}@example.com`
    });
    
    await company.save();
    res.status(201).send({
      ...company.toObject(),
      company_code: company.company_code
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(400).send(error);
  }
};

// Add this new method to get company by code
const getCompanyByCode = async (req, res) => {
  try {
    const company = await Company.findOne({ company_code: req.params.code });
    if (!company) {
      return res.status(404).send({ error: 'Company not found' });
    }
    res.send(company);
  } catch (error) {
    res.status(500).send(error);
  }
};

const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find({});
    res.send(companies);
  } catch (error) {
    res.status(500).send(error);
  }
};

const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send();
    }
    res.send(company);
  } catch (error) {
    res.status(500).send(error);
  }
};

const updateCompany = async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'email'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { 
      new: true, 
      runValidators: true 
    });

    if (!company) {
      return res.status(404).send();
    }

    res.send(company);
  } catch (error) {
    res.status(400).send(error);
  }
};

const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    
    if (!company) {
      return res.status(404).send();
    }

    res.send(company);
  } catch (error) {
    res.status(500).send(error);
  }
};

module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyByCode
};