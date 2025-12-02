const ProgressModel = require('../models/progressModel');

exports.getStudentProgress = async (req, res) => {
    const { studentId } = req.params;

    try {
        const [summary, historyData, tasksData] = await Promise.all([
            ProgressModel.getProgressSummary(studentId),
            ProgressModel.getHistory(studentId),
            ProgressModel.getTasks(studentId)
        ]);

        const formattedHistory = historyData.map(item => ({
            date: new Date(item.date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            }),
            topic: item.topic
        }));

        const formattedTasks = tasksData.map(item => ({
            id: item.task_id,
            name: item.name,
            status: item.status === 'in_progress' ? 'In Progress' : 'Pending'
        }));

        res.json({
            success: true,
            data: {
                progress: {
                    status_text: summary.overallStatus,
                    status_color: summary.statusColor,
                    bars: summary.bars,
                },
                history: formattedHistory,
                tasks: formattedTasks
            }
        });

    } catch (error) {
        console.error("Progress Error:", error);
        res.status(500).json({ success: false, message: 'Gagal memuat data progress.' });
    }
};