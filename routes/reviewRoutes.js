const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Notification = require('../models/Notification'); 
const Tesseract = require('tesseract.js');
const nodemailer = require('nodemailer'); 

// --- 1. EMAIL TRANSPORTER SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- LAYER 3 HELPER: OCR CHECK ---
const performOCRCheck = async (imageBase64, orderId, purchaseDate) => {
  try {
    if (!imageBase64) return { text: '', score: 0 };
    
    // Remove header to get pure base64
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Tesseract processing (CPU heavy)
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    const cleanText = text.toLowerCase();

    let score = 0;
    if (cleanText.includes(orderId.toLowerCase())) score += 50;
    
    const dateStr = new Date(purchaseDate).toISOString().split('T')[0];
    if (cleanText.includes(dateStr)) score += 30;

    return { text, score };
  } catch (err) {
    console.error("OCR Error:", err);
    return { text: 'Error extracting text', score: 0 };
  }
};

// --- 2. ADD REVIEW ROUTE (OPTIMIZED FOR SPEED) ---
router.post('/add', async (req, res) => {
  try {
    const { 
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId, bill, 
      usageContext 
    } = req.body;

    // --- Fast Validations ---
    const wordCount = comment.trim().split(/\s+/).length;
    if (wordCount < 10) { 
      return res.status(400).json({ error: "Review is too short. Please write at least 10 words." });
    }

    const purchase = new Date(purchaseDate);
    if (Math.ceil(Math.abs(new Date() - purchase) / (1000 * 60 * 60 * 24)) > 90) {
      return res.status(400).json({ error: "Purchase date is older than 90 days." });
    }

    // --- Heavy OCR Task ---
    let ocrResult = { text: '', score: 0 };
    let trustScore = 20; // Base score
    let flags = [];

    if (bill) {
      console.log("Processing OCR...");
      ocrResult = await performOCRCheck(bill, orderId, purchaseDate);
      
      if (ocrResult.score === 0) {
        flags.push("CRITICAL: Invalid bill image.");
        trustScore = 0; 
      } else {
        trustScore += ocrResult.score;
      }
    }

    if (usageContext && usageContext.reason && usageContext.issue && usageContext.feature) {
      if (trustScore > 0) trustScore += 20; 
    }

    // --- Save to DB ---
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

    // --- 🚀 STEP 1: RESPOND TO USER IMMEDIATELY 🚀 ---
    res.status(201).json({ 
      message: 'Review submitted for verification', 
      review: newReview,
      warnings: flags 
    });

    // --- 🚀 STEP 2: BACKGROUND TASKS (No 'await' here) 🚀 ---
    
    // Background Admin Notification
    const alertMessage = trustScore < 40 
      ? `🚨 ALERT: Low Score (${trustScore}/100) from ${user}.`
      : `✅ CLEAR: High Score (${trustScore}/100) from ${user}.`;

    new Notification({
      message: alertMessage,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    }).save().catch(err => console.error("Notification Error:", err));

    // Background Email (Gmail service can be slow, so we don't wait for it)
    if (email) {
      const mailOptions = {
        from: `"FeedTrace AI" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Review Received! 🚀',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #3b82f6;">Hi ${user},</h2>
              <p>Thank you for submitting a review for <strong>${productName}</strong>.</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px;">Our AI is currently verifying your purchase. Once verified, your review will be published.</p>
              </div>
              <p>Track your status: <a href="https://feedtrace-client.vercel.app/my-reviews" style="color: #3b82f6; font-weight: bold; text-decoration: none;">My Reviews Dashboard</a></p>
            </div>
          `
      };

      transporter.sendMail(mailOptions)
        .then(() => console.log("✉️ Background email sent successfully"))
        .catch(err => console.error("❌ Email failed:", err.message));
    }

  } catch (err) {
    console.error("Submit Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

// --- 3. GET REVIEWS BY USER ---
router.get('/user/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const reviews = await Review.find({ 
      user: { $regex: new RegExp("^" + username + "$", "i") } 
    }).sort({ timestamp: -1 });
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: "Could not fetch reviews" }); }
});

// --- 4. GET ALL REVIEWS ---
router.get('/all', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ timestamp: -1 });
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. STATUS UPDATE ---
router.put('/status/:id', async (req, res) => {
  try {
    const { status, isVerifiedPurchase } = req.body;
    await Review.findByIdAndUpdate(req.params.id, { status, isVerifiedPurchase });
    res.json({ message: "Status updated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6. DELETE REVIEW ---
router.delete('/delete/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7. NOTIFICATIONS ---
router.get('/notifications', async (req, res) => {
  try {
    const alerts = await Notification.find().sort({ createdAt: -1 }).limit(20);
    res.json(alerts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: "Alert dismissed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;