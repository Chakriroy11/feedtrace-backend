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
  secure: false, // TLS
  auth: {
    user: 'apikey', // Keep as 'apikey'
    pass: process.env.EMAIL_PASS // Your SG.xxxxxxxx Key from Render
  }
});

// --- ✉️ CONNECTION TEST ROUTE ---
router.get('/test-sendgrid', async (req, res) => {
  try {
    const mailOptions = {
      from: '"FeedTrace AI" <feedtraceoff@gmail.com>', 
      to: "feedtraceoff@gmail.com", 
      subject: 'SendGrid Test 🚀',
      text: 'If you see this, the feedtraceoff@gmail.com account is working!'
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Success! New SendGrid connection is active." });
  } catch (err) {
    console.error("❌ SendGrid Test Error:", err.message);
    res.status(500).json({ error: "Connection failed", details: err.message });
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
    
    // Send response to user immediately
    res.status(201).json({ message: 'Review submitted', review: newReview });

    // --- 🚀 SENDGRID EMAIL LOGIC ---
    if (email) {
      const mailOptions = {
        from: '"FeedTrace AI" <feedtraceoff@gmail.com>', 
        to: email, 
        subject: 'Review Received! 🚀',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f9fafb;">
              <h2 style="color: #3b82f6;">Hi ${user},</h2>
              <p>Thanks for reviewing <strong>${productName}</strong>. Our AI is currently verifying your purchase.</p>
              <p style="margin-top: 20px;">You can track your verification status on your dashboard:</p>
              <a href="https://feedtrace-client.vercel.app/my-reviews" 
                 style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center;">
                 View My Reviews
              </a>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #9ca3af;">This is an automated message from FeedTrace AI.</p>
            </div>
          `
      };

      console.log(`Email trigger: Sending to ${email}...`);
      transporter.sendMail(mailOptions)
        .then(() => console.log(`✉️ SUCCESS: Email delivered to ${email}`))
        .catch(err => console.error(`❌ SENDGRID ERROR for ${email}:`, err.message));
    }

    // Background Notification for Admin
    new Notification({
      message: `Review from ${user} (Trust Score: ${trustScore})`,
      type: trustScore < 40 ? 'danger' : 'success',
      reviewId: newReview._id
    }).save().catch(err => console.error("Admin Notification failed:", err.message));

  } catch (err) {
    console.error("Critical Add Route Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;