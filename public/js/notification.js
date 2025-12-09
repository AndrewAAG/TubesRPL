document.addEventListener("DOMContentLoaded", () => {
    // 1. Cek User Session
    const userSession = JSON.parse(localStorage.getItem('user_session'));
    if (!userSession) return; // Jika belum login, tidak jalankan notif

    // 2. Load Jumlah Notifikasi Belum Dibaca (Badge)
    updateBadgeCount(userSession.user_id);

    // 3. Siapkan Placeholder HTML jika belum ada
    if (!document.getElementById("notification-component-placeholder")) {
        const placeholder = document.createElement("div");
        placeholder.id = "notification-component-placeholder";
        document.body.appendChild(placeholder);
    }

    // 4. Load UI Notifikasi (Drawer HTML)
    fetch('/components/notification_view.html') 
        .then(res => {
            if (!res.ok) throw new Error("Gagal load komponen");
            return res.text();
        })
        .then(html => {
            document.getElementById("notification-component-placeholder").innerHTML = html;
            initNotificationSystem(userSession.user_id);
        })
        .catch(err => console.error(err));
});

// --- LOGIC BADGE ---
async function updateBadgeCount(userId) {
    const bellIcon = document.querySelector('.notification-circle'); // Wadah lonceng
    if (!bellIcon) return;

    try {
        const res = await fetch(`/api/notifications/count?user_id=${userId}`);
        const result = await res.json();
        
        // Cari atau buat elemen badge
        let badge = bellIcon.querySelector('.badge-dot');
        
        if (result.count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge-dot';
                bellIcon.appendChild(badge);
            }
            // Update angkanya
            badge.textContent = result.count > 9 ? '9+' : result.count;
            badge.style.display = 'flex';
        } else {
            // Jika 0, sembunyikan badge
            if (badge) badge.style.display = 'none';
        }
    } catch (e) { console.error("Gagal update badge", e); }
}

// --- LOGIC INTERAKSI UTAMA ---
function initNotificationSystem(currentUserId) {
    // --- 1. SETUP VARIABEL & SESSION ---
    const bellIcon = document.getElementById('bell-icon') || document.querySelector('.notification-circle');
    const overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('closeNotif');
    const notifList = document.getElementById('notifList');
    const broadcastContainer = document.getElementById('broadcastContainer'); // Wadah form broadcast

    // Ambil data session terbaru
    const userSession = JSON.parse(localStorage.getItem('user_session'));
    const role = userSession ? userSession.role : 'student';

    // --- 2. LOGIKA RENDER FORM BROADCAST (Hanya Dosen & Koordinator) ---
    if (broadcastContainer && (role === 'lecturer' || role === 'coordinator')) {
        
        let optionsHtml = '';
        
        // Tentukan Opsi Dropdown berdasarkan Role
        if (role === 'coordinator') {
            optionsHtml = `
                <option value="all_users">Semua Pengguna Aktif</option>
                <option value="all_students">Semua Mahasiswa</option>
                <option value="all_lecturers">Semua Dosen</option>
            `;
        } else if (role === 'lecturer') {
            optionsHtml = `
                <option value="my_students">Semua Mahasiswa Bimbingan</option>
                <option value="specific_student">Pilih Mahasiswa Tertentu...</option>
            `;
        }

        // Render HTML Form
        broadcastContainer.innerHTML = `
            <div class="card border-0 shadow-sm p-3 mb-3" style="background: #f0f4ff; border-radius: 12px;">
                <h6 class="fw-bold text-primary mb-2" style="font-size: 0.9rem;">
                    <i class="fas fa-bullhorn me-2"></i>Buat Pengumuman
                </h6>
                <form id="broadcastForm">
                    <select id="bcTarget" class="form-select form-select-sm mb-2 border-0 shadow-sm" style="cursor:pointer" required>
                        ${optionsHtml}
                    </select>

                    <select id="bcSpecificStudent" class="form-select form-select-sm mb-2 border-0 shadow-sm" style="display:none; cursor:pointer">
                        <option value="">- Memuat Daftar Mahasiswa... -</option>
                    </select>

                    <input type="text" id="bcTitle" class="form-control form-control-sm mb-2 border-0 shadow-sm" placeholder="Judul Singkat" required>
                    <textarea id="bcMessage" class="form-control form-control-sm mb-2 border-0 shadow-sm" rows="2" placeholder="Tulis pesan..." required></textarea>
                    
                    <div class="d-grid">
                        <button type="submit" class="btn btn-primary btn-sm rounded-pill fw-bold">Kirim Notifikasi</button>
                    </div>
                </form>
            </div>
            <hr class="border-white opacity-25 mb-3">
        `;

        // Event Listener: Dropdown Target Berubah (Khusus Dosen)
        const targetSelect = document.getElementById('bcTarget');
        const studentSelect = document.getElementById('bcSpecificStudent');

        if (targetSelect) {
            targetSelect.addEventListener('change', async function() {
                if (this.value === 'specific_student') {
                    // Tampilkan dropdown kedua & set wajib diisi
                    studentSelect.style.display = 'block';
                    studentSelect.required = true;
                    
                    // Fetch Data Mahasiswa Bimbingan Dosen Ini
                    try {
                        // Kita reuse endpoint list mahasiswa
                        const res = await fetch(`/api/lecturer/students-list/${currentUserId}`);
                        const result = await res.json();
                        
                        if (result.success) {
                            let opts = '<option value="">- Pilih Mahasiswa -</option>';
                            result.data.forEach(s => {
                                // Value pakai student_id (user_id), Label pakai Nama + NPM
                                opts += `<option value="${s.student_id}">${s.name} (${s.npm})</option>`;
                            });
                            studentSelect.innerHTML = opts;
                        }
                    } catch (e) { 
                        console.error("Gagal load mahasiswa", e); 
                        studentSelect.innerHTML = '<option value="">Gagal memuat data</option>';
                    }
                } else {
                    // Sembunyikan jika bukan specific student
                    studentSelect.style.display = 'none';
                    studentSelect.required = false;
                }
            });
        }

        // Event Listener: Submit Form Broadcast
        document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            
            btn.disabled = true; 
            btn.innerText = 'Mengirim...';

            const targetVal = document.getElementById('bcTarget').value;
            const specificVal = document.getElementById('bcSpecificStudent').value;

            const body = {
                senderId: currentUserId,
                targetType: targetVal,
                // Jika mode specific, kirim ID mahasiswanya
                specificStudentId: (targetVal === 'specific_student') ? specificVal : null,
                title: document.getElementById('bcTitle').value,
                message: document.getElementById('bcMessage').value
            };

            try {
                const res = await fetch('/api/notifications/broadcast', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body)
                });
                const result = await res.json();

                if (result.success) {
                    alert(result.message);
                    e.target.reset(); // Reset form
                    studentSelect.style.display = 'none'; // Sembunyikan dropdown mhs
                    fetchNotifications(currentUserId); // Refresh list bawahnya
                } else {
                    alert("Gagal: " + result.message);
                }
            } catch (err) { 
                console.error(err); 
                alert("Kesalahan koneksi server."); 
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        });
    }

    // --- 3. INTERAKSI BUKA/TUTUP DRAWER ---
    
    // Buka Drawer
    if (bellIcon) {
        bellIcon.addEventListener('click', async (e) => {
            e.preventDefault();
            if(overlay) {
                overlay.style.display = 'flex'; // Tampilkan Overlay
                await fetchNotifications(currentUserId); // Load Data
                await markAllRead(currentUserId); // Hilangkan Badge Merah
            }
        });
    }

    // Tutup Drawer
    const closeDrawer = () => { if(overlay) overlay.style.display = 'none'; };
    
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) {
        window.addEventListener('click', (e) => {
            if (e.target === overlay) closeDrawer(); // Klik area gelap
        });
    }

    // --- 4. FUNGSI FETCH & RENDER DATA ---

    async function fetchNotifications(userId) {
        try {
            const response = await fetch(`/api/notifications?user_id=${userId}`);
            const result = await response.json();
            
            if(result.success) {
                renderCards(result.data);
            }
        } catch (error) {
            console.error("Error Fetch:", error);
            if(notifList) notifList.innerHTML = '<p class="loading-state">Gagal memuat data.</p>';
        }
    }

    function renderCards(data) {
        if (!notifList) return;

        if (!data || data.length === 0) {
            notifList.innerHTML = '<div class="text-center text-white mt-5 opacity-75">Tidak ada notifikasi.</div>';
            return;
        }

        let html = '';
        data.forEach(item => {
            const time = new Date(item.time_notified).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'
            });
            
            // Background putih jika belum dibaca, abu-abu jika sudah
            const bgClass = item.is_read ? 'bg-light opacity-75' : 'bg-white';
            
            // Tampilkan Source (Dari Dosen / Koordinator / Info Sistem)
            const sourceLabel = item.source || 'Info Sistem';

            html += `
                <div class="notif-card ${bgClass}">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="notif-semester text-primary fw-bold" style="font-size: 0.75rem;">${sourceLabel}</span>
                        <small class="text-muted" style="font-size: 0.7rem;">${time}</small>
                    </div>
                    <div class="notif-title">${item.title}</div>
                    <div class="notif-desc">${item.content}</div>
                </div>
            `;
        });
        notifList.innerHTML = html;
    }

    // --- 5. FUNGSI TANDAI SUDAH DIBACA ---
    async function markAllRead(userId) {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user_id: userId })
            });
            // Update UI Badge langsung (Hilang)
            const badge = document.querySelector('.badge-dot');
            if(badge) badge.style.display = 'none';
        } catch(e) { console.error("Gagal mark read", e); }
    }
}