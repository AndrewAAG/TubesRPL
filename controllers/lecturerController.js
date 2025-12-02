const LecturerModel = require('../models/lecturerModel');

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