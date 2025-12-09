// public/js/notification.js

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
    const userSession = JSON.parse(localStorage.getItem('user_session')); // Ambil data session lagi
    const role = userSession ? userSession.role : 'student';

    const bellIcon = document.getElementById('bell-icon') || document.querySelector('.notification-circle');
    const overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('closeNotif');
    const notifList = document.getElementById('notifList');

    const broadcastContainer = document.getElementById('broadcastContainer');
    
    if (broadcastContainer && (role === 'lecturer' || role === 'coordinator')) {
        renderBroadcastForm(role, broadcastContainer);
    }
    
    // 1. BUKA NOTIFIKASI
    if (bellIcon) {
        bellIcon.addEventListener('click', async (e) => {
            e.preventDefault();
            if(overlay) {
                overlay.style.display = 'flex'; // Munculkan Drawer
                
                // Load data notifikasi
                await fetchNotifications(currentUserId);

                // Tandai sudah dibaca (Hilangkan Badge)
                await markAllRead(currentUserId);
            }
        });
    }

    // 2. TUTUP NOTIFIKASI
    const closeDrawer = () => { if(overlay) overlay.style.display = 'none'; };

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) {
        window.addEventListener('click', (e) => {
            if (e.target === overlay) closeDrawer();
        });
    }

    // 3. FUNGSI FETCH DATA
    async function fetchNotifications(userId) {
        try {
            const response = await fetch(`/api/notifications?user_id=${userId}`);
            const result = await response.json();
            
            if(result.success) {
                renderCards(result.data);
            }
        } catch (error) {
            if(notifList) notifList.innerHTML = '<p class="loading-state">Gagal memuat data.</p>';
        }
    }

    // 4. FUNGSI RENDER CARD
    function renderCards(data) {
        if (!notifList) return;

        if (!data || data.length === 0) {
            notifList.innerHTML = '<p class="loading-state">Tidak ada notifikasi.</p>';
            return;
        }

        let html = '';
        data.forEach(item => {
            // Format waktu sederhana
            const time = new Date(item.time_notified).toLocaleDateString('id-ID');
            
            // Highlight jika belum dibaca (opsional, background agak abu)
            const bgClass = item.is_read ? 'bg-white' : 'bg-light';

            html += `
                <div class="notif-card ${bgClass}">
                    <div class="d-flex justify-content-between">
                        <span class="notif-semester">Info Sistem</span>
                        <small class="text-muted" style="font-size:10px">${time}</small>
                    </div>
                    <div class="notif-title">${item.title}</div>
                    <div class="notif-desc">${item.content}</div>
                </div>
            `;
        });
        notifList.innerHTML = html;
    }

    function renderBroadcastForm(role, container) {
        // Tentukan Opsi Dropdown berdasarkan Role
        let optionsHtml = '';
        
        if (role === 'coordinator') {
            optionsHtml = `
                <option value="all_students">Semua Mahasiswa</option>
                <option value="all_lecturers">Semua Dosen</option>
                <option value="all_users">Semua Pengguna Aktif</option>
            `;
        } else if (role === 'lecturer') {
            optionsHtml = `
                <option value="my_students">Mahasiswa Bimbingan Saya</option>
                <option value="all_students">Semua Mahasiswa (Umum)</option>
            `;
        }

        // Masukkan HTML Form (Desain Compact)
        container.innerHTML = `
            <div class="card border-0 shadow-sm p-3 mb-3" style="background: #f8f9fa; border-radius: 12px;">
                <h6 class="fw-bold text-primary mb-2"><i class="fas fa-bullhorn me-2"></i>Buat Pengumuman</h6>
                <form id="broadcastForm">
                    <select id="bcTarget" class="form-select form-select-sm mb-2 border-0 shadow-sm">
                        ${optionsHtml}
                    </select>
                    <input type="text" id="bcTitle" class="form-control form-control-sm mb-2 border-0 shadow-sm" placeholder="Judul Singkat" required>
                    <textarea id="bcMessage" class="form-control form-control-sm mb-2 border-0 shadow-sm" rows="2" placeholder="Pesan..." required></textarea>
                    <div class="d-grid">
                        <button type="submit" class="btn btn-primary btn-sm rounded-pill fw-bold">Kirim Notifikasi</button>
                    </div>
                </form>
            </div>
            <hr class="border-white opacity-25 mb-3"> `;

        // Handle Submit Broadcast
        document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            
            // UI Feedback
            btn.disabled = true; 
            btn.innerText = 'Mengirim...';

            const body = {
                senderId: userSession.user_id,
                targetType: document.getElementById('bcTarget').value,
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
                    // Optional: Refresh list notifikasi sendiri untuk melihat efek (jika kirim ke diri sendiri/all)
                } else {
                    alert("Gagal: " + result.message);
                }
            } catch (err) {
                console.error(err);
                alert("Gagal koneksi server");
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        });
    }

    // 5. FUNGSI TANDAI SUDAH DIBACA
    async function markAllRead(userId) {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user_id: userId })
            });
            // Hilangkan badge merah di UI secara instan
            const badge = document.querySelector('.badge-dot');
            if(badge) badge.style.display = 'none';
        } catch(e) { console.error(e); }
    }
}