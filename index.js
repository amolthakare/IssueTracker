const express = require("express");
require('dotenv').config();
const cors = require("cors");
const { connection } = require("./config/db");
const company = require('./routes/company.routes')
const authRoutes = require('./routes/user.routes')
const issueRoutes = require('./routes/issue.route');
const projectRoutes = require('./routes/project.routes');
const cron = require('node-cron');
const User = require("./models/user.model");
const app = express();
app.use(express.json());
app.use(cors({origin:"*"}));
// app.get('/',(req,res)=>{
//     res.send("hello");
// })

// Add a scheduled task to periodically clean up expired tokens:
// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const users = await User.find({ 'tokens.0': { $exists: true } });
    
    for (const user of users) {
      const validTokens = [];
      
      for (const tokenObj of user.tokens) {
        try {
          jwt.verify(tokenObj.token, process.env.JWT_SECRET);
          validTokens.push(tokenObj);
        } catch (err) {
          if (err.name !== 'TokenExpiredError') {
            validTokens.push(tokenObj); // Keep tokens with other errors
          }
        }
      }
      
      if (validTokens.length !== user.tokens.length) {
        user.tokens = validTokens;
        await user.save();
      }
    }
    
    console.log('Token cleanup completed');
  } catch (err) {
    console.error('Token cleanup error:', err);
  }
});
app.use('/auth', authRoutes);
app.use('/companies', company);
app.use('/issues', issueRoutes);
app.use('/projects', projectRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    res.status(400).send({ error: err.message });
  });

app.listen(process.env.port, async()=>{
    try{
        await connection
        console.log("Connected to mongoDB");
    }
    catch(err){
        console.log(err)
    }
    console.log(`listening to port ${process.env.port}`)
})