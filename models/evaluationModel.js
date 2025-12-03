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

    static async getCompletedByLecturer(lecturerId) {
        const query = `
            SELECT 
                a.app_id as id,
                a.start_time,
                a.location,
                a.mode,
                a.status,
                u.name as student_name, -- Kita butuh nama mahasiswa
                s.npm
            FROM appointments a
            JOIN appointment_lecturers al ON a.app_id = al.app_id
            JOIN students s ON a.student_id = s.user_id
            JOIN users u ON s.user_id = u.user_id
            WHERE al.lecturer_id = ? 
            AND a.status = 'completed' -- Hanya yang sudah selesai
            ORDER BY a.start_time DESC
        `;
        const [rows] = await db.execute(query, [lecturerId]);
        return rows;
    }

    // 2. Ambil Detail (Sama dengan Student, tapi kita butuh info user juga)
    static async getDetail(appId) {
        // 1. Ambil Data Appointment & Notes (Bagian ini sepertinya sudah oke)
        const queryApp = `
            SELECT a.*, sn.summary as notes, u.name as student_name
            FROM appointments a
            LEFT JOIN session_notes sn ON a.app_id = sn.app_id
            JOIN students s ON a.student_id = s.user_id
            JOIN users u ON s.user_id = u.user_id
            WHERE a.app_id = ?
        `;
        const [rows] = await db.execute(queryApp, [appId]);
        const appData = rows[0];

        // 2. Ambil Tasks (PERBAIKAN DISINI)
        // Pastikan 'due_date' ditulis secara eksplisit atau gunakan SELECT *
        const queryTasks = `
            SELECT task_id, description, status, due_date 
            FROM session_tasks 
            WHERE app_id = ?
            ORDER BY task_id ASC
        `;
        
        const [tasks] = await db.execute(queryTasks, [appId]);

        return { ...appData, tasks };
    }

    static async saveNote(appId, summary) {
        const query = `
            INSERT INTO session_notes (app_id, summary) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE summary = VALUES(summary)
        `;
        await db.execute(query, [appId, summary]);
        return true;
    }

    // 4. Tambah Tugas Baru
    static async addTask(appId, description, dueDate) {
        const query = `INSERT INTO session_tasks (app_id, description, due_date, status) VALUES (?, ?, ?, 'pending')`;
        await db.execute(query, [appId, description, dueDate]);
        return true;
    }
}

module.exports = EvaluationModel;