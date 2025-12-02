const User = require('../models/User');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    // Validasi input kosong
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan Password wajib diisi.' });
    }

    try {
        const user = await User.findByEmail(email);

        // Jika user tidak ditemukan
        if (!user) {
            return res.status(401).json({ success: false, message: 'Email tidak terdaftar.' });
        }

        // CEK PASSWORD
        // Plaintext 
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: 'Password salah.' });
        }

        // CEK ROLE & TENTUKAN URL
        let targetUrl = '';

        switch (user.role) {
            case 'student': // Sesuai ENUM di database
                targetUrl = '/student/schedule';
                break;
            case 'lecturer':
                targetUrl = '/lecturer/schedule';
                break;
            case 'coordinator':
                targetUrl = '/coordinator';
                break;
            default:
                // Role tidak dikenal
                targetUrl = 'index.html'; 
                break;
        }

        // Kirim respon sukses beserta URL tujuan
        res.json({
            success: true,
            message: 'Login berhasil!',
            redirectUrl: targetUrl, // Frontend akan membaca ini
            user: {
                user_id: user.user_id,
                name: user.name,
                role: user.role,
                npm: user.npm || user.nip
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
    }
};