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
      purchaseDate, platform, orderId, bill, 
      usageContext 
    } = req.body;

    let trustScore = 0;
    let flags = [];

    // Layer 1: Word Count
    const wordCount = comment.trim().split(/\s+/).length;
    if (wordCount < 10) { 
      return res.status(400).json({ error: "Review is too short. Please write at least 10 words." });
    }
    trustScore += 20;

    // Layer 2: Metadata
    const purchase = new Date(purchaseDate);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - purchase) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 90) return res.status(400).json({ error: "Purchase date is older than 90 days." });
    if (orderId.length < 5) flags.push("Suspicious Order ID format");
    else trustScore += 20;

    // --- 🚨 LAYER 3: OCR (STRICT MODE APPLIED) 🚨 ---
    let ocrResult = { text: '', score: 0 };
    if (bill) {
      console.log("Processing OCR...");
      ocrResult = await performOCRCheck(bill, orderId, purchaseDate);
      
      if (ocrResult.score === 0) {
        flags.push("CRITICAL: Uploaded image does not look like a valid bill.");
        trustScore = 0; 
      } else {
        trustScore += ocrResult.score;
      }
    }

    // Layer 4: Context
    if (usageContext && usageContext.reason && usageContext.issue && usageContext.feature) {
      if (trustScore > 0) trustScore += 20; 
    } else {
      flags.push("Missing contextual answers");
    }

    // Layer 5: Status
    let status = 'pending';
    if (trustScore < 40) status = 'flagged';

    const newReview = new Review({
      productId, productName, user, email, rating, comment, 
      purchaseDate, platform, orderId,
      billImage: bill,
      ocrExtractedText: ocrResult.text,
      ocrMatchScore: ocrResult.score,
      usageContext,
      status,
      trustScore,
      timestamp: new Date()
    });

    await newReview.save();

    // --- AUTOMATED AI MESSAGE FOR ADMIN ---
    const alertMessage = trustScore < 40 
      ? `🚨 ALERT: Low Score (${trustScore}/100). ${user} submitted a potential FAKE bill for ${productName}.`
      : `✅ CLEAR: High Score (${trustScore}/100). ${user}'s bill for ${productName} looks authentic.`;
    
    const alertType = trustScore < 40 ? 'danger' : 'success';

    const newNotification = new Notification({
      message: alertMessage,
      type: alertType,
      reviewId: newReview._id
    });
    
    await newNotification.save();
    
    // --- ✉️ AUTOMATED THANK YOU EMAIL FOR USER ---
    if (email) {
      try {
        const mailOptions = {
          from: `"FeedTrace AI" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Thank You for Your FeedTrace Review! 🚀',
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3b82f6; margin: 0; font-size: 28px;">FeedTrace</h1>
                <p style="color: #64748b; margin-top: 5px; font-size: 14px;">The AI-Powered Trust Engine</p>
              </div>
              
              <h2 style="color: #0f172a; font-size: 20px;">Hi ${user},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Thank you for taking the time to submit a review for the <strong>${productName}</strong>. Your contribution helps build a safer, scam-free shopping experience for everyone!
              </p>
              
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                <h3 style="margin: 0 0 10px 0; color: #d97706; font-size: 16px;">What happens next?</h3>
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">
                  Our AI Trust Engine is currently analyzing your review and scanning your proof of purchase. Once verified, your Trust Score will be generated and your review will be published to the community.
                </p>
              </div>
              
              <p style="color: #475569; font-size: 16px;">
                You can track the status of your review on your <a href="http://localhost:5173/my-reviews" style="color: #3b82f6; text-decoration: none; font-weight: bold;">My Reviews Dashboard</a>.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
              
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                This is an automated message from FeedTrace. Please do not reply to this email.
              </p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log("✉️ Confirmation email sent successfully to:", email);
      } catch (emailErr) {
        console.error("❌ Failed to send email:", emailErr.message);
      }
    }
    // --------------------------------------------------------
    
    res.status(201).json({ 
      message: 'Review submitted for verification', 
      review: newReview,
      warnings: flags 
    });

  } catch (err) {
    console.error("Review Submit Error:", err);
    res.status(500).json({ error: err.message });
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
  } catch (err) {
    console.error("Error fetching user reviews:", err);
    res.status(500).json({ error: "Could not fetch reviews" });
  }
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

// --- 6. DELETE REVIEW (ADMIN) ---
router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json({ message: 'Review Deleted Successfully' });
  } catch (err) {
    console.error("Delete Review Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 7. GET ADMIN NOTIFICATIONS ---
router.get('/notifications', async (req, res) => {
  try {
    const alerts = await Notification.find().sort({ createdAt: -1 }).limit(20);
    res.json(alerts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 8. DISMISS (DELETE) NOTIFICATION ---
router.delete('/notifications/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: "Alert dismissed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;