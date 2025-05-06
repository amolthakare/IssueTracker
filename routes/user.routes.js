const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/user.model');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 1000000 // 1MB limit
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error('Please upload an image (jpg, jpeg, or png)'));
    }
    cb(null, true);
  }
});

// Register new user
router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { company_id, first_name, last_name, email, password, role } = req.body;
    
    const user = new User({
      company_id,
      first_name,
      last_name,
      email,
      password,
      role,
      avatar: req.file ? req.file.buffer.toString('base64') : null
    });

    await user.save();
    const token = await user.generateAuthToken();
    
    res.status(201).send({ user, token });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error('Unable to login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Unable to login');
    }

    const token = await user.generateAuthToken();
    res.send({ user, token });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  res.send(req.user);
});

// Logout user
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
    await req.user.save();
    res.send();
  } catch (error) {
    res.status(500).send();
  }
});

module.exports = router;