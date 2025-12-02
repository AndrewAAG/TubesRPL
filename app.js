const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./config/db');
const pageRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');
const progressRoutes = require('./routes/progress');
const evaluationRoutes = require('./routes/evaluation');
const lecturerRoutes = require('./routes/lecturer');

// Middleware
app.use(cors());
// untuk parsing JSON
app.use(express.json());
// Untuk serve static fils
app.use(express.static('public', { index: false, extensions: ['css', 'js', 'png', 'jpg'] }));


// ---------------- ROUTING ------------------

// Backend API (Data JSON)
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use("/api/progress", progressRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/lecturer', lecturerRoutes);

// Frontend Page Routs (HTML)
app.use('/', pageRoutes);

// Redirect Utama ke Login Page
app.get('/', (req, res) => {
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));