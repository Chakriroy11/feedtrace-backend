const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g., "SAVE20"
  sponsor: { type: String, required: true },            // e.g., "Nike"
  discount: { type: String, required: true },           // e.g., "20% OFF"
  description: { type: String },                        // e.g., "On all running shoes"
  expiry: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Voucher', voucherSchema);