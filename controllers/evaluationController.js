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

exports.getEvaluationDetail = async (req, res) => {
    const { appId } = req.params;
    try {
        const data = await EvaluationModel.getDetailByAppId(appId);
        res.json({ success: true, data });
    } catch (error) {
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