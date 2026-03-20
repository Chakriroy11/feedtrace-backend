const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// --- 1. LOAD ENVIRONMENT VARIABLES ---
dotenv.config(); 

const productRoutes = require('./routes/productRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes'); 
const voucherRoutes = require('./routes/voucherRoutes');
const adRoutes = require('./routes/adRoutes');

const app = express();

// --- 2. UPDATED CORS ---
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🚀 CRITICAL FIX: Increase limit to 50mb to handle multiple Base64 images in one request
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 3. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected to Atlas'))
  .catch((err) => {
    console.log('❌ DB Error details:', err.message);
    process.exit(1); 
  });

// --- 4. USE ROUTES ---
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/vouchers', voucherRoutes);
app.use('/api/ads', adRoutes);

// Test Route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 FeedTrace API is Live!',
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// --- 5. BIND TO PORT ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on Port ${PORT}`);
});