const LecturerModel = require('../models/lecturerModel');
const ScheduleModel = require('../models/scheduleModel');
const ProgressModel = require('../models/progressModel');


// Ambil List Mahasiswa untuk Dropdown
exports.getMyStudents = async (req, res) => {
    try {
        const students = await LecturerModel.getMyStudents(req.params.lecturerId);
        res.json({ success: true, data: students });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Ambil Jadwal
exports.getSchedules = async (req, res) => {
    const { lecturerId } = req.params;
    const { studentId } = req.query; // Filter dari dropdown frontend

    try {
        const schedules = await LecturerModel.getSchedules(lecturerId, studentId);
        
        // Formatting Data
        const formatted = schedules.map(item => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);
            
            return {
                id: item.id,
                student_name: item.student_name,
                npm: item.npm,
                date: startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                time: `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}`,
                type: item.mode === 'online' ? 'Online' : 'On Site',
                location: item.location,
                status: item.status,
                // Status CSS Class
                statusClass: item.status === 'approved' ? 'status-approved' : (item.status === 'pending' ? 'status-pending' : 'text-danger'),
                link: item.mode === 'online' ? item.location : null
            };
        });

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPendingRequests = async (req, res) => {
    const { lecturerId } = req.params;
    try {
        const requests = await ScheduleModel.getPendingByLecturer(lecturerId);
        
        // Formatting Data
        const formattedData = requests.map(item => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);
            
            return {
                ...item,
                date_formatted: startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                time_formatted: `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}`
            };
        });

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.respondToRequest = async (req, res) => {
    const { id } = req.params; // app_id
    const { action, reason } = req.body; // action: 'approve' | 'reject'

    try {
        let status = action === 'approve' ? 'approved' : 'rejected';
        await ScheduleModel.updateStatus(id, status, reason);
        res.json({ success: true, message: `Bimbingan berhasil di-${action}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses request' });
    }
};

exports.getStudentList = async (req, res) => {
    const { lecturerId } = req.params;

    if (!lecturerId) {
        return res.status(400).json({ success: false, message: 'ID Dosen tidak ditemukan.' });
    }

    try {
        // 1. AMBIL DATA DARI MODEL (Tidak perlu raw SQL lagi di sini)
        // Method ini sudah mengembalikan: student_id, npm, name, stage_type, last_mentoring
        const students = await LecturerModel.getSupervisedStudents(lecturerId);

        if (students.length === 0) {
             return res.json({ success: true, data: [] });
        }

        // 2. HITUNG PROGRESS & STATUS (Logic Eligibility)
        // Kita tetap memanggil ProgressModel untuk mendapatkan logika warna (Merah/Biru/Hijau)
        const detailedStudents = await Promise.all(students.map(async (s) => {
            
            // Panggil ProgressModel untuk menentukan status kelulusan
            const progress = await ProgressModel.getProgressSummary(s.student_id);

            // Format Tanggal Bimbingan Terakhir
            let lastMentoring = '-';
            if (s.last_mentoring) {
                const d = new Date(s.last_mentoring);
                lastMentoring = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            return {
                student_id: s.student_id,
                name: s.name,
                npm: s.npm,
                stage: s.stage_type, // Sesuai kolom di LecturerModel
                last_mentoring: lastMentoring,
                
                // Ambil hasil perhitungan cerdas dari ProgressModel
                status_label: progress.overallStatus, 
                status_color: progress.statusColor    
            };
        }));

        res.json({ success: true, data: detailedStudents });

    } catch (error) {
        console.error("Get Student List Error:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getStudentSupervisors = async (req, res) => {
    try {
        const { studentId } = req.params;
        const supervisors = await LecturerModel.getStudentSupervisors(studentId);
        res.json({ success: true, data: supervisors });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};