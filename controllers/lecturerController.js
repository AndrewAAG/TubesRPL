const LecturerModel = require('../models/lecturerModel');
const ScheduleModel = require('../models/scheduleModel');

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
    try {
        const { lecturerId } = req.params;
        const students = await LecturerModel.getSupervisedStudents(lecturerId);

        const formattedData = students.map(s => {
            // 1. Format Tanggal
            let lastDate = '-';
            if (s.last_mentoring) {
                lastDate = new Date(s.last_mentoring).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                });
            }

            // 2. Logic Status Kelayakan (Sederhana)
            // Rule: TA1 butuh min 4x, TA2 butuh min 6x (sesuai requirement awal)
            let isEligible = false;
            let minReq = s.stage_type === 'TA2' ? 6 : 4;
            
            if (s.total_count >= minReq) isEligible = true;

            return {
                student_id: s.student_id,
                name: s.name,
                npm: s.npm,
                stage: s.stage_type, // TA1 atau TA2
                last_mentoring: lastDate,
                total_count: s.total_count,
                status_label: isEligible ? 'Memenuhi Syarat' : 'Belum Memenuhi',
                status_class: isEligible ? 'status-approved' : 'status-pending' // Hijau vs Kuning
            };
        });

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};