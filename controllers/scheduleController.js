// controllers/scheduleController.js

const db = require('../config/db');
const ScheduleModel = require('../models/scheduleModel');

// ===== EXISTING FUNCTIONS (TETAP ADA) =====

exports.getStudentSchedules = async (req, res) => {
    const { studentId } = req.params;

    try {
        const schedules = await ScheduleModel.getByStudentId(studentId);

        const formattedData = schedules.map(item => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);

            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = startDate.toLocaleDateString('id-ID', dateOptions);

            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            const startTime = startDate.toLocaleTimeString('id-ID', timeOptions).replace('.', ':');
            const endTime = endDate.toLocaleTimeString('id-ID', timeOptions).replace('.', ':');

            let statusClass = 'status-pending';
            if (item.status === 'approved') statusClass = 'status-approved';
            if (item.status === 'rejected') statusClass = 'status-danger';

            return {
                id: item.id,
                type: item.mode === 'online' ? 'Online' : 'On Site',
                status: mapStatusToLabel(item.status),
                statusClass: statusClass, 
                date: formattedDate,
                time: `${startTime} - ${endTime}`,
                lecturers: item.lecturers ? item.lecturers.split(', ') : [],
                location: item.location,
                link: item.mode === 'online' ? item.location : null,
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
        if (!date || !timeStart || !timeEnd) {
            return res.status(400).json({ success: false, message: 'Data tanggal dan waktu harus lengkap' });
        }

        const newStartObj = new Date(`${date}T${timeStart}`);
        const now = new Date();

        if (newStartObj <= now) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tanggal reschedule harus di masa depan.' 
            });
        }

        const newStartTime = `${date} ${timeStart}:00`;
        const newEndTime = `${date} ${timeEnd}:00`;

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

function mapStatusToLabel(status) {
    switch (status) {
        case 'approved': return 'Telah Disetujui';
        case 'pending': return 'Menunggu Konfirmasi';
        case 'rejected': return 'Ditolak';
        case 'completed': return 'Selesai';
        default: return status;
    }
}

// ===== NEW FUNCTIONS FOR CALENDAR =====

/**
 * Mengambil jadwal kalender untuk mahasiswa
 * Menampilkan ketersediaan dosen (lecturer_schedules) dan appointment yang sudah dibooking
 */
exports.getCalendarSchedules = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'Parameter start_date dan end_date diperlukan'
            });
        }

        // 1. Ambil data mahasiswa untuk mendapatkan pembimbingnya
        const [studentData] = await db.query(`
            SELECT 
                ts.lecturer_id,
                u.name as lecturer_name
            FROM students s
            JOIN thesis t ON s.user_id = t.student_id
            JOIN thesis_supervisors ts ON t.thesis_id = ts.thesis_id
            JOIN users u ON ts.lecturer_id = u.user_id
            WHERE s.user_id = ? AND t.semester_id = (SELECT semester_id FROM semesters WHERE is_active = TRUE LIMIT 1)
        `, [user_id]);

        if (studentData.length === 0) {
            return res.json({
                success: true,
                data: {},
                message: 'Belum ada pembimbing yang ditentukan'
            });
        }

        const lecturerIds = studentData.map(l => l.lecturer_id);

        // 2. Ambil lecturer_schedules (ketersediaan dosen)
        const [lecturerSchedules] = await db.query(`
            SELECT 
                ls.lecturer_sched_id,
                ls.lecturer_id,
                ls.day_of_week,
                ls.start_time,
                ls.end_time,
                ls.description,
                u.name as lecturer_name
            FROM lecturer_schedules ls
            JOIN users u ON ls.lecturer_id = u.user_id
            WHERE ls.lecturer_id IN (?)
                AND ls.is_deleted = FALSE
                AND ls.semester_id = (SELECT semester_id FROM semesters WHERE is_active = TRUE LIMIT 1)
        `, [lecturerIds]);

        // 3. Ambil appointments yang sudah ada
        const [appointments] = await db.query(`
            SELECT 
                a.app_id,
                a.student_id,
                a.start_time,
                a.end_time,
                a.location,
                a.mode,
                a.status,
                a.notes,
                s.user_id as booker_id,
                u.name as booker_name,
                GROUP_CONCAT(ul.name SEPARATOR ', ') as lecturer_names
            FROM appointments a
            JOIN students s ON a.student_id = s.user_id
            JOIN users u ON s.user_id = u.user_id
            JOIN appointment_lecturers al ON a.app_id = al.app_id
            JOIN users ul ON al.lecturer_id = ul.user_id
            WHERE a.start_time >= ? AND a.end_time <= ?
                AND a.is_deleted = FALSE
                AND a.status IN ('pending', 'approved')
            GROUP BY a.app_id
        `, [start_date, end_date]);

        // 4. Generate kalender berdasarkan lecturer_schedules
        const formattedData = {};
        
        // Parse start_date dan end_date
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);

        // Loop setiap hari dalam rentang
        for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

            // Cari lecturer_schedules yang cocok dengan hari ini
            const todaySchedules = lecturerSchedules.filter(ls => ls.day_of_week === dayName);

            todaySchedules.forEach(schedule => {
                if (!formattedData[dateKey]) {
                    formattedData[dateKey] = [];
                }

                // Cek apakah slot ini sudah dibooking
                const existingAppointment = appointments.find(apt => {
                    const aptDate = new Date(apt.start_time).toISOString().split('T')[0];
                    const aptStartTime = new Date(apt.start_time).toTimeString().substring(0, 5);
                    const scheduleStartTime = schedule.start_time.substring(0, 5);
                    
                    return aptDate === dateKey && aptStartTime === scheduleStartTime;
                });

                if (existingAppointment) {
                    // Slot sudah dibooking
                    const isMyBooking = existingAppointment.booker_id == user_id;
                    
                    formattedData[dateKey].push({
                        schedule_id: `apt_${existingAppointment.app_id}`,
                        app_id: existingAppointment.app_id,
                        time: `${new Date(existingAppointment.start_time).toTimeString().substring(0, 5)} - ${new Date(existingAppointment.end_time).toTimeString().substring(0, 5)}`,
                        start_time: new Date(existingAppointment.start_time).toTimeString().substring(0, 8),
                        end_time: new Date(existingAppointment.end_time).toTimeString().substring(0, 8),
                        type: isMyBooking ? 'my-booking' : 'booked',
                        title: isMyBooking ? 'Bimbingan Anda' : existingAppointment.booker_name,
                        lecturer: existingAppointment.lecturer_names,
                        location: existingAppointment.location,
                        link: existingAppointment.mode === 'online' ? existingAppointment.location : null,
                        meeting_type: existingAppointment.mode === 'online' ? 'Online' : 'On Site',
                        notes: existingAppointment.notes,
                        status: existingAppointment.status
                    });
                } else {
                    // Slot available
                    formattedData[dateKey].push({
                        schedule_id: `ls_${schedule.lecturer_sched_id}`,
                        lecturer_sched_id: schedule.lecturer_sched_id,
                        lecturer_id: schedule.lecturer_id,
                        time: `${schedule.start_time.substring(0, 5)} - ${schedule.end_time.substring(0, 5)}`,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time,
                        type: 'available',
                        title: 'Available',
                        lecturer: schedule.lecturer_name,
                        description: schedule.description,
                        meeting_type: null,
                        location: null,
                        link: null,
                        notes: null
                    });
                }
            });
        }

        res.json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error('Error in getCalendarSchedules:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
};

/**
 * Booking slot jadwal bimbingan
 */
exports.bookScheduleSlot = async (req, res) => {
    try {
        const { lecturer_sched_id, student_id, date, notes, mode, location } = req.body;

        // Validasi input
        if (!lecturer_sched_id || !student_id || !date) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap'
            });
        }

        // 1. Ambil data lecturer_schedule
        const [scheduleData] = await db.query(`
            SELECT lecturer_id, start_time, end_time 
            FROM lecturer_schedules 
            WHERE lecturer_sched_id = ? AND is_deleted = FALSE
        `, [lecturer_sched_id]);

        if (scheduleData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Jadwal dosen tidak ditemukan'
            });
        }

        const schedule = scheduleData[0];
        const startDateTime = `${date} ${schedule.start_time}`;
        const endDateTime = `${date} ${schedule.end_time}`;

        // 2. Cek apakah slot sudah dibooking
        const [existingBooking] = await db.query(`
            SELECT app_id FROM appointments 
            WHERE start_time = ? AND end_time = ? AND is_deleted = FALSE
        `, [startDateTime, endDateTime]);

        if (existingBooking.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Slot jadwal sudah dibooking'
            });
        }

        // 3. Insert appointment baru
        const [insertResult] = await db.query(`
            INSERT INTO appointments 
            (student_id, start_time, end_time, location, mode, origin, status, notes)
            VALUES (?, ?, ?, ?, ?, 'student_request', 'pending', ?)
        `, [student_id, startDateTime, endDateTime, location || '', mode || 'offline', notes]);

        const newAppId = insertResult.insertId;

        // 4. Insert ke appointment_lecturers
        await db.query(`
            INSERT INTO appointment_lecturers (app_id, lecturer_id, response_status)
            VALUES (?, ?, 'pending')
        `, [newAppId, schedule.lecturer_id]);

        res.json({
            success: true,
            message: 'Booking berhasil! Menunggu konfirmasi dosen.',
            app_id: newAppId
        });

    } catch (error) {
        console.error('Error in bookScheduleSlot:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
};

/**
 * Cancel booking appointment
 */
exports.cancelBooking = async (req, res) => {
    try {
        const { app_id, student_id } = req.body;

        // Validasi kepemilikan appointment
        const [checkResult] = await db.query(`
            SELECT app_id FROM appointments 
            WHERE app_id = ? AND student_id = ? AND is_deleted = FALSE
        `, [app_id, student_id]);

        if (checkResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment tidak ditemukan atau bukan milik Anda'
            });
        }

        // Soft delete appointment
        await db.query(`
            UPDATE appointments SET is_deleted = TRUE WHERE app_id = ?
        `, [app_id]);

        res.json({
            success: true,
            message: 'Booking berhasil dibatalkan'
        });

    } catch (error) {
        console.error('Error in cancelBooking:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
};