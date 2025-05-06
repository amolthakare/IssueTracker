const express = require("express");
require('dotenv').config();
const cors = require("cors");
const { connection } = require("./config/db");
const company = require('./routes/company.routes')
const authRoutes = require('./routes/user.routes')
const issueRoutes = require('./routes/issue.route');
const projectRoutes = require('./routes/project.routes');
const app = express();
app.use(express.json());
app.use(cors({origin:"*"}));
// app.get('/',(req,res)=>{
//     res.send("hello");
// })
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