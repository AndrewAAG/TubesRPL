const CoordinatorModel = require('../models/coordinatorModel');

exports.getSemesters = async (req, res) => {
    try {
        const data = await CoordinatorModel.getAllSemesters();
        
        // Format tanggal untuk Frontend
        const formatted = data.map(s => ({
            ...s,
            start_date_fmt: new Date(s.start_date).toISOString().split('T')[0],
            end_date_fmt: new Date(s.end_date).toISOString().split('T')[0],
            // Format untuk tampilan tabel (Indonesia)
            period_display: `${new Date(s.start_date).toLocaleDateString('id-ID')} - ${new Date(s.end_date).toLocaleDateString('id-ID')}`
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.saveSemester = async (req, res) => {
    try {
        const { id, name, year, start_date, end_date, uts_start, uts_end, uas_start, uas_end, min_ta1, min_ta2, is_active } = req.body;
        
        const data = {
            name, year, start_date, end_date, 
            uts_start, uts_end, uas_start, uas_end, 
            min_ta1: parseInt(min_ta1), min_ta2: parseInt(min_ta2), 
            is_active: is_active ? 1 : 0
        };

        if (id) {
            await CoordinatorModel.updateSemester(id, data);
        } else {
            await CoordinatorModel.createSemester(data);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan data' });
    }
};

exports.deleteSemester = async (req, res) => {
    try {
        await CoordinatorModel.deleteSemester(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus (Mungkin data sedang digunakan)' });
    }
};

exports.setActiveSemester = async (req, res) => {
    try {
        await CoordinatorModel.setActive(req.body.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate status' });
    }
};

exports.getAssignments = async (req, res) => {
    try {
        // Destructuring hasil return baru
        const { semesterName, students } = await CoordinatorModel.getAssignmentData();
        const lecturers = await CoordinatorModel.getAllLecturers();

        // Format data tabel (Tetap sama)
        const formattedData = students.map((s, index) => {
            let lecturerNames = [];
            if (s.p1) lecturerNames.push(s.p1.name);
            if (s.p2) lecturerNames.push(s.p2.name);
            
            return {
                no: index + 1,
                thesis_id: s.thesis_id,
                npm: s.npm,
                name: s.student_name,
                stage: s.stage_type,
                lecturer_display: lecturerNames.length > 0 ? lecturerNames.join(', ') : '-',
                p1_id: s.p1 ? s.p1.lecturer_id : '', 
                p2_id: s.p2 ? s.p2.lecturer_id : ''
            };
        });

        res.json({ 
            success: true, 
            data: { 
                active_semester: semesterName, // <--- Kirim ke Frontend
                students: formattedData, 
                lecturers: lecturers 
            } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.saveAssignment = async (req, res) => {
    try {
        const { thesisId, p1Id, p2Id } = req.body;
        
        // Validasi sederhana: P1 dan P2 tidak boleh orang yang sama
        if (p1Id && p2Id && p1Id == p2Id) {
            return res.status(400).json({ success: false, message: 'Pembimbing 1 dan 2 tidak boleh sama.' });
        }

        await CoordinatorModel.updateAssignment(thesisId, p1Id, p2Id);
        res.json({ success: true, message: 'Pembimbing berhasil ditetapkan.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan data.' });
    }
};

exports.getUsersData = async (req, res) => {
    try {
        const [students, lecturers] = await Promise.all([
            CoordinatorModel.getAllStudentsExtended(),
            CoordinatorModel.getAllLecturersExtended()
        ]);

        res.json({ success: true, data: { students, lecturers } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { studentId, status, isTakingTa, stage } = req.body;
        // isTakingTa dikirim sebagai boolean true/false
        await CoordinatorModel.updateStudentStatus(studentId, status, isTakingTa, stage);
        res.json({ success: true, message: 'Data mahasiswa diperbarui.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal update data.' });
    }
};

exports.updateLecturer = async (req, res) => {
    try {
        const { lecturerId, status } = req.body;
        await CoordinatorModel.updateLecturerStatus(lecturerId, status);
        res.json({ success: true, message: 'Data dosen diperbarui.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal update data.' });
    }
};

exports.createStudent = async (req, res) => {
    try {
        const { name, email, npm, cohort_year } = req.body;
        
        // Validasi sederhana
        if (!name || !email || !npm || !cohort_year) {
            return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
        }

        await CoordinatorModel.createStudent({ name, email, npm, cohort_year });
        res.json({ success: true, message: 'Mahasiswa berhasil ditambahkan.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Gagal membuat akun.' });
    }
};

exports.createLecturer = async (req, res) => {
    try {
        const { name, email, nip } = req.body;

        if (!name || !email || !nip) {
            return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
        }

        await CoordinatorModel.createLecturer({ name, email, nip });
        res.json({ success: true, message: 'Dosen berhasil ditambahkan.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Gagal membuat akun.' });
    }
};