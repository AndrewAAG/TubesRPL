const db = require('../config/db');

class NotificationModel {
    
    // Ambil semua notifikasi user (untuk list)
    static async getByUser(userId) {
        const query = `SELECT * FROM notifications WHERE user_id = ? ORDER BY time_notified DESC LIMIT 20`;
        const [rows] = await db.execute(query, [userId]);
        return rows;
    }

    // Hitung jumlah yang belum dibaca (untuk badge merah)
    static async getUnreadCount(userId) {
        const query = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`;
        const [rows] = await db.execute(query, [userId]);
        return rows[0].count;
    }

    // Tandai semua sebagai sudah dibaca (saat drawer dibuka)
    static async markAllAsRead(userId) {
        const query = `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`;
        await db.execute(query, [userId]);
        return true;
    }

    // 1. Ambil ID User berdasarkan Target Group
    static async getTargetUserIds(targetType, senderId = null) {
        let query = '';
        let params = [];

        switch (targetType) {
            case 'all_users':
                query = `SELECT user_id FROM users WHERE status = 'active'`;
                break;
            case 'all_students':
                query = `SELECT user_id FROM users WHERE role = 'student' AND status = 'active'`;
                break;
            case 'all_lecturers':
                query = `SELECT user_id FROM users WHERE role = 'lecturer' AND status = 'active'`;
                break;
            case 'my_students': // Khusus Dosen
                // Ambil mahasiswa yang dibimbing oleh dosen ini (senderId)
                query = `
                    SELECT DISTINCT t.student_id as user_id
                    FROM thesis_supervisors ts
                    JOIN thesis t ON ts.thesis_id = t.thesis_id
                    WHERE ts.lecturer_id = ?
                `;
                params = [senderId];
                break;
            default:
                return [];
        }

        const [rows] = await db.execute(query, params);
        return rows.map(r => r.user_id);
    }

    // 2. Kirim Notifikasi Massal (Bulk Insert)
    static async createBulk(recipientIds, title, message) {
        if (recipientIds.length === 0) return false;

        // Kita perlu menyusun query manual untuk bulk insert
        // INSERT INTO notifications (user_id, title, content) VALUES (?,?,?), (?,?,?), ...
        
        const placeholders = recipientIds.map(() => '(?, ?, ?)').join(', ');
        const query = `INSERT INTO notifications (user_id, title, content) VALUES ${placeholders}`;
        
        // Flatten array params: [id1, title, msg, id2, title, msg, ...]
        const params = [];
        recipientIds.forEach(id => {
            params.push(id, title, message);
        });

        await db.execute(query, params);
        return true;
    }
}

module.exports = NotificationModel;