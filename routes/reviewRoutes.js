const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Notification = require('../models/Notification'); 
const Tesseract = require('tesseract.js');
const { Resend } = require('resend'); // 🚀 NEW: Professional Email API

// --- 1. EMAIL SETUP (RESEND API) ---
// This replaces Nodemailer to bypass Render's SMTP port blocking
const resend = new Resend(process.env.RESEND_API_KEY);

// --- ✉️ QUICK TEST ROUTE ---
// Visit: https://feedtrace-api.onrender.com/api/reviews/test-resend
router.get('/test-resend', async (req, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'FeedTrace <onboarding@resend.dev>',
      to: process.env.EMAIL_USER, // Sends test to your configured email
      subject: 'Resend API Connection Test 🚀',
      html: '<strong>Success!</strong> Your FeedTrace email system is now permanently unblocked.'
    });

    if (error) throw error;
    res.json({ message: "Success! Check your inbox.", data });
  } catch (err) {
    console.error("Resend Test Error:", err);
    res.status(500).json({ error: "Email failed", details: err.message });
  }
});

// --- LAYER 3 HELPER: OCR CHECK ---
const performOCRCheck = async (imageBase64, orderId, purchaseDate) => {
  try {
    if (!imageBase64) return { text: '', score: 0 };
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

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

// --- 2. ADD REVIEW ROUTE (OPTIMIZED) ---
router.post('/add', async (req, res) => {
  try {
    const { 
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId, bill, 
      usageContext 
    } = req.body;

    // Fast Validations
    const wordCount = comment.trim().split(/\s+/).length;
    if (wordCount < 10) return res.status(400).json({ error: "Review must be at least 10 words." });

    const purchase = new Date(purchaseDate);
    if (Math.ceil(Math.abs(new Date() - purchase) / (1000 * 60 * 60 * 24)) > 90) {
      return res.status(400).json({ error: "Purchase date is older than 90 days." });
    }

    // Heavy OCR Task
    let ocrResult = { text: '', score: 0 };
    let trustScore = 20; 
    let flags = [];

    if (bill) {
      ocrResult = await performOCRCheck(bill, orderId, purchaseDate);
      if (ocrResult.score === 0) {
        flags.push("CRITICAL: Invalid bill image.");
        trustScore = 0; 
      } else {
        trustScore += ocrResult.score;
      }
    }

    if (usageContext?.reason && usageContext?.issue && usageContext?.feature) {
      if (trustScore > 0) trustScore += 20; 
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

    // 🚀 STEP 1: RESPOND TO USER IMMEDIATELY
    res.status(201).json({ 
      message: 'Review submitted for verification', 
      review: newReview,
      warnings: flags 
    });

    // 🚀 STEP 2: BACKGROUND TASKS
    
    // Save Admin Notification
    new Notification({
      message: trustScore < 40 ? `🚨 ALERT: Low Score (${trustScore}/100) from ${user}.` : `✅ CLEAR: High Score (${trustScore}/100) from ${user}.`,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    }).save().catch(err => console.error("Notification Error:", err));

    // Send Background Email via Resend API
    if (email) {
      resend.emails.send({
        from: 'FeedTrace <onboarding@resend.dev>',
        to: email,
        subject: 'Review Received! 🚀',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #3b82f6;">Hi ${user},</h2>
              <p>Thanks for reviewing <strong>${productName}</strong>. Our AI is verifying your purchase.</p>
              <p>Track your status: <a href="https://feedtrace-client.vercel.app/my-reviews" style="color: #3b82f6; font-weight: bold; text-decoration: none;">My Reviews Dashboard</a></p>
            </div>
          `
      }).then(() => console.log("✉️ Email sent via Resend API"))
        .catch(err => console.error("❌ Resend Email failed:", err.message));
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