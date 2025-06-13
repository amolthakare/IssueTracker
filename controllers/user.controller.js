
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Company = require('../models/company.model');

const DEFAULT_AVATAR_PATH = path.join(__dirname, '../assets/user.png');

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
}).single('avatar');

const register = async (req, res) => {
  try {
    upload(req, res, async function(err) {
      // Handle upload errors
      if (err instanceof multer.MulterError) {
        return res.status(400).send({ error: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).send({ error: err.message });
      }

      // Validate required fields
      const { company_code, name, email, password, role } = req.body;
      
      if (!company_code || !name || !email || !password || !role) {
        return res.status(400).send({ error: 'All fields are required' });
      }

      // First, find the company by its code
      const company = await Company.findOne({ company_code });
      if (!company) {
        return res.status(400).send({ error: 'Invalid company code' });
      }

      // Validate email format
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).send({ error: 'Invalid email format' });
      }

      // Check for existing user
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).send({ error: 'Email already in use' });
      }

      // Validate password complexity
      if (password.length < 8) {
        return res.status(400).send({ error: 'Password must be at least 8 characters' });
      }

      let avatarBase64 = null;
      
      try {
        if (req.file) {
          avatarBase64 = req.file.buffer.toString('base64');
        } else {
          const defaultAvatar = fs.readFileSync(DEFAULT_AVATAR_PATH);
          avatarBase64 = defaultAvatar.toString('base64');
        }
      } catch (error) {
        console.error('Avatar processing error:', error);
        avatarBase64 = null;
      }

      // Create new user with company's ObjectId
      const user = new User({
        company_id: company._id, // Store the company's ObjectId
        name,
        email,
        password,
        role,
        avatar: avatarBase64
      });

      await user.save();
      const token = await user.generateAuthToken();
      
      res.status(201).send({ 
        user,
        token,
        company_details: { // Optionally include some company details in response
          name: company.name,
          company_code: company.company_code
        }
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send({ error: 'Internal server error during registration' });
  }
};

const login = async (req, res) => {
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
};

const getProfile = async (req, res) => {
  res.send(req.user);
};

const logout = async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
    await req.user.save();
    res.send();
  } catch (error) {
    res.status(500).send();
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout
};