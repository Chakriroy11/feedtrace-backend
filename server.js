const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// --- 1. LOAD ENVIRONMENT VARIABLES FIRST! ---
dotenv.config(); 

const productRoutes = require('./routes/productRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes'); 
const voucherRoutes = require('./routes/voucherRoutes');
const adRoutes = require('./routes/adRoutes');

const app = express();

// --- 2. PRODUCTION CORS SETTINGS ---
// Replace the URL with your actual Vercel frontend URL once deployed
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174", 
    "https://your-frontend-name.vercel.app" // 🌟 ADD YOUR VERCEL URL HERE
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then((conn) => {
    console.log('✅ MongoDB Connected');
  })
  .catch((err) => console.log('❌ DB Error:', err));

// Use Routes
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/vouchers', voucherRoutes);
app.use('/api/ads', adRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('🚀 FeedTrace API is Live and Running!');
});

// --- 3. BIND TO 0.0.0.0 FOR CLOUD HOSTS ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on Port ${PORT}`);
});