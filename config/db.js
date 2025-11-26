const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 1. Konfigurasi Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // WAJIB: Agar bisa jalankan banyak query sekaligus
});

// 2. Fungsi Inisialisasi Database Otomatis
const initDb = () => {
    try {
        // Cari file initialize.sql di folder yang sama dengan file ini
        const sqlPath = path.join(__dirname, 'initialize.sql');
        
        // Baca isinya
        const sqlQuery = fs.readFileSync(sqlPath, 'utf8');

        // Jalankan Query
        pool.query(sqlQuery, (err) => {
            if (err) {
                console.error("❌ Gagal inisialisasi tabel:", err.message);
            } else {
                console.log("✅ Database Tables Initialized (Sync OK)");
            }
        });
    } catch (error) {
        console.error("⚠️ File initialize.sql tidak ditemukan atau error:", error.message);
    }
};

// Jalankan inisialisasi sekali saat server start
initDb();

// Export promise agar bisa dipakai async/await di controller
module.exports = pool.promise();