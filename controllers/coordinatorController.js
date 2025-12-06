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