const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, required: true },
  fileData: { type: Buffer },
  uploadedAt: { type: Date, default: Date.now },
  category: { type: String, required: true },
  isCustomCategory: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Document', documentSchema);
