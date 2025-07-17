const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const multer = require('multer');
const fs = require('fs');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Ensure NODE_ENV is set to production in production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Trust proxy for Render/Heroku
app.set('trust proxy', 1);

// Check required environment variables
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}
if (!process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required');
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Session middleware
app.use(session({
  secret: 'your-secret-key', // Change this to a secure secret in production
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Set up EJS for templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Increase timeout for file uploads
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// Serve static files from public directory
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/', documentRoutes);
app.use('/', adminRoutes);

// About page route
app.get('/about', (req, res) => {
  res.render('about');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
