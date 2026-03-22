const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Notification = require('../models/Notification'); 
const Tesseract = require('tesseract.js');
const nodemailer = require('nodemailer'); 

// --- 1. SENDGRID TRANSPORTER SETUP ---
// Using port 587 (TLS) which is standard for SendGrid
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'apikey', // This must be the literal string 'apikey'
    pass: process.env.EMAIL_PASS // Your SendGrid API Key (starts with SG.)
  }
});

// --- ✉️ QUICK CONNECTION TEST ROUTE ---
router.get('/test-sendgrid', async (req, res) => {
  try {
    const mailOptions = {
      from: `"FeedTrace Test" <${process.env.EMAIL_USER}>`, // Must be your Verified Sender email
      to: process.env.EMAIL_USER, 
      subject: 'SendGrid Test 🚀',
      text: 'If you see this, SendGrid is working!'
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Success! SendGrid is connected." });
  } catch (err) {
    console.error("SendGrid Test Error:", err);
    res.status(500).json({ error: "SendGrid failed", details: err.message });
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

// --- 2. ADD REVIEW ROUTE ---
router.post('/add', async (req, res) => {
  try {
    const { 
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId, bill, usageContext 
    } = req.body;

    // OCR Logic
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

    res.status(201).json({ message: 'Review submitted', review: newReview });

    // --- BACKGROUND EMAIL LOGIC (SENDGRID) ---
    if (email) {
      const mailOptions = {
        from: `"FeedTrace AI" <${process.env.EMAIL_USER}>`, // Verified Sender Email
        to: email,
        subject: 'Review Received! 🚀',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #3b82f6;">Hi ${user},</h2>
              <p>Thanks for reviewing <strong>${productName}</strong>. Our AI is verifying your purchase.</p>
              <p>Track your status: <a href="https://feedtrace-client.vercel.app/my-reviews">Dashboard</a></p>
            </div>
          `
      };

      transporter.sendMail(mailOptions)
        .then(() => console.log("✉️ Email sent via SendGrid"))
        .catch(err => console.error("❌ SendGrid Error:", err.message));
    }

    // Admin Notification
    new Notification({
      message: `Review from ${user} (Score: ${trustScore})`,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    }).save().catch(err => console.error(err));

  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;