const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // --- Basic Info ---
  productId: { type: String, required: true },
  productName: { type: String },
  user: { type: String, required: true }, // JWT User
  rating: { type: Number, required: true },
  comment: { type: String, required: true }, // Layer 1: Content
  
  // --- Layer 2: Metadata ---
  purchaseDate: { type: Date, required: true },
  platform: { type: String, required: true }, // e.g., Amazon, Flipkart
  orderId: { type: String, required: true },

  // --- Layer 3: OCR Data ---
  billImage: { type: String }, // Base64
  ocrExtractedText: { type: String }, // Text found by Tesseract
  ocrMatchScore: { type: Number, default: 0 }, // How well it matched

  // --- Layer 4: Contextual/Behavioral ---
  usageContext: {
    reason: String,   // Why did you buy it?
    issue: String,    // One issue faced?
    feature: String   // One feature liked?
  },

  // --- Layer 5: Admin Status ---
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'flagged'], 
    default: 'pending' 
  },
  trustScore: { type: Number, default: 0 }, // Calculated score
  isVerifiedPurchase: { type: Boolean, default: false },

  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);