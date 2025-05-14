const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mammoth = require('mammoth');
const Document = require('../models/document');
const fs = require('fs');
const docxPdf = require('docx-pdf');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    // Use Date.now() to get unique file names
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure Multer with limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    fieldSize: 50 * 1024 * 1024 // 50MB max field size
  }
});

// Home route: List all uploaded documents in Bootstrap cards.
router.get('/', async (req, res) => {
  try {
    const docs = await Document.find().sort({ uploadedAt: -1 });
    // Add filename to each document
    const documents = docs.map(doc => ({
      ...doc.toObject(),
      filename: doc.filePath.split('/').pop() // Get the filename from the path
    }));
    res.render('index', { documents });
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
    const { title, category, tags, description } = req.body;
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    // Process tags - split by comma and trim whitespace
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const doc = new Document({
      title: title || req.file.originalname,
      originalName: req.file.originalname,
      filePath: path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/'),
      fileType: path.extname(req.file.originalname).toLowerCase(),
      category: category,
      tags: processedTags,
      description: description
    });
    await doc.save();
    res.redirect('/');
  } catch (err) {
    console.error('Upload error:', err);
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

// Function to convert DOCX to PDF
async function convertDocxToPdf(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    docxPdf(docxPath, pdfPath, function(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// View full document
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

      // Increment view count
      doc.viewCount += 1;
      await doc.save();

      // Get absolute file path
      const filePath = path.join(__dirname, '..', doc.filePath);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('File not found at path:', filePath);
        return res.render('document', {
          title: doc.title,
          error: 'File not found on server.',
          isPdf: false
        });
      }

      // Check if the request is from a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(req.headers['user-agent']);

      if (doc.fileType === '.docx') {
        try {
          // Create PDF path
          const pdfPath = filePath.replace('.docx', '.pdf');
          
          // Convert DOCX to PDF if PDF doesn't exist
          if (!fs.existsSync(pdfPath)) {
            await convertDocxToPdf(filePath, pdfPath);
          }

          // Get relative PDF path for URL
          const relativePdfPath = path.relative(path.join(__dirname, '..'), pdfPath).replace(/\\/g, '/');
          const pdfUrl = '/' + relativePdfPath;

          res.render(isMobile ? 'mobile-pdf' : 'document', { 
            title: doc.title, 
            pdfLink: pdfUrl,
            isPdf: true,
            error: null,
            filename: path.basename(pdfPath),
            viewCount: doc.viewCount
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
        res.render(isMobile ? 'mobile-pdf' : 'document', { 
          title: doc.title, 
          pdfLink: '/uploads/' + path.basename(doc.filePath),
          isPdf: true,
          error: null,
          filename: path.basename(doc.filePath),
          viewCount: doc.viewCount
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

// Download document
router.get('/download/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).send('Document not found');
    }

    const filePath = path.join(__dirname, '..', doc.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    if (doc.fileType === '.docx') {
      // Convert DOCX to PDF for download
      const pdfPath = filePath.replace('.docx', '.pdf');
      
      // Convert if PDF doesn't exist
      if (!fs.existsSync(pdfPath)) {
        try {
          await convertDocxToPdf(filePath, pdfPath);
        } catch (error) {
          console.error('Conversion error:', error);
          return res.status(500).send('Error converting document to PDF');
        }
      }

      // Send the PDF file
      res.download(pdfPath, `${doc.title.replace('.docx', '')}.pdf`);
    } else {
      // For PDF files, send directly
      res.download(filePath, doc.title);
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Error downloading document');
  }
});

module.exports = router;
