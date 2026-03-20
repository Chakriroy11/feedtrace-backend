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

// --- 2. UPDATED CORS (The "Unblocker") ---
// Using origin: true automatically allows whatever URL is hitting the API
// This prevents 404/CORS errors during your fast deployment phase.
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// --- 3. DATABASE CONNECTION ---
// We add options to ensure the connection is stable on Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected to Atlas'))
  .catch((err) => console.log('❌ DB Error:', err));

// --- 4. USE ROUTES ---
// Double check your frontend fetch matches these EXACT strings
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/vouchers', voucherRoutes);
app.use('/api/ads', adRoutes);

// Test Route (Visit your-url.onrender.com/ to see this)
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 FeedTrace API is Live!',
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// --- 5. BIND TO PORT ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on Port ${PORT}`);
});