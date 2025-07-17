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

    // Read file as buffer
    const fileBuffer = fs.readFileSync(req.file.path);

    const doc = new Document({
      title: title || req.file.originalname,
      originalName: req.file.originalname,
      // filePath is kept for migration/legacy reference, but not used for serving
      filePath: path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/'),
      fileType: path.extname(req.file.originalname).toLowerCase(),
      category: category,
      tags: processedTags,
      description: description,
      fileData: fileBuffer
    });
    await doc.save();
    // Optionally, delete the file from disk after saving to DB
    fs.unlinkSync(req.file.path);
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

    // Check if the request is from a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(req.headers['user-agent']);

    if (doc.fileType === '.pdf') {
      // Serve PDF from buffer
      res.contentType('application/pdf');
      res.send(doc.fileData);
    } else if (doc.fileType === '.docx') {
      // Convert DOCX buffer to PDF and serve
      const tmp = require('tmp');
      const tmpDocx = tmp.tmpNameSync({ postfix: '.docx' });
      const tmpPdf = tmp.tmpNameSync({ postfix: '.pdf' });
      fs.writeFileSync(tmpDocx, doc.fileData);
      try {
        await convertDocxToPdf(tmpDocx, tmpPdf);
        const pdfBuffer = fs.readFileSync(tmpPdf);
        res.contentType('application/pdf');
        res.send(pdfBuffer);
        fs.unlinkSync(tmpDocx);
        fs.unlinkSync(tmpPdf);
      } catch (conversionError) {
        if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx);
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
        res.render('document', {
          title: doc.title,
          error: 'Error converting document: ' + conversionError.message,
          isPdf: false
        });
      }
    } else {
      res.render('document', {
        title: doc.title,
        error: 'Unsupported file type: ' + doc.fileType,
        isPdf: false
      });
    }
  } catch (err) {
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

    if (doc.fileType === '.pdf') {
      res.contentType('application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.title}"`);
      res.send(doc.fileData);
    } else if (doc.fileType === '.docx') {
      // Convert DOCX buffer to PDF and serve
      const tmp = require('tmp');
      const tmpDocx = tmp.tmpNameSync({ postfix: '.docx' });
      const tmpPdf = tmp.tmpNameSync({ postfix: '.pdf' });
      fs.writeFileSync(tmpDocx, doc.fileData);
      try {
        await convertDocxToPdf(tmpDocx, tmpPdf);
        const pdfBuffer = fs.readFileSync(tmpPdf);
        res.contentType('application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=\"${doc.title.replace('.docx', '')}.pdf\"`);
        res.send(pdfBuffer);
        fs.unlinkSync(tmpDocx);
        fs.unlinkSync(tmpPdf);
      } catch (error) {
        if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx);
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
        return res.status(500).send('Error converting document to PDF');
      }
    } else {
      return res.status(400).send('Unsupported file type');
    }
  } catch (err) {
    res.status(500).send('Error downloading document');
  }
});

module.exports = router;
