// server.js
import express from 'express';
import uploadRoutes from './routes/uploadRoutes.js'; // Import the router

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body for POST requests
app.use(express.json()); 

// 🎯 MOUNT THE ROUTER HERE: All routes in uploadRoutes.js will be prefixed with /api
app.use('/api', uploadRoutes); 

// Start the server
app.listen(PORT, () => {
  console.log(`Main Backend Server running on port ${PORT}`);
});