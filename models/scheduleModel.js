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
                    GROUP_CONCAT(u.name SEPARATOR ', ') as lecturers,
                    GROUP_CONCAT(l.user_id SEPARATOR ',') as lecturer_ids
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
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Update Tabel Utama (Appointments)
            // Reset status jadi 'pending', update waktu, dan append alasan ke notes
            const queryApp = `
                UPDATE appointments 
                SET start_time = ?, 
                    end_time = ?, 
                    status = 'pending',
                    notes = CONCAT(IFNULL(notes, ''), ' [Reschedule: ', ?, ']')
                WHERE app_id = ?
            `;
            await connection.execute(queryApp, [newStart, newEnd, reason, appId]);

            // 2. Reset Status Respon Dosen (Pivot Table)
            // Semua dosen harus menyetujui ulang
            const queryPivot = `
                UPDATE appointment_lecturers 
                SET response_status = 'pending' 
                WHERE app_id = ?
            `;
            await connection.execute(queryPivot, [appId]);

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
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
    static async updateStatus(appId, status, notes = null, lecturerId = null) { // Tambah param lecturerId
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Update tabel utama (appointments)
            // Status GLOBAL appointment berubah sesuai keputusan dosen ini (Approved/Rejected)
            let queryApp = `UPDATE appointments SET status = ? WHERE app_id = ?`;
            let paramsApp = [status, appId];
            
            if (status === 'rejected' && notes) {
                queryApp = `UPDATE appointments SET status = ?, notes = CONCAT(IFNULL(notes, ''), ' [Ditolak: ', ?, ']') WHERE app_id = ?`;
                paramsApp = [status, notes, appId];
            }
            await connection.execute(queryApp, paramsApp);

            // 2. Update tabel pivot (appointment_lecturers)
            // [PERBAIKAN] Hanya update status respon milik DOSEN YANG BERSANGKUTAN
            if (lecturerId) {
                let lecturerStatus = 'pending';
                if (status === 'approved') lecturerStatus = 'accepted';
                if (status === 'rejected') lecturerStatus = 'rejected';

                const queryPivot = `
                    UPDATE appointment_lecturers 
                    SET response_status = ? 
                    WHERE app_id = ? AND lecturer_id = ? -- Filter by ID Dosen
                `;
                await connection.execute(queryPivot, [lecturerStatus, appId, lecturerId]);
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

    static async getStudentClassSchedule(studentId, dayOfWeek) {
        const query = `
            SELECT start_time, end_time 
            FROM student_schedules 
            WHERE student_id = ? AND day_of_week = ? AND is_deleted = FALSE
        `;
        const [rows] = await db.execute(query, [studentId, dayOfWeek]);
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

    static async getLecturerBusySchedules(lecturerId, dayOfWeek) {
        // Kita anggap dosen sibuk jika schedule_type = 'class'
        const query = `
            SELECT start_time, end_time 
            FROM lecturer_schedules 
            WHERE lecturer_id = ? 
            AND day_of_week = ? 
            AND schedule_type = 'class' 
            AND is_deleted = FALSE
        `;
        const [rows] = await db.execute(query, [lecturerId, dayOfWeek]);
        return rows;
    }

    // 3. Ambil Janji Temu yang SUDAH ADA (Specific Date)
    // Cek apakah User (Student/Lecturer) sudah punya janji di tanggal tersebut
    static async getExistingAppointments(userId, userType, date) {
        let query = '';
        if (userType === 'student') {
            query = `
                SELECT start_time, end_time FROM appointments 
                WHERE student_id = ? AND DATE(start_time) = ? 
                AND status NOT IN ('rejected', 'cancelled') AND is_deleted = FALSE
            `;
        } else {
            // Untuk Dosen (Cek via tabel pivot)
            query = `
                SELECT a.start_time, a.end_time 
                FROM appointments a
                JOIN appointment_lecturers al ON a.app_id = al.app_id
                WHERE al.lecturer_id = ? AND DATE(a.start_time) = ?
                AND a.status NOT IN ('rejected', 'cancelled') AND a.is_deleted = FALSE
            `;
        }
        const [rows] = await db.execute(query, [userId, date]);
        return rows;
    }

    static async getSupervisorsByStudentId(studentId) {
        const query = `
            SELECT l.user_id as id, u.name 
            FROM thesis t
            JOIN thesis_supervisors ts ON t.thesis_id = ts.thesis_id
            JOIN lecturers l ON ts.lecturer_id = l.user_id
            JOIN users u ON l.user_id = u.user_id
            WHERE t.student_id = ? 
            -- Opsional: AND t.status IN ('ongoing', 'approved')
        `;
        const [rows] = await db.execute(query, [studentId]);
        return rows;
    }

    static async createRequest(data) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Insert Appointment Utama
            const [resApp] = await connection.execute(`
                INSERT INTO appointments (student_id, start_time, end_time, location, mode, origin, status, notes)
                VALUES (?, ?, ?, ?, ?, 'student_request', 'pending', ?)
            `, [data.studentId, data.startTime, data.endTime, data.location, data.mode, data.notes]);
            
            const appId = resApp.insertId;

            // 2. Insert ke Tabel Pivot (appointment_lecturers) untuk SETIAP Dosen
            for (const lecId of data.lecturerIds) {
                await connection.execute(`
                    INSERT INTO appointment_lecturers (app_id, lecturer_id, response_status)
                    VALUES (?, ?, 'pending')
                `, [appId, lecId]);
            }

            await connection.commit();
            return appId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 1. [BARU] Update Hanya Respon Individu Dosen (Tabel Pivot)
    static async updateLecturerResponse(appId, lecturerId, responseStatus) {
        const query = `
            UPDATE appointment_lecturers 
            SET response_status = ? 
            WHERE app_id = ? AND lecturer_id = ?
        `;
        await db.execute(query, [responseStatus, appId, lecturerId]);
    }

    // 2. Cek Status Teman Sejawat (Ambil semua respon)
    static async getAppointmentResponses(appId) {
        const query = `
            SELECT response_status 
            FROM appointment_lecturers 
            WHERE app_id = ?
        `;
        const [rows] = await db.execute(query, [appId]);
        return rows; 
    }

    // 3. Update Status GLOBAL (Hanya dipanggil jika hasil voting sudah bulat)
    static async updateGlobalStatus(appId, finalStatus, notes = null) {
        let query = `UPDATE appointments SET status = ? WHERE app_id = ?`;
        let params = [finalStatus, appId];

        // Jika reject, tambahkan alasan ke notes
        if (finalStatus === 'rejected' && notes) {
            query = `
                UPDATE appointments 
                SET status = ?, 
                    notes = CONCAT(IFNULL(notes, ''), ' [Ditolak: ', ?, ']') 
                WHERE app_id = ?
            `;
            params = [finalStatus, notes, appId];
        }
        
        await db.execute(query, params);
    }

    // Helper: Ambil ID Dosen dari sebuah Appointment (Untuk keperluan cek slot nanti)
    static async getLecturerIdsByAppId(appId) {
        const [rows] = await db.execute(`
            SELECT lecturer_id FROM appointment_lecturers WHERE app_id = ?
        `, [appId]);
        return rows.map(r => r.lecturer_id);
    }

    // [BARU] Create Appointment Langsung Approved (Single / Bulk)
    static async createLecturerAppointment(appointmentsData) {
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Kita loop data (bisa isinya 1 item untuk single, atau banyak untuk recurring)
            for (const data of appointmentsData) {
                
                // 1. Insert ke tabel appointments (Status langsung APPROVED)
                const [resApp] = await connection.execute(`
                    INSERT INTO appointments (student_id, start_time, end_time, location, mode, origin, status, notes)
                    VALUES (?, ?, ?, ?, ?, 'lecturer_invite', 'approved', ?)
                `, [data.studentId, data.startTime, data.endTime, data.location, data.mode, data.notes]);
                
                const appId = resApp.insertId;

                // 2. Insert ke tabel pivot (Dosen langsung ACCEPTED)
                // Kita perlu memasukkan Dosen Penginisiasi (accepted)
                // DAN Partner Dosen jika ada (pending/accepted? idealnya pending, tapi sesuai request "auto approve", 
                // biasanya jadwal bimbingan dosen A tidak butuh approval dosen B kecuali sidang.
                // Untuk MVP ini, kita masukkan Dosen Penginisiasi saja dulu sebagai 'accepted'.
                
                await connection.execute(`
                    INSERT INTO appointment_lecturers (app_id, lecturer_id, response_status)
                    VALUES (?, ?, 'accepted')
                `, [appId, data.lecturerId]);
                
                // (Opsional) Jika sistem Double TA mewajibkan partner tahu, 
                // Anda bisa menambahkan logic insert partner di sini.
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