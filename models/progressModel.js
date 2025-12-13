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

            if (infoRows.length === 0) {
                return { 
                    stage: 'Unknown', 
                    overallStatus: 'Data Akademik Belum Lengkap', 
                    statusColor: 'secondary',
                    bars: [] 
                };
            }

            const { stage_type, uts_start_date } = infoRows[0];
            
            // [REVISI] Siapkan variabel waktu untuk logika konteks
            const today = new Date();
            const utsDate = new Date(uts_start_date);
            const isPastUTS = today > utsDate;

            // 2. HITUNG JUMLAH BIMBINGAN
            const [countRows] = await db.execute(`
                SELECT 
                    COUNT(CASE WHEN start_time < ? THEN 1 END) as pre_uts_count,
                    COUNT(*) as total_count
                FROM appointments 
                WHERE student_id = ? AND status = 'completed' AND is_deleted = FALSE
            `, [uts_start_date, studentId]);

            const preUtsCount = parseInt(countRows[0].pre_uts_count) || 0;
            const totalCount = parseInt(countRows[0].total_count) || 0;

            // 3. LOGIKA PENENTUAN SYARAT (REVISI LOGIC)
            let targetPre, targetTotal;
            let barConfigs = [];
            
            // Default Status
            let overallStatus = 'Belum Memenuhi Target';
            let statusColor = 'warning'; // Default Kuning

            // Set Target Berdasarkan Tipe TA
            if (stage_type === 'TA1') {
                targetPre = 2; targetTotal = 4;
            } else if (stage_type === 'TA2') {
                targetPre = 3; targetTotal = 6;
            } else { // Double
                targetPre = 4; targetTotal = 10;
            }

            // --- [INTI PERBAIKAN LOGIKA] ---

            // KONDISI 1: SUDAH SIAP SIDANG (SEMPURNA)
            // Syarat: Pre terpenuhi DAN Total terpenuhi
            if (preUtsCount >= targetPre && totalCount >= targetTotal) {
                overallStatus = 'Siap Sidang (Memenuhi Syarat)';
                statusColor = 'success'; // Hijau
            }
            
            // KONDISI 2: ON TRACK / IDEAL (SUDAH LEWAT UTS)
            // Syarat: Hari ini lewat UTS, Pre terpenuhi, TAPI Total belum sampai.
            // Ini kondisi "Mahasiswa Ideal" yang sedang mengejar UAS.
            else if (isPastUTS && preUtsCount >= targetPre) {
                overallStatus = 'On Track (Target UTS Terpenuhi)';
                statusColor = 'primary'; // Biru (Menandakan progres bagus, tapi belum finish)
            }

            // KONDISI 3: KRITIS (GAGAL SYARAT PRE-UTS)
            // Syarat: Hari ini lewat UTS, TAPI Pre-UTS kurang.
            // Tidak peduli totalnya berapa, jika pre-UTS kurang saat UTS sudah lewat, dia gagal.
            else if (isPastUTS && preUtsCount < targetPre) {
                overallStatus = 'Tidak Lulus (Kurang Bimbingan Pre-UTS)';
                statusColor = 'danger'; // Merah
            }

            // KONDISI 4: MASIH MENGEJAR UTS (SEBELUM UTS)
            // Syarat: Hari ini belum UTS. Status tetap warning (kuning) karena belum ada yang final.
            else if (!isPastUTS) {
                overallStatus = 'Sedang Berjalan (Mengejar UTS)';
                statusColor = 'warning'; 
            }

            // --- KONFIGURASI BAR CHART ---
            if (stage_type !== 'Double') {
                barConfigs.push({
                    label: `Progress ${stage_type}`,
                    current: totalCount,
                    target: targetTotal,
                    percent: Math.min((totalCount / targetTotal) * 100, 100)
                });
            } else {
                // Double TA (Split Bar)
                barConfigs.push({
                    label: 'Tahap 1 (Target UTS)',
                    current: preUtsCount,
                    target: 4,
                    percent: Math.min((preUtsCount / 4) * 100, 100)
                });
                barConfigs.push({
                    label: 'Tahap 2 (Target UAS)',
                    current: totalCount,
                    target: 10,
                    percent: Math.min((totalCount / 10) * 100, 100)
                });
            }

            return {
                overallStatus,
                statusColor,
                bars: barConfigs,
                debug: { pre: preUtsCount, total: totalCount, type: stage_type, isPastUTS } 
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