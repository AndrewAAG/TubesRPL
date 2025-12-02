const ScheduleModel = require('../models/scheduleModel');

exports.getStudentSchedules = async (req, res) => {
    const { studentId } = req.params; // ambil ID dari URL

    try {
        const schedules = await ScheduleModel.getByStudentId(studentId);

        // Format data agar sesuai dengan struktur JSON yang diharapkan Frontend
        const formattedData = schedules.map(item => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);

            // Helper untuk format Tanggal (Contoh: "Rabu, 8 Oktober 2025")
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = startDate.toLocaleDateString('id-ID', dateOptions);

            // Helper untuk format Jam (Contoh: "08.00 - 10.00")
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            const startTime = startDate.toLocaleTimeString('id-ID', timeOptions).replace('.', ':');
            const endTime = endDate.toLocaleTimeString('id-ID', timeOptions).replace('.', ':');

            // Tentukan Class CSS berdasarkan status
            let statusClass = 'status-pending'; // Default kuning
            if (item.status === 'approved') statusClass = 'status-approved';
            if (item.status === 'rejected') statusClass = 'status-danger';

            return {
                id: item.id,
                type: item.mode === 'online' ? 'Online' : 'On Site',
                status: mapStatusToLabel(item.status), // Fungsi helper bawah
                statusClass: statusClass, 
                date: formattedDate,
                time: `${startTime} - ${endTime}`,
                lecturers: item.lecturers ? item.lecturers.split(', ') : [],
                location: item.location,
                link: item.mode === 'online' ? item.location : null, // Asumsi lokasi diisi link jika online
                notes: item.notes,
                canReschedule: item.status === 'pending' || item.status === 'approved'
            };
        });

        res.json({ success: true, data: formattedData });

    } catch (error) {
        console.error("Schedule Error:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil jadwal.' });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    const { id } = req.params; 
    const { date, timeStart, timeEnd, reason } = req.body; 

    try {
        // 1. VALIDASI INPUT
        if (!date || !timeStart || !timeEnd) {
            return res.status(400).json({ success: false, message: 'Data tanggal dan waktu harus lengkap' });
        }

        // 2. VALIDASI WAKTU (Tidak Boleh Masa Lalu)
        const newStartObj = new Date(`${date}T${timeStart}`);
        const now = new Date();

        if (newStartObj <= now) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tanggal reschedule harus di masa depan.' 
            });
        }

        // 3. SIAPKAN DATA UNTUK MODEL
        const newStartTime = `${date} ${timeStart}:00`;
        const newEndTime = `${date} ${timeEnd}:00`;

        // 4. JALANKAN UPDATE DI MODEL
        const result = await ScheduleModel.reschedule(id, newStartTime, newEndTime, reason);

        if (result) {
            res.json({ success: true, message: 'Jadwal berhasil diubah dan status kembali menjadi Pending.' });
        } else {
            res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
        }

    } catch (error) {
        console.error("Reschedule Error:", error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat reschedule.' });
    }
};

// Translate status DB ke Bahasa Indonesia
function mapStatusToLabel(status) {
    switch (status) {
        case 'approved': return 'Telah Disetujui';
        case 'pending': return 'Menunggu Konfirmasi';
        case 'rejected': return 'Ditolak';
        case 'completed': return 'Selesai';
        default: return status;
    }
}