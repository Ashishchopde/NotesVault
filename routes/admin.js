const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/document');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect('/admin');
  }
};

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Admin login page
router.get('/admin', (req, res) => {
  if (req.session.admin) {
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin-login', { error: null });
  }
});

// Admin login handler
router.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin-login', { error: 'Invalid password' });
  }
});

// Admin logout
router.get('/admin/logout', (req, res) => {
  req.session.admin = false;
  res.redirect('/admin');
});

// Admin dashboard
router.get('/admin/dashboard', isAuthenticated, async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 });
    res.render('admin-dashboard', { documents });
  } catch (err) {
    res.status(500).send('Error retrieving documents');
  }
});

// Admin upload page
router.get('/admin/upload', isAuthenticated, (req, res) => {
  res.render('upload');
});

// Admin upload handler
router.post('/admin/upload', isAuthenticated, upload.single('docfile'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const doc = new Document({
      title: title || req.file.originalname,
      originalName: req.file.originalname,
      filePath: path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/'),
      fileType: path.extname(req.file.originalname).toLowerCase()
    });
    await doc.save();
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Error uploading document.');
  }
});

// Delete document
router.delete('/admin/document/:id', isAuthenticated, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).send('Document not found.');
    }

    // Get absolute file path
    const filePath = path.join(__dirname, '..', doc.filePath);
    
    // Delete the file from the uploads directory
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the document from the database
    await Document.findByIdAndDelete(req.params.id);
    res.status(200).send('Document deleted successfully');
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).send('Error deleting document');
  }
});

module.exports = router; 