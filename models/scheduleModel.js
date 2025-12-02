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

    static async reschedule(appId, newStart, newEnd, reason) {
        try {
            // Kita lakukan Transaction agar data konsisten
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Update Tabel Utama (Appointments)
                // Status kita reset jadi 'pending' agar butuh approval ulang
                // Notes kita tambahkan log alasannya
                const queryApp = `
                    UPDATE appointments 
                    SET start_time = ?, 
                        end_time = ?, 
                        status = 'pending',
                        notes = CONCAT(IFNULL(notes, ''), ' [Reschedule: ', ?, ']')
                    WHERE app_id = ?
                `;
                await connection.execute(queryApp, [newStart, newEnd, reason || 'Perubahan Jadwal', appId]);

                // 2. Reset Status Dosen di Tabel Pivot (Appointment_Lecturers)
                // Agar dosen/mahasiswa harus klik 'Approve' lagi nanti
                const queryPivot = `
                    UPDATE appointment_lecturers 
                    SET response_status = 'pending' 
                    WHERE app_id = ?
                `;
                await connection.execute(queryPivot, [appId]);

                await connection.commit();
                return true;

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ScheduleModel;