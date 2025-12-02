const db = require('../config/db');

class ProgressModel {
    static async getProgressSummary(studentId) {
        try {
            // 1. AMBIL INFO TAHAP TA & JADWAL SEMESTER AKTIF
            const [infoRows] = await db.execute(`
                SELECT 
                    t.stage_type,
                    s.uts_start_date
                FROM thesis t
                JOIN semesters s ON t.semester_id = s.semester_id
                WHERE t.student_id = ? AND s.is_active = TRUE
                LIMIT 1
            `, [studentId]);

            // Default jika data belum lengkap (misal mahasiswa belum ambil tesis)
            if (infoRows.length === 0) {
                return { 
                    stage: 'Unknown', 
                    overallStatus: 'Data Akademik Belum Lengkap', 
                    statusColor: 'secondary',
                    bars: [] 
                };
            }

            const { stage_type, uts_start_date } = infoRows[0];

            // 2. HITUNG JUMLAH BIMBINGAN (Pre-UTS & Total)
            // Query ini menghitung bimbingan yang statusnya 'completed' saja
            const [countRows] = await db.execute(`
                SELECT 
                    COUNT(CASE WHEN start_time < ? THEN 1 END) as pre_uts_count,
                    COUNT(*) as total_count
                FROM appointments 
                WHERE student_id = ? AND status = 'completed' AND is_deleted = FALSE
            `, [uts_start_date, studentId]);

            const preUtsCount = parseInt(countRows[0].pre_uts_count) || 0;
            const totalCount = parseInt(countRows[0].total_count) || 0;

            // 3. LOGIKA PENENTUAN SYARAT (RULE BASE)
            let targetPre, targetTotal;
            let barConfigs = [];
            let overallStatus = 'Belum Memenuhi';
            let statusColor = 'warning'; // Default kuning

            // --- LOGIC: TA1 ---
            if (stage_type === 'TA1') {
                targetPre = 2; 
                targetTotal = 4; // 2 Pre + 2 Post = 4 Total

                // Syarat: Pre >= 2 DAN Total >= 4
                if (preUtsCount >= targetPre && totalCount >= targetTotal) {
                    overallStatus = 'Memenuhi Syarat';
                    statusColor = 'success';
                }

                barConfigs.push({
                    label: 'Progress TA1',
                    current: totalCount,
                    target: targetTotal,
                    percent: Math.min((totalCount / targetTotal) * 100, 100)
                });

            // --- LOGIC: TA2 ---
            } else if (stage_type === 'TA2') {
                targetPre = 3;
                targetTotal = 6; // 3 Pre + 3 Post = 6 Total

                if (preUtsCount >= targetPre && totalCount >= targetTotal) {
                    overallStatus = 'Memenuhi Syarat';
                    statusColor = 'success';
                }

                barConfigs.push({
                    label: 'Progress TA2',
                    current: totalCount,
                    target: targetTotal,
                    percent: Math.min((totalCount / targetTotal) * 100, 100)
                });

            // --- LOGIC: DOUBLE TA (TA1 & TA2) ---
            } else { 
                targetPre = 4;   // Syarat Pre-UTS (TA1 harus selesai)
                targetTotal = 10; // Syarat Total (TA1(4) + TA2(6) = 10)

                if (preUtsCount >= targetPre && totalCount >= targetTotal) {
                    overallStatus = 'Memenuhi Syarat';
                    statusColor = 'success';
                }

                // Bar 1: Mengejar target Pre-UTS (Target 4)
                barConfigs.push({
                    label: 'Tahap 1 (Target UTS)',
                    current: preUtsCount, 
                    target: 4,
                    percent: Math.min((preUtsCount / 4) * 100, 100)
                });

                // Bar 2: Mengejar target Total (Target 10)
                barConfigs.push({
                    label: 'Tahap 2 (Target UAS)',
                    current: totalCount,
                    target: 10,
                    percent: Math.min((totalCount / 10) * 100, 100)
                });
            }

            // Jika status masih Warning tapi Total sudah cukup, berarti kurang di Pre-UTS
            // Kita bisa ubah statusnya jadi Merah (Gagal) karena Pre-UTS tidak bisa diulang
            if (statusColor === 'warning' && totalCount >= targetTotal && preUtsCount < targetPre) {
                // Cek apakah hari ini sudah lewat UTS?
                const today = new Date();
                const utsDate = new Date(uts_start_date);
                
                if (today > utsDate) {
                    overallStatus = 'Tidak Lulus (Kurang Bimbingan Pre-UTS)';
                    statusColor = 'danger';
                }
            }

            return {
                overallStatus,
                statusColor,
                bars: barConfigs,
                debug: { pre: preUtsCount, total: totalCount, type: stage_type } // Untuk cek di console
            };

        } catch (error) {
            throw error;
        }
    }

    static async getHistory(studentId) {
        try {
            const query = `
                SELECT 
                    a.start_time as date,
                    COALESCE(sn.summary, a.notes, 'Tidak ada catatan') as topic
                FROM appointments a
                LEFT JOIN session_notes sn ON a.app_id = sn.app_id
                WHERE a.student_id = ? AND a.status = 'completed' AND a.is_deleted = FALSE
                ORDER BY a.start_time DESC
            `;
            const [rows] = await db.execute(query, [studentId]);
            return rows;
        } catch (error) { throw error; }
    }

    // FIX: Menggunakan DISTINCT agar tugas tidak duplikat
    static async getTasks(studentId) {
        try {
            const query = `
                SELECT DISTINCT
                    st.task_id,
                    st.description as name,
                    st.status,
                    st.due_date
                FROM session_tasks st
                JOIN appointments a ON st.app_id = a.app_id
                WHERE a.student_id = ? 
                  AND st.status != 'completed'
                  AND a.is_deleted = FALSE
                ORDER BY st.due_date ASC
            `;
            const [rows] = await db.execute(query, [studentId]);
            return rows;
        } catch (error) { throw error; }
    }
}

module.exports = ProgressModel;