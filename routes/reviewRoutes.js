const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Notification = require('../models/Notification'); 
const Tesseract = require('tesseract.js');
const nodemailer = require('nodemailer'); 

// --- 1. SENDGRID TRANSPORTER SETUP ---
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, 
  auth: {
    user: 'apikey', 
    pass: process.env.EMAIL_PASS 
  }
});

// --- 2. ADMIN DASHBOARD STATS (Fixes 404) ---
router.get('/stats', async (req, res) => {
  try {
    const reviews = await Review.find();
    const stats = {
      total: reviews.length,
      pending: reviews.filter(r => r.status === 'pending').length,
      flagged: reviews.filter(r => r.status === 'flagged').length,
      verified: reviews.filter(r => r.status === 'approved' || r.isVerifiedPurchase).length
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- 3. NOTIFICATIONS ROUTE (Fixes 404) ---
router.get('/notifications', async (req, res) => {
  try {
    const alerts = await Notification.find().sort({ createdAt: -1 }).limit(10);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// --- 4. ADD REVIEW ROUTE (With Email) ---
router.post('/add', async (req, res) => {
  try {
    const { 
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId, bill, usageContext 
    } = req.body;

    let ocrResult = { text: '', score: 0 };
    let trustScore = 20; 
    if (bill) {
      // (Assuming performOCRCheck helper is defined below)
      ocrResult = await performOCRCheck(bill, orderId, purchaseDate);
      trustScore += ocrResult.score;
    }

    const newReview = new Review({
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId,
      billImage: bill,
      ocrExtractedText: ocrResult.text,
      ocrMatchScore: ocrResult.score,
      usageContext,
      status: trustScore < 40 ? 'flagged' : 'pending',
      trustScore,
      timestamp: new Date()
    });

    await newReview.save();
    res.status(201).json({ message: 'Review submitted', review: newReview });

    if (email) {
      const mailOptions = {
        from: '"FeedTrace AI" <feedtraceoff@gmail.com>', 
        to: email, 
        subject: 'Review Received! 🚀',
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2>Hi ${user},</h2><p>Review received for ${productName}. AI is verifying...</p></div>`
      };
      transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err.message));
    }

    new Notification({
      message: `New Review: ${user} (Score: ${trustScore})`,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    }).save();

  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

// --- 5. OCR HELPER ---
const performOCRCheck = async (imageBase64, orderId, purchaseDate) => {
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    const cleanText = text.toLowerCase();
    let score = 0;
    if (cleanText.includes(orderId.toLowerCase())) score += 50;
    if (cleanText.includes(new Date(purchaseDate).toISOString().split('T')[0])) score += 30;
    return { text, score };
  } catch (err) { return { text: '', score: 0 }; }
};

// --- 6. STANDARD GET/DELETE ROUTES ---
router.get('/all', async (req, res) => {
  const reviews = await Review.find().sort({ timestamp: -1 });
  res.json(reviews);
});

router.delete('/delete/:id', async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;