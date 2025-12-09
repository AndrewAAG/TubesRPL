const EvaluationModel = require('../models/evaluationModel');

exports.getEvaluations = async (req, res) => {
    const { studentId } = req.params;

    try {
        const evaluations = await EvaluationModel.getCompletedByStudentId(studentId);

        const formattedData = evaluations.map(item => {
            const startDate = new Date(item.start_time);
            
            // Format Tanggal: "Senin, 6 Oktober 2025"
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = startDate.toLocaleDateString('id-ID', dateOptions);

            return {
                id: item.id,
                type: item.mode === 'online' ? 'Online' : 'On Site',
                status: 'Selesai', // Hardcode karena query pasti completed
                date: formattedDate,
                lecturers: item.lecturers ? item.lecturers.split(', ') : [],
                location: item.mode === 'online' ? '--' : item.location,
                link: item.mode === 'online' ? item.location : null
            };
        });

        res.json({ success: true, data: formattedData });

    } catch (error) {
        console.error("Evaluation Error:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat data evaluasi.' });
    }

};

/* old untuk yg student 
exports.getEvaluationDetail = async (req, res) => {
    const { appId } = req.params;
    try {
        const data = await EvaluationModel.getDetailByAppId(appId);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil detail.' });
    }
}; */

exports.getEvaluationDetail = async (req, res) => {
    const { appId } = req.params;
    try {
        // Pastikan nama fungsi di Model sesuai dengan yang kita perbaiki tadi
        // Tadi kita menamakan fungsinya 'getDetail', bukan 'getDetailByAppId'
        const data = await EvaluationModel.getDetail(appId); 

        res.json({ success: true, data });
    } catch (error) {
        console.error(error); // Tambahkan log agar mudah debug
        res.status(500).json({ success: false, message: 'Gagal mengambil detail.' });
    }
};

exports.updateTaskStatus = async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body; // 'pending', 'in_progress', 'completed'

    try {
        await EvaluationModel.updateTaskStatus(taskId, status);
        res.json({ success: true, message: 'Status berhasil diperbarui' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal update status.' });
    }
};

exports.getLecturerHistory = async (req, res) => {
    try {
        const { lecturerId } = req.params;
        const data = await EvaluationModel.getCompletedByLecturer(lecturerId);
        
        // Formatting Data
        const formatted = data.map(item => ({
            id: item.id,
            date: new Date(item.start_time).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}),
            student_name: item.student_name,
            location: item.location,
            mode: item.mode === 'online' ? 'Online' : 'On Site',
            status: 'Selesai',
            npm: item.npm // Untuk filter
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// API: Simpan Catatan
exports.saveNote = async (req, res) => {
    try {
        const { appId, summary } = req.body;
        await EvaluationModel.saveNote(appId, summary);
        res.json({ success: true, message: 'Catatan berhasil disimpan' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan catatan' });
    }
};

// API: Tambah Tugas
exports.addTask = async (req, res) => {
    try {
        const { appId, description, dueDate } = req.body;
        await EvaluationModel.addTask(appId, description, dueDate);
        res.json({ success: true, message: 'Tugas berhasil ditambahkan' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambah tugas' });
    }
};