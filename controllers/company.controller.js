// controllers/company.controller.js
const Company = require('../models/company.model');

const createCompany = async (req, res) => {
  try {
    const company = new Company(req.body);
    await company.save();
    res.status(201).send({
      ...company.toObject(),
      // Include the company_code in the response
      company_code: company.company_code
    });
  } catch (error) {
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