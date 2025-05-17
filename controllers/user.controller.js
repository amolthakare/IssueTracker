
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

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
      if (err) {
        return res.status(400).send({ error: err.message });
      }

      const { company_id, name, email, password, role } = req.body;
      
      const user = new User({
        company_id,
        name,
        email,
        password,
        role,
        avatar: req.file ? req.file.buffer.toString('base64') : null
      });

      await user.save();
      const token = await user.generateAuthToken();
      
      res.status(201).send({ user, token });
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
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