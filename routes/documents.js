const express = require('express');
const router = express.Router();
const multer  = require('multer');
const path = require('path');
const mammoth = require('mammoth');
const Document = require('../models/document');
const fs = require('fs');

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    // Use Date.now() to get unique file names
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Home route: List all uploaded documents in Bootstrap cards.
router.get('/', async (req, res) => {
  try {
    const docs = await Document.find().sort({ uploadedAt: -1 });
    res.render('index', { documents: docs });
  } catch (err) {
    res.status(500).send('Error retrieving documents');
  }
});

// GET Upload Form
router.get('/upload', (req, res) => {
  res.render('upload');
});

// POST Upload DOCX file
router.post('/upload', upload.single('docfile'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    const doc = new Document({
      title: title || req.file.originalname,
      originalName: req.file.originalname,
      filePath: req.file.path.replace(/\\/g, '/'), // Convert backslashes to forward slashes
      fileType: path.extname(req.file.originalname).toLowerCase()
    });
    await doc.save();
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error uploading document.');
  }
});

// Delete document
router.delete('/document/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).send('Document not found.');
    }

    // Delete the file from the uploads directory
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    // Delete the document from the database
    await Document.findByIdAndDelete(req.params.id);
    res.status(200).send('Document deleted successfully');
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).send('Error deleting document');
  }
});

// View full DOCX document (converted to HTML)
router.get('/document/:id', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) {
        return res.render('document', {
          title: 'Document Not Found',
          error: 'Document not found.',
          isPdf: false
        });
      }
  
      console.log('Document found:', doc);
      console.log('File path:', doc.filePath);
      console.log('File type:', doc.fileType);

      // Fix file path for Windows
      const filePath = path.resolve(doc.filePath.replace(/\//g, path.sep));
      console.log('Resolved file path:', filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('File not found at path:', filePath);
        return res.render('document', {
          title: doc.title,
          error: 'File not found on server.',
          isPdf: false
        });
      }
  
      if (doc.fileType === '.docx') {
        try {
          // Convert DOCX to HTML using Mammoth
          const result = await mammoth.convertToHtml({ path: filePath });
          const html = result.value;
          console.log('Conversion successful');
          res.render('document', { 
            title: doc.title, 
            htmlContent: html, 
            isPdf: false,
            error: null
          });
        } catch (conversionError) {
          console.error('Conversion error:', conversionError);
          res.render('document', {
            title: doc.title,
            error: 'Error converting document: ' + conversionError.message,
            isPdf: false
          });
        }
      } else if (doc.fileType === '.pdf') {
        // If it's a PDF, use the correct URL path
        const pdfUrl = '/uploads/' + path.basename(doc.filePath);
        console.log('PDF URL:', pdfUrl);
        res.render('document', { 
          title: doc.title, 
          pdfLink: pdfUrl, 
          isPdf: true,
          error: null
        });
      } else {
        res.render('document', {
          title: doc.title,
          error: 'Unsupported file type: ' + doc.fileType,
          isPdf: false
        });
      }
    } catch (err) {
      console.error('Error in document route:', err);
      res.render('document', {
        title: 'Error',
        error: 'Error retrieving document: ' + err.message,
        isPdf: false
      });
    }
});
  

module.exports = router;
