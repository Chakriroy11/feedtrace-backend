const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Notification = require('../models/Notification'); 
const Tesseract = require('tesseract.js');
const nodemailer = require('nodemailer'); 

// --- 1. SENDGRID TRANSPORTER (Verified for Node.js) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 465, // Using 465 (SSL) is often more stable than 587 for new accounts
  secure: true, 
  auth: {
    user: 'apikey', // MUST be the literal string 'apikey'
    pass: process.env.EMAIL_PASS // Your SG.xxx key from .env
  }
});

// --- 2. GET ALL REVIEWS ---
router.get('/all', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ timestamp: -1 });
    res.status(200).json(reviews);
  } catch (err) { res.status(500).json({ error: "Failed to fetch reviews" }); }
});

// --- 3. STATS ---
router.get('/stats', async (req, res) => {
  try {
    const reviews = await Review.find();
    res.json({
      total: reviews.length,
      pending: reviews.filter(r => r.status === 'pending').length,
      flagged: reviews.filter(r => r.status === 'flagged').length,
      verified: reviews.filter(r => r.status === 'approved' || r.trustScore >= 40).length
    });
  } catch (err) { res.status(500).json({ error: "Stats error" }); }
});

// --- 4. NOTIFICATIONS ---
router.get('/notifications', async (req, res) => {
  try {
    const alerts = await Notification.find().sort({ createdAt: -1 }).limit(10);
    res.json(alerts);
  } catch (err) { res.status(500).json({ error: "Notif error" }); }
});

// --- 5. UPDATE STATUS ---
router.put('/status/:id', async (req, res) => {
  try {
    const { status, isVerifiedPurchase } = req.body;
    const updated = await Review.findByIdAndUpdate(req.params.id, { status, isVerifiedPurchase }, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// --- 6. ADD REVIEW (With Email Logic) ---
router.post('/add', async (req, res) => {
  try {
    const { productName, user, email, orderId, purchaseDate, bill, trustScore: clientScore } = req.body;

    let ocrResult = { text: '', score: 0 };
    if (bill) ocrResult = await performOCRCheck(bill, orderId, purchaseDate);

    const finalScore = (ocrResult.score || 0) + 20;

    const newReview = new Review({
      ...req.body,
      billImage: bill,
      ocrExtractedText: ocrResult.text,
      ocrMatchScore: ocrResult.score,
      status: finalScore < 40 ? 'flagged' : 'pending',
      trustScore: finalScore,
      timestamp: new Date()
    });

    await newReview.save();
    
    // Send response back to frontend immediately
    res.status(201).json({ message: 'Submitted', review: newReview });

    // 🚀 EMAIL TRIGGER
    if (email) {
      const mailOptions = {
        from: '"FeedTrace AI" <feedtraceoff@gmail.com>',
        to: email,
        subject: 'Review Received! 🚀',
        html: `<h3>Hi ${user},</h3><p>Your review for <b>${productName}</b> is being verified.</p><p>Trust Score: ${finalScore}</p>`
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.error("❌ SendGrid Error:", err.message);
        else console.log("✅ Email Sent:", info.response);
      });
    }

    new Notification({ message: `New Review: ${user}`, type: finalScore < 40 ? 'danger' : 'success', reviewId: newReview._id }).save();

  } catch (err) {
    console.error("Route Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

// --- 7. OCR HELPER ---
const performOCRCheck = async (imageBase64, orderId, purchaseDate) => {
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    const cleanText = text.toLowerCase();
    let score = 0;
    if (cleanText.includes(orderId.toLowerCase())) score += 50;
    const formattedDate = new Date(purchaseDate).toISOString().split('T')[0];
    if (cleanText.includes(formattedDate)) score += 30;
    return { text, score };
  } catch (err) { return { text: '', score: 0 }; }
};

// --- 8. DELETE ---
router.delete('/delete/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

module.exports = router;