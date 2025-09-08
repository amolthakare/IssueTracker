
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Company = require('../models/company.model');
const { default: mongoose } = require('mongoose');

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
        let avatarBase64 = null;
        try {
          if (req.file) {
            // Validate file type and size
            if (!req.file.mimetype.startsWith('image/')) {
              return res.status(400).json({
                success: false,
                message: {
                  error_type: 'Invalid file type',
                  error_message: 'Only image files are allowed',
                  details: {
                    provided_type: req.file.mimetype,
                    allowed_types: ['image/jpeg', 'image/png', 'image/gif']
                  }
                }
              });
            }
            
            if (req.file.size > 2 * 1024 * 1024) { // 2MB limit
              return res.status(400).json({
                success: false,
                error: 'File too large',
                message: {
                  error_type: 'File too large',
                  error_message: 'Maximum file size is 2MB',
                  details: {
                    max_size: '2MB',
                    provided_size: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`
                  }
                }
              });
            }
            
            avatarBase64 = req.file.buffer.toString('base64');
          } else {
            const defaultAvatar = fs.readFileSync(DEFAULT_AVATAR_PATH);
            avatarBase64 = defaultAvatar.toString('base64');
          }
        } catch (error) {
          console.error('Avatar processing error:', error);
          // Continue without avatar rather than failing registration
          avatarBase64 = null;
        }

        // Create new user
        const user = new User({
          company_id: company._id,
          name,
          email,
          password, // Ensure this is hashed in your User model pre-save hook
          role,
          avatar: avatarBase64
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

    // Check if company exists
    const company = await Company.findById(company_id);
    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: {
          error_type: 'Company not found',
          error_message: 'The specified company does not exist',
          details: {
            company_id: company_id
          }
        }
      });
    }

    // Get all users for the company
    const users = await User.find({ company_id })
      .select('-password -tokens') // Exclude sensitive data
      .populate('company_id', 'name company_code') // Populate company details
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({ 
      success: true,
      data: {
        company: {
          _id: company._id,
          name: company.name,
          code: company.company_code
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