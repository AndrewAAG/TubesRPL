const db = require('../config/db');

class User {
    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = ?';
            const [rows] = await db.execute(query, [email]);
            return rows[0]; // Mengembalikan user pertama yang ditemukan (atau undefined)
        } catch (error) {
            throw error;
        }
    }
}

module.exports = User;