const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, required: true }, // 'danger' (fake) or 'success' (real)
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);