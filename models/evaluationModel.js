const db = require('../config/db');

class EvaluationModel {
    static async getCompletedByStudentId(studentId) {
        try {
            // Query mirip jadwal, tapi filter status = 'completed'
            const query = `
                SELECT 
                    a.app_id as id,
                    a.start_time,
                    a.end_time,
                    a.location,
                    a.mode,
                    GROUP_CONCAT(u.name SEPARATOR ', ') as lecturers
                FROM appointments a
                LEFT JOIN appointment_lecturers al ON a.app_id = al.app_id
                LEFT JOIN lecturers l ON al.lecturer_id = l.user_id
                LEFT JOIN users u ON l.user_id = u.user_id
                WHERE a.student_id = ? 
                  AND a.status = 'completed' 
                  AND a.is_deleted = FALSE
                GROUP BY a.app_id
                ORDER BY a.start_time DESC
            `;

            const [rows] = await db.execute(query, [studentId]);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    // 1. Ambil Detail (Catatan & Tugas) berdasarkan ID Appointment
    static async getDetailByAppId(appId) {
        try {
            // Ambil Catatan
            const [noteRows] = await db.execute(`
                SELECT sn.summary 
                FROM session_notes sn 
                WHERE sn.app_id = ?
            `, [appId]);

            // Ambil Tugas
            const [taskRows] = await db.execute(`
                SELECT task_id, description, status 
                FROM session_tasks 
                WHERE app_id = ?
            `, [appId]);

            return {
                notes: noteRows.length > 0 ? noteRows[0].summary : 'Tidak ada catatan.',
                tasks: taskRows
            };
        } catch (error) {
            throw error;
        }
    }

    // 2. Update Status Tugas
    static async updateTaskStatus(taskId, newStatus) {
        try {
            await db.execute(`
                UPDATE session_tasks 
                SET status = ? 
                WHERE task_id = ?
            `, [newStatus, taskId]);
            return true;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = EvaluationModel;