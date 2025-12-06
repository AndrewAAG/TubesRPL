const ProgressModel = require('../models/progressModel');
const db = require('../config/db'); // Import DB untuk query nama user

exports.getStudentProgress = async (req, res) => {
    /*
    const { studentId } = req.params;

    try {
        const [summary, historyData, tasksData] = await Promise.all([
            ProgressModel.getProgressSummary(studentId),
            ProgressModel.getHistory(studentId),
            ProgressModel.getTasks(studentId)
        ]);

        const formattedHistory = historyData.map(item => ({
            date: new Date(item.date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            }),
            topic: item.topic
        }));

        const formattedTasks = tasksData.map(item => ({
            id: item.task_id,
            name: item.name,
            status: item.status === 'in_progress' ? 'In Progress' : 'Pending'
        }));

        res.json({
            success: true,
            data: {
                progress: {
                    status_text: summary.overallStatus,
                    status_color: summary.statusColor,
                    bars: summary.bars,
                },
                history: formattedHistory,
                tasks: formattedTasks
            }
        }); */

        const { studentId } = req.params;

    try {
        // 1. Ambil Data Progress (Existing logic)
        const [summary, historyData, tasksData] = await Promise.all([
            ProgressModel.getProgressSummary(studentId),
            ProgressModel.getHistory(studentId),
            ProgressModel.getTasks(studentId)
        ]);

        // 2. [BARU] Ambil Info Mahasiswa untuk Header Halaman Dosen
        // Query ini aman, jika dipanggil oleh halaman student, data ini dikirim tapi tidak dipakai (tidak error)
        const [userRows] = await db.execute(`
            SELECT u.name, s.npm 
            FROM students s 
            JOIN users u ON s.user_id = u.user_id 
            WHERE s.user_id = ?
        `, [studentId]);
        
        const studentInfo = userRows[0] || { name: 'Unknown', npm: '-' };

        // 3. Formatting Data
        const formattedHistory = historyData.map(item => ({
            date: new Date(item.date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            }),
            topic: item.topic
        }));

        // [PENTING] Mapping Status harus mengakomodir SEMUA kemungkinan
        // Agar halaman Student tetap punya badge warna-warni (Pending/In Progress/Completed)
        const formattedTasks = tasksData.map(item => {
            let statusLabel = 'Pending';
            // Mapping sesuai nilai ENUM database ke Tampilan Frontend
            if (item.status === 'completed') statusLabel = 'Completed';
            else if (item.status === 'in_progress') statusLabel = 'In Progress';
            else statusLabel = 'Pending';

            return {
                id: item.task_id,
                name: item.name,
                status: statusLabel 
            };
        });

        res.json({
            success: true,
            data: {
                student_info: studentInfo, // Tambahan untuk Dosen
                progress: {
                    status_text: summary.overallStatus,
                    status_color: summary.statusColor,
                    bars: summary.bars,
                },
                history: formattedHistory,
                tasks: formattedTasks
            }
        });

    } catch (error) {
        console.error("Progress Error:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat data progress.' });
    }
};