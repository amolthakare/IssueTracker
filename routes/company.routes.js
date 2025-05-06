// routes/companyRoutes.js
const express = require('express');
const router = express.Router();
const Company = require('../models/company.model');
const auth = require("../middleware/auth");
// router.use(auth);
// Create a new company
router.post('/', async (req, res) => {
  try {
    const company = new Company(req.body);
    // console.log(req.body);
    await company.save();
    res.status(201).send(company);
  } catch (error) {
    console.log(error);
    res.status(400).send(error);
  }
});

// Get all companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find({});
    res.send(companies);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get a specific company by ID
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send();
    }
    res.send(company);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Update a company by ID
router.patch('/:id', async (req, res) => {
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
});

// Delete a company by ID
router.delete('/:id', async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    
    if (!company) {
      return res.status(404).send();
    }

    res.send(company);
  } catch (error) {
    res.status(500).send(error);
  }
});

module.exports = router;