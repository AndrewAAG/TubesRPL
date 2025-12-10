const ScheduleModel = require('../models/scheduleModel');
const NotificationModel = require('../models/notificationModel'); 
const db = require('../config/db'); 

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
                canReschedule: item.status === 'pending' || item.status === 'approved',
                timestamp: item.start_time,
                lecturer_ids_str: item.lecturer_ids
            };
        });

        res.json({ success: true, data: formattedData });

    } catch (error) {
        console.error("Schedule Error:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil jadwal.' });
    }
};

exports.rescheduleAppointment = async (req, res) => {
    const { id } = req.params; // app_id
    // triggerBy = 'student' karena ini fitur mahasiswa
    const { date, timeRange, reason, userId } = req.body; 

    try {
        // 1. Parsing Waktu (Format "13.00 - 14.00")
        const [startStr, endStr] = timeRange.split(' - ');
        const newStartTime = `${date} ${startStr.replace('.', ':')}:00`;
        const newEndTime = `${date} ${endStr.replace('.', ':')}:00`;

        // Validasi Masa Depan
        if (new Date(newStartTime) <= new Date()) {
            return res.status(400).json({ success: false, message: 'Waktu baru harus di masa depan.' });
        }

        // 2. UPDATE DATABASE
        await ScheduleModel.reschedule(id, newStartTime, newEndTime, reason);

        // --- 3. NOTIFIKASI KE DOSEN ---
        // Ambil data appointment untuk info notifikasi
        const [apptData] = await db.execute(`
            SELECT 
                a.student_id, 
                u.name as mhs_name
            FROM appointments a
            JOIN users u ON a.student_id = u.user_id
            WHERE a.app_id = ?
        `, [id]);

        // Ambil ID semua dosen terkait appointment ini
        const lecturerIds = await ScheduleModel.getLecturerIdsByAppId(id);

        if (apptData.length > 0 && lecturerIds.length > 0) {
            const mhsName = apptData[0].mhs_name;
            const notifTitle = "Permintaan Reschedule 📅";
            const notifMsg = `${mhsName} mengajukan perubahan jadwal ke tanggal ${date} (${timeRange}). Alasan: ${reason}`;
            
            // Kirim notifikasi ke semua dosen pembimbing terkait
            await NotificationModel.createBulk(lecturerIds, notifTitle, notifMsg, "Info Sistem");
        }

        res.json({ success: true, message: 'Jadwal berhasil di-reschedule. Menunggu persetujuan ulang dosen.' });

    } catch (error) {
        console.error("Reschedule Error:", error);
        res.status(500).json({ success: false, message: 'Gagal melakukan reschedule.' });
    }
};

exports.getPendingRequests = async (req, res) => {
    const { lecturerId } = req.params;
    try {
        const requests = await ScheduleModel.getPendingByLecturer(lecturerId);
        
        // Format data agar enak dibaca Frontend
        const formattedData = requests.map(item => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);
            
            // Format: "Rabu, 8 Oktober 2025"
            const dateStr = startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            // Format: "10.00 - 11.00"
            const timeStr = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}`;

            return {
                id: item.id,
                student_name: item.student_name,
                npm: item.npm,
                date_formatted: dateStr,
                time_formatted: timeStr.replace(/\./g, '.'), // pastikan format titik
                topic: item.topic,
                location: item.location,
                mode: item.mode === 'online' ? 'Online' : 'On Site',
                stage: item.stage_type || 'TA' // Default jika null
            };
        });

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error("Error pending requests:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


exports.respondToRequest = async (req, res) => {
    const { id } = req.params; // app_id
    const { action, reason, lecturerId } = req.body; 

    // Debugging untuk memastikan ID Dosen masuk
    console.log(`[DEBUG] Respon Dosen ${lecturerId} -> Action: ${action}`);

    try {
        const individualStatus = action === 'approve' ? 'accepted' : 'rejected';
        
        // LANGKAH 1: Update HANYA respon dosen tersebut (Tabel Pivot)
        // Global status di tabel 'appointments' MASIH PENDING
        await ScheduleModel.updateLecturerResponse(id, lecturerId, individualStatus);

        // LANGKAH 2: Ambil semua respon dosen untuk appointment ini
        const allResponses = await ScheduleModel.getAppointmentResponses(id);
        
        console.log("[DEBUG] Status Total:", allResponses); 

        // LANGKAH 3: Hitung Logika Keputusan
        // Cek 1: Apakah ada yang reject? (Satu reject = Batal Semua)
        const isAnyRejected = allResponses.some(r => r.response_status === 'rejected');
        
        // Cek 2: Apakah semua sudah accept?
        const isAllAccepted = allResponses.every(r => r.response_status === 'accepted');

        let finalStatus = 'pending'; // Default tetap pending

        if (isAnyRejected) {
            finalStatus = 'rejected';
        } else if (isAllAccepted) {
            finalStatus = 'approved';
        }

        // LANGKAH 4: Eksekusi Perubahan Global (Hanya jika status berubah dari pending)
        if (finalStatus !== 'pending') {
            console.log(`[DEBUG] Keputusan Final Tercapai: ${finalStatus}`);
            
            // Update Tabel Utama 'appointments'
            await ScheduleModel.updateGlobalStatus(id, finalStatus, reason);

            // --- KIRIM NOTIFIKASI FINAL KE MAHASISWA ---
            // Ambil data untuk notifikasi
            const [rows] = await db.execute(`
                SELECT a.student_id, a.start_time 
                FROM appointments a WHERE a.app_id = ?
            `, [id]);

            if (rows.length > 0) {
                const data = rows[0];
                const dateStr = new Date(data.start_time).toLocaleDateString('id-ID');
                let title = "", message = "";

                if (finalStatus === 'approved') {
                    title = "Jadwal Disetujui (Final) ✅";
                    message = `Seluruh pembimbing telah MENYETUJUI jadwal bimbingan pada tanggal ${dateStr}.`;
                } else {
                    title = "Jadwal Ditolak ❌";
                    message = `Salah satu pembimbing tidak dapat hadir pada jadwal ${dateStr}.`;
                }

                await NotificationModel.createBulk([data.student_id], title, message, "Sistem Jadwal");
            }

            res.json({ success: true, message: `Keputusan Final: ${finalStatus}` });
        } else {
            // Jika masih pending
            console.log("[DEBUG] Masih menunggu dosen lain.");
            res.json({ success: true, message: 'Respon tercatat. Menunggu dosen lain.' });
        }

    } catch (error) {
        console.error("Error respond:", error);
        res.status(500).json({ success: false, message: 'Gagal memproses respon.' });
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

exports.getClassSchedule = async (req, res) => {
    try {
        const { studentId } = req.params;
        const data = await ScheduleModel.getStudentClassSchedule(studentId);
        
        // Mapping Hari Inggris -> Indo
        const dayMap = { 'Monday':'Senin', 'Tuesday':'Selasa', 'Wednesday':'Rabu', 'Thursday':'Kamis', 'Friday':'Jumat', 'Saturday':'Sabtu', 'Sunday':'Minggu' };
        
        const formatted = data.map(d => ({
            id: d.student_sched_id,
            day: dayMap[d.day_of_week], // Ke Indo
            course: d.course_name || 'Kuliah',
            start: d.start_time.substring(0, 5), // Ambil HH:mm
            end: d.end_time.substring(0, 5)
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// POST: Simpan Jadwal (Dari Input Manual/CSV Preview)
exports.saveClassSchedule = async (req, res) => {
    try {
        const { studentId, schedules } = req.body; 
        // schedules array: [{day: 'Senin', course: '...', start: '07:00', end: '10:00'}, ...]

        // Mapping Hari Indo -> Inggris untuk DB
        const dayMap = { 'Senin':'Monday', 'Selasa':'Tuesday', 'Rabu':'Wednesday', 'Kamis':'Thursday', 'Jumat':'Friday', 'Sabtu':'Saturday', 'Minggu':'Sunday' };

        const dbSchedules = schedules.map(s => ({
            day: dayMap[s.day] || 'Monday',
            course: s.course,
            start: s.start,
            end: s.end
        }));

        await ScheduleModel.replaceStudentSchedule(studentId, dbSchedules);
        res.json({ success: true, message: 'Jadwal berhasil disimpan!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan jadwal.' });
    }
};


exports.getAvailableSlots = async (req, res) => {
    // 1. Terima Parameter
    const { lecturerIds, studentId, date } = req.query;

    try {
        // Validasi Input
        if (!lecturerIds || !studentId || !date) {
            return res.status(400).json({ success: false, message: 'Parameter tidak lengkap.' });
        }

        // 2. Persiapan Waktu
        const dateObj = new Date(date);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[dateObj.getDay()];

        // Blokir Hari Minggu
        if (dayOfWeek === 'Sunday') {
            return res.json({ success: true, data: [], message: 'Hari Minggu libur.' });
        }

        const lecIdArray = lecturerIds.toString().split(',').map(Number);

        // 3. FETCH DATA BLOCKERS (PENGHALANG)
        // Kita ambil semua kemungkinan penghalang: Jadwal Dosen DAN Jadwal Mahasiswa
        
        // A. Dosen (Sibuk & Appt Existing)
        const lecturerBusyPromises = lecIdArray.map(id => ScheduleModel.getLecturerBusySchedules(id, dayOfWeek));
        const lecturerApptPromises = lecIdArray.map(id => ScheduleModel.getExistingAppointments(id, 'lecturer', date));

        // B. Mahasiswa (Kuliah Rutin & Appt Existing)
        const studentClassPromise = ScheduleModel.getStudentClassSchedule(studentId, dayOfWeek);
        const studentApptPromise = ScheduleModel.getExistingAppointments(studentId, 'student', date);

        // TUNGGU SEMUA DATA
        const [
            lecturerBusyResults,    // Array of Arrays
            lecturerApptResults,    // Array of Arrays
            studentClasses,         // Array (Jadwal Kuliah Mahasiswa)
            studentAppts            // Array (Janji Lain Mahasiswa)
        ] = await Promise.all([
            Promise.all(lecturerBusyPromises),
            Promise.all(lecturerApptPromises),
            studentClassPromise,
            studentApptPromise
        ]);

        // 4. GENERATE SLOT
        const START_HOUR = 7; 
        const END_HOUR = 17; 
        const SLOT_DURATION = 60; // Menit
        
        let availableSlots = [];

        // Helper: Format Waktu
        const toMinutes = (timeInput) => {
            if(!timeInput) return 0;
            if (typeof timeInput === 'object') return timeInput.getHours() * 60 + timeInput.getMinutes();
            const [h, m] = timeInput.split(':').map(Number);
            return h * 60 + m;
        };

        const toTimeStr = (minutes) => {
            const h = Math.floor(minutes / 60).toString().padStart(2, '0');
            const m = (minutes % 60).toString().padStart(2, '0');
            return `${h}.${m}`;
        };

        // LOOPING SLOT PER JAM (07:00 - 17:00)
        for (let h = START_HOUR; h < END_HOUR; h++) {
            const slotStart = h * 60; 
            const slotEnd = slotStart + SLOT_DURATION;
            let isConflict = false;

            // --- [CRITICAL CHECK 1] CEK JADWAL MAHASISWA DULU ---
            // Gabungkan Kuliah + Janji Lain Mahasiswa
            const allStudentBlockers = [...studentClasses, ...studentAppts];
            
            for (let block of allStudentBlockers) {
                const bStart = toMinutes(block.start_time);
                const bEnd = toMinutes(block.end_time);
                
                // Jika Slot ini bertabrakan dengan jadwal mahasiswa -> CONFLICT!
                if (slotStart < bEnd && slotEnd > bStart) { 
                    isConflict = true; 
                    break; // Langsung stop, tidak perlu cek dosen lagi
                }
            }

            // --- [CRITICAL CHECK 2] CEK JADWAL SEMUA DOSEN ---
            // Hanya dijalankan jika mahasiswa kosong di jam tersebut
            if (!isConflict) {
                for (let i = 0; i < lecIdArray.length; i++) {
                    const thisLecturerBlockers = [
                        ...lecturerBusyResults[i], 
                        ...lecturerApptResults[i]  
                    ];

                    for (let block of thisLecturerBlockers) {
                        const bStart = toMinutes(block.start_time);
                        const bEnd = toMinutes(block.end_time);
                        
                        // Jika Dosen Sibuk -> CONFLICT!
                        if (slotStart < bEnd && slotEnd > bStart) { 
                            isConflict = true; 
                            break; 
                        }
                    }
                    if (isConflict) break; // Jika salah satu dosen sibuk, slot batal
                }
            }

            // Jika Lolos Semua Cek -> Slot Available
            if (!isConflict) {
                availableSlots.push({
                    value: `${toTimeStr(slotStart)} - ${toTimeStr(slotEnd)}`,
                    start: toTimeStr(slotStart),
                    end: toTimeStr(slotEnd)
                });
            }
        }

        res.json({ success: true, data: availableSlots });

    } catch (error) {
        console.error("Available Slots Error:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat slot.' });
    }
};


exports.submitRequest = async (req, res) => {
    try {

        const { studentId, lecturerIds, date, timeRange, mode, location, notes } = req.body;

        // [DEBUG] Cek apa yang dikirim Frontend
        console.log("Submit Request Body:", req.body);

        // Pastikan lecturerIds diubah menjadi Array Angka yang Valid
        // Frontend mengirim string "1,2" -> Split jadi array [1, 2]
        const lecIdArray = lecturerIds.toString().split(',').map(item => parseInt(item.trim()));

        console.log("Array Dosen yang akan disimpan:", lecIdArray); // Harusnya [1, 2] jika gabung
        // Parse timeRange "13.00 - 14.00" -> start & end

        const [startStr, endStr] = timeRange.split(' - ');
        const startDateTime = `${date} ${startStr.replace('.', ':')}:00`;
        const endDateTime = `${date} ${endStr.replace('.', ':')}:00`;


        // Simpan ke DB
        const appId = await ScheduleModel.createRequest({
            studentId, 
            lecturerIds: lecIdArray, // Array ini masuk ke loop di Model
            startTime: startDateTime, 
            endTime: endDateTime,
            mode, location, notes
        });

        // ... (Kode notifikasi trigger di sini, tetap sama) ...
        // Untuk memastikan notifikasi "Request Baru" terkirim:
        await NotificationModel.createBulk(lecIdArray, "Pengajuan Bimbingan Baru", "Mahasiswa mengajukan bimbingan.", "Info Sistem");

        res.json({ success: true, message: 'Pengajuan berhasil dikirim!' });

    } catch (error) {
        console.error("Submit Error:", error);
        res.status(500).json({ success: false, message: 'Gagal submit.' });
    }
};

exports.getMySupervisors = async (req, res) => {
    try {
        const { studentId } = req.params;
        const supervisors = await ScheduleModel.getSupervisorsByStudentId(studentId);
        
        if (supervisors.length === 0) {
            return res.json({ success: true, data: [], message: 'Belum ada pembimbing.' });
        }

        res.json({ success: true, data: supervisors });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};