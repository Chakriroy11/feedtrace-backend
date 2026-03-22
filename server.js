const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// --- 1. LOAD ENVIRONMENT VARIABLES ---
dotenv.config(); 

// Import Routes
const productRoutes = require('./routes/productRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes'); 
const voucherRoutes = require('./routes/voucherRoutes');
const adRoutes = require('./routes/adRoutes');

const app = express();

// --- 2. CONFIGURE MIDDLEWARE ---
// This allows your Vercel frontend to talk to your Render backend
app.use(cors({
  origin: true, // Allows all origins or specify your Vercel URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🚀 CRITICAL: Increase limit to handle Base64 images for OCR
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 3. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1); 
  });

// --- 4. REGISTER API ROUTES ---
// These prefixes must match what your Frontend calls
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes); // This handles /all, /stats, and /notifications
app.use('/api/auth', authRoutes); 
app.use('/api/vouchers', voucherRoutes);
app.use('/api/ads', adRoutes);

// --- 5. HEALTH CHECK ROUTE ---
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: '🚀 FeedTrace AI Backend is Live!',
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// --- 6. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// --- 7. BIND TO PORT ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on Port ${PORT}`);
  console.log(`📡 Access via: https://feedtrace-api.onrender.com`);
});