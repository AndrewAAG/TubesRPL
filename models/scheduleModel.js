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

   // AMBIL REQUEST PENDING
    static async getPendingByLecturer(lecturerId) {
        try {
            // Kita JOIN ke users untuk dapat nama mahasiswa & npm
            // Kita JOIN ke thesis untuk dapat info TA1/TA2 (jika ada tabel thesis)
            const query = `
                SELECT 
                    a.app_id as id,
                    a.start_time,
                    a.end_time,
                    a.location,
                    a.mode,
                    a.status,
                    a.notes as topic,
                    u.name as student_name,
                    s.npm,
                    t.stage_type -- (Asumsi tabel thesis berelasi, jika tidak null)
                FROM appointments a
                JOIN appointment_lecturers al ON a.app_id = al.app_id
                JOIN students s ON a.student_id = s.user_id
                JOIN users u ON s.user_id = u.user_id
                LEFT JOIN thesis t ON t.student_id = s.user_id -- Optional Join
                WHERE al.lecturer_id = ? 
                AND a.status = 'pending' 
                AND a.is_deleted = FALSE
                ORDER BY a.start_time ASC
            `;
            const [rows] = await db.execute(query, [lecturerId]);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    // UPDATE STATUS (APPROVE/REJECT)
    static async updateStatus(appId, status, notes = null) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Update tabel utama (appointments)
            let queryApp = `UPDATE appointments SET status = ? WHERE app_id = ?`;
            let paramsApp = [status, appId];
            
            // Jika reject, kita simpan alasannya di notes
            if (status === 'rejected' && notes) {
                // Append alasan ke notes yang sudah ada
                queryApp = `
                    UPDATE appointments 
                    SET status = ?, 
                        notes = CONCAT(IFNULL(notes, ''), ' [Ditolak: ', ?, ']') 
                    WHERE app_id = ?`;
                paramsApp = [status, notes, appId];
            }
            
            await connection.execute(queryApp, paramsApp);

            // 2. Update tabel pivot (appointment_lecturers)
            // Agar sinkron antara status global dan status respon dosen
            let lecturerStatus = 'pending';
            if (status === 'approved') lecturerStatus = 'accepted';
            if (status === 'rejected') lecturerStatus = 'rejected';

            const queryPivot = `UPDATE appointment_lecturers SET response_status = ? WHERE app_id = ?`;
            await connection.execute(queryPivot, [lecturerStatus, appId]);

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getStudentClassSchedule(studentId) {
        const query = `
            SELECT student_sched_id, day_of_week, start_time, end_time, course_name
            FROM student_schedules
            WHERE student_id = ? AND is_deleted = FALSE
            ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), start_time
        `;
        const [rows] = await db.execute(query, [studentId]);
        return rows;
    }

    // 2. Simpan Jadwal Rutin (Replace Mode: Hapus Lama -> Insert Baru)
    static async replaceStudentSchedule(studentId, schedules) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // A. Hapus jadwal lama (Reset)
            await connection.execute(
                `DELETE FROM student_schedules WHERE student_id = ?`, 
                [studentId]
            );

            // B. Insert jadwal baru (Bulk Insert)
            if (schedules.length > 0) {
                // Cari Semester Aktif
                const [sem] = await connection.execute(`SELECT semester_id FROM semesters WHERE is_active = TRUE LIMIT 1`);
                const activeSemId = sem.length > 0 ? sem[0].semester_id : 1; // Default 1 jika error

                const placeholders = schedules.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                const query = `
                    INSERT INTO student_schedules (student_id, semester_id, day_of_week, start_time, end_time, course_name) 
                    VALUES ${placeholders}
                `;
                
                const params = [];
                schedules.forEach(s => {
                    params.push(studentId, activeSemId, s.day, s.start, s.end, s.course);
                });

                await connection.execute(query, params);
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = ScheduleModel;