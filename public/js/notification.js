document.addEventListener("DOMContentLoaded", () => {
    // 1. Siapkan Wadah di Body (Hanya jika belum ada)
    if (!document.getElementById("notification-component-placeholder")) {
        const placeholder = document.createElement("div");
        placeholder.id = "notification-component-placeholder";
        document.body.appendChild(placeholder);
    }

    // 2. Load File HTML Notifikasi
    fetch('/components/notification_view.html') 
        .then(response => {
            if (!response.ok) throw new Error("Gagal load komponen notifikasi");
            return response.text();
        })
        .then(html => {
            // Masukkan HTML ke halaman
            document.getElementById("notification-component-placeholder").innerHTML = html;
            
            // Jalankan logika setelah HTML siap
            initNotificationSystem();
        })
        .catch(err => console.error(err));
});

function initNotificationSystem() {
    // ID Tombol Lonceng (SESUAI FILE IMAGE KAMU: bell-icon)
    const bellIcon = document.getElementById('bell-icon'); 
    const overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('closeNotif');
    const notifList = document.getElementById('notifList');
    const badge = document.querySelector('.badge-dot'); // Titik merah (jika ada)

    // Ganti dengan ID user login yang sesuai
    const currentUserId = 1; 

    // --- EVENT LISTENER ---
    
    // 1. Buka Popup
    if (bellIcon) {
        bellIcon.addEventListener('click', (e) => {
            e.preventDefault(); // Mencegah refresh jika tombolnya link
            if(overlay) {
                overlay.style.display = 'flex'; // Tampilkan popup
                fetchNotifications(currentUserId); // Ambil data terbaru
            }
        });
    }

    // 2. Tutup Popup (Tombol Panah)
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if(overlay) overlay.style.display = 'none';
        });
    }

    // 3. Tutup Popup (Klik Area Gelap)
    if (overlay) {
        window.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    }

    // --- FUNGSI DATA ---

    async function fetchNotifications(userId) {
        try {
            const response = await fetch(`/api/notifications?user_id=${userId}`);
            const data = await response.json();
            renderCards(data);
        } catch (error) {
            console.error("Error API:", error);
            if(notifList) notifList.innerHTML = '<p class="loading-state">Gagal memuat data.</p>';
        }
    }

    function renderCards(data) {
        if (!notifList) return;

        if (!data || data.length === 0) {
            notifList.innerHTML = '<p class="loading-state">Tidak ada notifikasi baru.</p>';
            return;
        }

        let html = '';
        data.forEach(item => {
            // Template Kartu Putih sesuai Desain
            html += `
                <div class="notif-card">
                    <span class="notif-semester">(2025 - Ganjil)</span>
                    <div class="notif-title">${item.title || 'Judul Notifikasi'}</div>
                    <div class="notif-desc">
                        ${item.message || 'Isi pesan tidak tersedia.'}
                    </div>
                    <a href="#" class="notif-link">selengkapnya</a>
                </div>
            `;
        });
        notifList.innerHTML = html;
    }
}