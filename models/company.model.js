const mongoose = require('mongoose');

const generateCompanyCode = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding easily confused chars
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  company_code: {
    type: String,
    unique: true,
    default: generateCompanyCode,
    index: true
  }
}, {
  timestamps: true
});

// Pre-save hook to ensure unique company_code
companySchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  let isUnique = false;
  while (!isUnique) {
    try {
      const existingCompany = await this.constructor.findOne({ company_code: this.company_code });
      if (!existingCompany) {
        isUnique = true;
      } else {
        this.company_code = generateCompanyCode();
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const Company = mongoose.model('Company', companySchema);

module.exports = Company;