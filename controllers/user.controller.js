
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Company = require('../models/company.model');
const { default: mongoose } = require('mongoose');

const DEFAULT_AVATAR_PATH = path.join(__dirname, '../assets/user.png');

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
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
      try {
        // Handle upload errors
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'File upload error',
              error_message: `File upload failed: ${err.message}`,
              details: {
                code: err.code,
                field: err.field
              }
            }
          });
        } else if (err) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'File upload failed',
              error_message: 'File upload failed',
              details: err.message
            }
          });
        }

        // Validate required fields
        const requiredFields = ['company_code', 'name', 'email', 'password', 'role'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'missing fields',
              error_message: 'Required fields are missing',
              details: {
                missing_fields: missingFields,
                required_fields: requiredFields
              }
            }
          });
        }

        const { company_code, name, email, password, role } = req.body;

        // First, find the company by its code
        const company = await Company.findOne({ company_code });
        if (!company) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'Invalid company code',
              error_message: 'The provided company code is invalid',
              details: {
                provided_code: company_code
              }
            }
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'Invalid email address',
              error_message: 'Please provide a valid email address',
              details: {
                provided_email: email
              }
            }
          });
        }

        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ 
            success: false,
            message: {
              error_type: 'Email already exists',
              error_message: 'This email is already registered',
              details: {
                existing_email: email
              }
            }
          });
        }

        // Validate password complexity
        if (password.length < 8) {
          return res.status(400).json({ 
            success: false,
            message: {
              error_type: 'Password too short',
              error_message: 'Password must be at least 8 characters',
              details: {
                min_length: 8,
                provided_length: password.length
              }
            }
          });
        }

        // Handle avatar processing
        let avatarPath = null;
        try {
          if (req.file) {
            avatarPath = `uploads/avatars/${req.file.filename}`;
          } else {
            // Use a default path or leave as null (fallback in frontend)
            avatarPath = 'uploads/avatars/default-avatar.png';
            
            // Ensure default avatar exists if we reference it
            const defaultSource = DEFAULT_AVATAR_PATH;
            const defaultDest = path.join(__dirname, '../uploads/avatars/default-avatar.png');
            if (fs.existsSync(defaultSource) && !fs.existsSync(defaultDest)) {
              fs.copyFileSync(defaultSource, defaultDest);
            }
          }
        } catch (error) {
          console.error('Avatar processing error:', error);
          avatarPath = null;
        }

        // Create new user
        const user = new User({
          company_id: company._id,
          name,
          email,
          password, 
          role,
          avatar: avatarPath
        });

        await user.save();
        const token = await user.generateAuthToken();
        
        // Omit sensitive data from response
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.tokens;
        
        res.status(201).json({ 
          success: true,
          user: userResponse,
          token,
          company: {
            name: company.name,
            code: company.company_code
          }
        });

      } catch (error) {
        console.error('Registration processing error:', error);
        res.status(500).json({ 
          success: false,
          message: {
            error_type: 'Registration failed',
            error_message: 'An unexpected error occurred during registration',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        });
      }
    });
  } catch (error) {
    console.error('Registration endpoint error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Server error',
        error_message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const login = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['email', 'password'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Missing fields',
          error_message: 'Required fields are missing',
          details: {
            missing_fields: missingFields,
            required_fields: requiredFields
          }
        }
      });
    }

    const { email, password } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Invalid email address',
          error_message: 'Please provide a valid email address',
          details: {
            provided_email: email
          }
        }
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: {
          error_type: 'Authentication failed',
          error_message: 'Invalid login credentials',
          details: {
            provided_email: email,
            suggestion: 'Check your email or register if you don\'t have an account'
          }
        }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: {
          error_type: 'Authentication failed',
          error_message: 'Invalid login credentials',
          details: {
            suggestion: 'Check your password or use password reset if forgotten'
          }
        }
      });
    }

    const token = await user.generateAuthToken();
    
    // Omit sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.tokens;
    
    res.status(200).json({ 
      success: true,
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Login failed',
        error_message: 'An unexpected error occurred during login',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const getProfile = async (req, res) => {
  try {
    // Omit sensitive data from response
    const userResponse = req.user.toObject();
    delete userResponse.password;
    delete userResponse.tokens;
    
    res.status(200).json({ 
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Profile retrieval failed',
        error_message: 'An unexpected error occurred while fetching your profile',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const logout = async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
    await req.user.save();
    
    res.status(200).json({ 
      success: true,
      message: {
        info_type: 'Logout successful',
        info_message: 'You have been successfully logged out',
        details: {
          logout_time: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Logout failed',
        error_message: 'An unexpected error occurred during logout',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

const getAllUsersByCompany = async (req, res) => {
  try {
    const { company_id } = req.params;

    // Validate company_id format
    if (!mongoose.Types.ObjectId.isValid(company_id)) {
      return res.status(400).json({ 
        success: false,
        message: {
          error_type: 'Invalid company ID',
          error_message: 'The provided company ID is not valid',
          details: {
            provided_id: company_id
          }
        }
      });
    }

    // Check if company exists - logging for diagnostics
    const company = await Company.findById(company_id);
    if (!company) {
      console.warn(`Company with ID ${company_id} not found in database, but proceeding to fetch users associated with this ID.`);
      // Instead of failing with 404, we'll try to get users. 
      // This helps if the company record was deleted but users still exist with that ID.
    }

    // Get all users for the company
    const users = await User.find({ company_id })
      .select('-password -tokens') // Exclude sensitive data
      .populate('company_id', 'name company_code') // Populate company details (might be null if company missing)
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({ 
      success: true,
      data: {
        company: company ? {
          _id: company._id,
          name: company.name,
          code: company.company_code
        } : {
          _id: company_id,
          name: 'Unknown Company',
          code: 'N/A'
        },
        users: users,
        count: users.length
      }
    });

  } catch (error) {
    console.error('Get users by company error:', error);
    res.status(500).json({ 
      success: false,
      message: {
        error_type: 'Server error',
        error_message: 'An unexpected error occurred while fetching users',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout,
  getAllUsersByCompany
};