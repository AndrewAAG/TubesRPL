const express = require('express');
const app = express();


// Middleware untuk parsing JSON
app.use(express.json());
// Untuk routing file HTML/CSS/JS static
app.use(express.static('public')); 



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));