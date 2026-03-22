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

// --- 2. GET ALL REVIEWS (Fixes 404 for /api/reviews/all) ---
router.get('/all', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ timestamp: -1 });
    res.status(200).json(reviews); // Explicit 200 status
  } catch (err) {
    console.error("Fetch All Error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// --- 3. ADMIN DASHBOARD STATS (Fixes 404 for /api/reviews/stats) ---
router.get('/stats', async (req, res) => {
  try {
    const reviews = await Review.find();
    const stats = {
      total: reviews.length,
      pending: reviews.filter(r => r.status === 'pending').length,
      flagged: reviews.filter(r => r.status === 'flagged').length,
      verified: reviews.filter(r => r.status === 'approved' || r.trustScore >= 40).length
    };
    res.status(200).json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- 4. NOTIFICATIONS ROUTE (Fixes 404 for /api/reviews/notifications) ---
router.get('/notifications', async (req, res) => {
  try {
    const alerts = await Notification.find().sort({ createdAt: -1 }).limit(10);
    res.status(200).json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// --- 5. ADD REVIEW ROUTE ---
router.post('/add', async (req, res) => {
  try {
    const { 
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId, bill, usageContext 
    } = req.body;

    let ocrResult = { text: '', score: 0 };
    let trustScore = 20; 
    
    if (bill) {
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

    // Respond immediately
    res.status(201).json({ message: 'Review submitted', review: newReview });

    // Background Tasks
    if (email) {
      const mailOptions = {
        from: '"FeedTrace AI" <feedtraceoff@gmail.com>', 
        to: email, 
        subject: 'Review Received! 🚀',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #3b82f6;">Hi ${user},</h2>
            <p>Your review for <strong>${productName}</strong> has been received and is being verified by our AI.</p>
            <p>Trust Score: <strong>${trustScore}</strong></p>
          </div>`
      };
      transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err.message));
    }

    const newNotif = new Notification({
      message: `New Review: ${user} (Score: ${trustScore})`,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    });
    await newNotif.save();

  } catch (err) {
    console.error("Route Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

// --- 6. OCR HELPER ---
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
  } catch (err) { 
    console.error("OCR Helper Error:", err);
    return { text: '', score: 0 }; 
  }
};

router.delete('/delete/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;