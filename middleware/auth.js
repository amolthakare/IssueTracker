const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    // Verify token
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // If token is expired, remove it from the user's tokens array
      if (err.name === 'TokenExpiredError') {
        const decodedExpired = jwt.decode(token);
        await User.updateOne(
          { _id: decodedExpired._id },
          { $pull: { tokens: { token } } }
        );
      }
      throw new Error('Invalid or expired token');
    }
     console.log("midd>auth> Verify token",decoded);
    // Find user with valid token
    const user = await User.findOne({ 
      _id: decoded._id,
      'tokens.token': token
    });

    // console.log("midd>auth>Find user with valid token",user);

    if (!user) {
      throw new Error('User not found');
    }

    // Attach user and token to request
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ 
      error: 'Please authenticate',
      message: error.message
    });
  }
};