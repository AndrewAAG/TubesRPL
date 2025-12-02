const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./config/db');
const authRoutes = require('./routes/auth');

// Middleware
app.use(cors());
// untuk parsing JSON
app.use(express.json());
// Untuk routing file HTML/CSS/JS static
app.use(express.static('public', { extensions: ['html'] }));


app.use('/api/auth', authRoutes);


// Redirect Utama ke Login Page
app.get('/', (req, res) => {
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));