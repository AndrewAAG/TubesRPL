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
    static async getTargetUserIds(targetType, senderId = null, specificStudentId = null) {
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
            case 'my_students': // Semua Mahasiswa Bimbingan
                query = `
                    SELECT DISTINCT t.student_id as user_id
                    FROM thesis_supervisors ts
                    JOIN thesis t ON ts.thesis_id = t.thesis_id
                    WHERE ts.lecturer_id = ?
                `;
                params = [senderId];
                break;
            case 'specific_student': // UPDATE: Satu Mahasiswa Tertentu
                if (specificStudentId) return [specificStudentId]; // Langsung return array ID
                return [];
            default:
                return [];
        }

        const [rows] = await db.execute(query, params);
        return rows.map(r => r.user_id);
    }

    // 2. UPDATE: Create Bulk dengan SOURCE
    static async createBulk(recipientIds, title, message, source) {
        if (recipientIds.length === 0) return false;

        // Tambahkan kolom source ke query
        const placeholders = recipientIds.map(() => '(?, ?, ?, ?)').join(', ');
        const query = `INSERT INTO notifications (user_id, title, content, source) VALUES ${placeholders}`;
        
        const params = [];
        recipientIds.forEach(id => {
            // Default source jika kosong
            params.push(id, title, message, source || 'Info Sistem');
        });

        await db.execute(query, params);
        return true;
    }
}

module.exports = NotificationModel;