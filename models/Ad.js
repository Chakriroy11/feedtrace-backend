const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  sponsorName: { type: String, required: true },
  bannerImage: { type: String, required: true }, // Base64 image
  couponCode: { type: String, required: true },
  discountText: { type: String, required: true }, // e.g., "GET 20% OFF"
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ad', adSchema);