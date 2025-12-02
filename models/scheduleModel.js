const db = require('../config/db');

class ScheduleModel {
    static async getByStudentId(studentId) {
        try {
            // appointments -> appointment_lecturers -> lecturers -> users (untuk dapat nama)
            const query = `
                SELECT 
                    a.app_id as id,
                    a.start_time,
                    a.end_time,
                    a.location,
                    a.mode,
                    a.status,
                    a.notes,
                    GROUP_CONCAT(u.name SEPARATOR ', ') as lecturers
                FROM appointments a
                LEFT JOIN appointment_lecturers al ON a.app_id = al.app_id
                LEFT JOIN lecturers l ON al.lecturer_id = l.user_id
                LEFT JOIN users u ON l.user_id = u.user_id
                WHERE a.student_id = ? AND a.is_deleted = FALSE
                GROUP BY a.app_id
                ORDER BY a.start_time ASC
            `;

            const [rows] = await db.execute(query, [studentId]);
            return rows;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ScheduleModel;