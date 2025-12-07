const db = require('../config/db');

class CoordinatorModel {
    
    // GET ALL
    static async getAllSemesters() {
        const query = `SELECT * FROM semesters ORDER BY start_date DESC`;
        const [rows] = await db.execute(query);
        return rows;
    }

    // CREATE
    static async createSemester(data) {
        // Jika user set aktif, matikan dulu semester lain
        if (data.is_active) {
            await db.execute(`UPDATE semesters SET is_active = FALSE`);
        }

        const query = `
            INSERT INTO semesters 
            (name, year, start_date, end_date, uts_start_date, uts_end_date, uas_start_date, uas_end_date, min_ta1, min_ta2, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.name, data.year, data.start_date, data.end_date,
            data.uts_start, data.uts_end, data.uas_start, data.uas_end,
            data.min_ta1, data.min_ta2, data.is_active
        ];
        
        await db.execute(query, params);
        return true;
    }

    // UPDATE
    static async updateSemester(id, data) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            if (data.is_active) {
                await connection.execute(`UPDATE semesters SET is_active = FALSE`);
            }

            const query = `
                UPDATE semesters SET 
                    name=?, year=?, start_date=?, end_date=?, 
                    uts_start_date=?, uts_end_date=?, uas_start_date=?, uas_end_date=?, 
                    min_ta1=?, min_ta2=?, is_active=?
                WHERE semester_id=?
            `;
            const params = [
                data.name, data.year, data.start_date, data.end_date,
                data.uts_start, data.uts_end, data.uas_start, data.uas_end,
                data.min_ta1, data.min_ta2, data.is_active, id
            ];
            
            await connection.execute(query, params);
            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    // DELETE
    static async deleteSemester(id) {
        // Cek dulu apakah ada data thesis/jadwal yang terikat agar tidak error constraint
        // Untuk MVP kita delete saja langsung (Soft delete recommended sebenernya)
        await db.execute(`DELETE FROM semesters WHERE semester_id = ?`, [id]);
        return true;
    }

    // SET ACTIVE TOGGLE
    static async setActive(id) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(`UPDATE semesters SET is_active = FALSE`);
            await connection.execute(`UPDATE semesters SET is_active = TRUE WHERE semester_id = ?`, [id]);
            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    // AMBIL DAFTAR MAHASISWA TA DI SEMESTER AKTIF
    static async getAssignmentData() {
        try {
            // 1. Cari Semester Aktif (Ambil ID dan NAME)
            const [semRows] = await db.execute(`
                SELECT semester_id, name 
                FROM semesters 
                WHERE is_active = TRUE 
                LIMIT 1
            `);
            
            if (semRows.length === 0) {
                return { semesterName: 'Tidak Ada Semester Aktif', students: [] };
            }

            const activeSemId = semRows[0].semester_id;
            const semesterName = semRows[0].name; // <--- Ambil nama semester

            // 2. Ambil Data Tesis + Mahasiswa (Query Tetap Sama)
            const query = `
                SELECT 
                    t.thesis_id, t.stage_type, s.npm, u.name as student_name
                FROM thesis t
                JOIN students s ON t.student_id = s.user_id
                JOIN users u ON s.user_id = u.user_id
                WHERE t.semester_id = ?
                ORDER BY s.npm ASC
            `;
            const [students] = await db.execute(query, [activeSemId]);

            // 3. Ambil Data Supervisor (Logic Tetap Sama)
            for (let student of students) {
                const [supervisors] = await db.execute(`
                    SELECT ts.lecturer_id, ts.role, u.name 
                    FROM thesis_supervisors ts
                    JOIN users u ON ts.lecturer_id = u.user_id
                    WHERE ts.thesis_id = ?
                `, [student.thesis_id]);

                student.p1 = supervisors.find(s => s.role === 'pembimbing_1') || null;
                student.p2 = supervisors.find(s => s.role === 'pembimbing_2') || null;
            }

            // Return Object berisi nama semester & list student
            return { semesterName, students }; 
            
        } catch (error) { throw error; }
    }

    // AMBIL LIST SEMUA DOSEN (Untuk Dropdown)
    static async getAllLecturers() {
        const query = `
            SELECT l.user_id, u.name, l.nip 
            FROM lecturers l
            JOIN users u ON l.user_id = u.user_id
            WHERE u.status = 'active'
            ORDER BY u.name ASC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    // UPDATE ASSIGNMENT (Transaction)
    static async updateAssignment(thesisId, p1Id, p2Id) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Hapus semua pembimbing lama untuk tesis ini
            await connection.execute(`DELETE FROM thesis_supervisors WHERE thesis_id = ?`, [thesisId]);

            // 2. Insert Pembimbing 1
            if (p1Id) {
                await connection.execute(`
                    INSERT INTO thesis_supervisors (thesis_id, lecturer_id, role) VALUES (?, ?, 'pembimbing_1')
                `, [thesisId, p1Id]);
            }

            // 3. Insert Pembimbing 2 (Jika ada)
            if (p2Id) {
                await connection.execute(`
                    INSERT INTO thesis_supervisors (thesis_id, lecturer_id, role) VALUES (?, ?, 'pembimbing_2')
                `, [thesisId, p2Id]);
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

    // AMBIL DATA MAHASISWA + STATUS TA DI SEMESTER AKTIF
    static async getAllStudentsExtended() {
        try {
            // 1. Cek Semester Aktif
            const [sem] = await db.execute(`SELECT semester_id FROM semesters WHERE is_active = TRUE LIMIT 1`);
            const activeSemId = sem.length > 0 ? sem[0].semester_id : null;

            // 2. Query Student + Cek apakah dia punya record Thesis di semester ini
            const query = `
                SELECT 
                    s.user_id, s.npm, s.cohort_year, u.name, u.email, u.status as account_status,
                    
                    -- Cek apakah ambil TA di semester aktif (Return 1 or 0)
                    (SELECT COUNT(*) FROM thesis t 
                     WHERE t.student_id = s.user_id AND t.semester_id = ?) as is_taking_ta,
                     
                    -- Ambil tipe TA nya (TA1/TA2) jika ada
                    (SELECT stage_type FROM thesis t 
                     WHERE t.student_id = s.user_id AND t.semester_id = ? LIMIT 1) as current_stage

                FROM students s
                JOIN users u ON s.user_id = u.user_id
                ORDER BY s.npm ASC
            `;
            const [rows] = await db.execute(query, [activeSemId, activeSemId]);
            return rows;

        } catch (error) { throw error; }
    }

    // AMBIL DATA DOSEN
    static async getAllLecturersExtended() {
        const query = `
            SELECT l.user_id, l.nip, u.name, u.email, u.status as account_status
            FROM lecturers l
            JOIN users u ON l.user_id = u.user_id
            ORDER BY u.name ASC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    // UPDATE STATUS MAHASISWA (Akun & TA)
    static async updateStudentStatus(studentId, accountStatus, isTakingTa, stageType) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Update Status Akun (Users)
            await connection.execute(`UPDATE users SET status = ? WHERE user_id = ?`, [accountStatus, studentId]);

            // 2. Handle Status TA (Enroll/Drop)
            // Ambil Semester Aktif
            const [sem] = await connection.execute(`SELECT semester_id FROM semesters WHERE is_active = TRUE LIMIT 1`);
            if (sem.length === 0) throw new Error("Tidak ada semester aktif");
            const activeSemId = sem[0].semester_id;

            if (isTakingTa) {
                // ENROLL: Insert/Update thesis record
                // Cek dulu apakah sudah ada
                const [existing] = await connection.execute(
                    `SELECT thesis_id FROM thesis WHERE student_id = ? AND semester_id = ?`, 
                    [studentId, activeSemId]
                );

                if (existing.length === 0) {
                    // Belum ada -> Insert Baru
                    await connection.execute(
                        `INSERT INTO thesis (student_id, semester_id, title, stage_type) VALUES (?, ?, 'Judul Belum Diisi', ?)`,
                        [studentId, activeSemId, stageType]
                    );
                } else {
                    // Sudah ada -> Update Stage Type saja (jika berubah)
                    await connection.execute(
                        `UPDATE thesis SET stage_type = ? WHERE thesis_id = ?`,
                        [stageType, existing[0].thesis_id]
                    );
                }
            } else {
                // DROP: Hapus thesis record di semester ini
                await connection.execute(
                    `DELETE FROM thesis WHERE student_id = ? AND semester_id = ?`,
                    [studentId, activeSemId]
                );
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

    // UPDATE STATUS DOSEN
    static async updateLecturerStatus(lecturerId, accountStatus) {
        const query = `UPDATE users SET status = ? WHERE user_id = ?`;
        await db.execute(query, [accountStatus, lecturerId]);
        return true;
    }

    // CREATE NEW STUDENT
    static async createStudent(data) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Insert ke tabel USERS (Parent)
            // Password default: '123456'
            const [userResult] = await connection.execute(
                `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, '123456', 'student', 'active')`,
                [data.name, data.email]
            );
            const newUserId = userResult.insertId;

            // 2. Insert ke tabel STUDENTS (Child)
            await connection.execute(
                `INSERT INTO students (user_id, npm, cohort_year) VALUES (?, ?, ?)`,
                [newUserId, data.npm, data.cohort_year]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            // Cek duplicate entry error (biasanya email atau npm sama)
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Email atau NPM sudah terdaftar.');
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    // CREATE NEW LECTURER
    static async createLecturer(data) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Insert ke tabel USERS
            const [userResult] = await connection.execute(
                `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, '123456', 'lecturer', 'active')`,
                [data.name, data.email]
            );
            const newUserId = userResult.insertId;

            // 2. Insert ke tabel LECTURERS
            await connection.execute(
                `INSERT INTO lecturers (user_id, nip) VALUES (?, ?)`,
                [newUserId, data.nip]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Email atau NIP sudah terdaftar.');
            }
            throw error;
        } finally {
            connection.release();
        }
    }
}



module.exports = CoordinatorModel;