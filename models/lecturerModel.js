const db = require('../config/db');

class LecturerModel {
    // 1. Ambil Daftar Mahasiswa Bimbingan
    static async getMyStudents(lecturerId) {
        try {
            const query = `
                SELECT s.user_id, u.name, s.npm 
                FROM students s
                JOIN users u ON s.user_id = u.user_id
                JOIN thesis t ON s.user_id = t.student_id
                JOIN thesis_supervisors ts ON t.thesis_id = ts.thesis_id
                WHERE ts.lecturer_id = ?
            `;
            const [rows] = await db.execute(query, [lecturerId]);
            return rows;
        } catch (error) { throw error; }
    }

    // 2. Ambil Jadwal Bimbingan Dosen
    static async getSchedules(lecturerId, studentId = null) {
        try {
            let query = `
                SELECT 
                    a.app_id as id, a.start_time, a.end_time, a.location, a.mode, a.status, a.notes,
                    u_mhs.name as student_name,
                    s.npm
                FROM appointments a
                JOIN appointment_lecturers al ON a.app_id = al.app_id
                JOIN students s ON a.student_id = s.user_id
                JOIN users u_mhs ON s.user_id = u_mhs.user_id
                WHERE al.lecturer_id = ? 
                  AND a.is_deleted = FALSE
                  AND a.status != 'completed'  -- <--- TAMBAHAN: Filter status bukan completed
            `;
            
            const params = [lecturerId];

            // Jika filter mahasiswa aktif
            if (studentId && studentId !== 'all') {
                query += ` AND a.student_id = ?`;
                params.push(studentId);
            }

            // Urutkan jadwal terdekat di paling atas
            query += ` ORDER BY a.start_time ASC`;

            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) { throw error; }
    }
}

module.exports = LecturerModel;