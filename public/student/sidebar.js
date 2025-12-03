// public/student/sidebar.js

function renderSidebar() {
    const userSession = JSON.parse(localStorage.getItem('user_session')) || { 
        name: 'Andrew Alexander', 
        role: 'student', 
        npm: '6182301010' 
    };

    const sidebarHTML = `
        <div class="text-center pt-5 pb-4 px-4">
            <img src="../images/FA - Logo Berwarna UNPAR - Horizontal - Wordmark Hitam.png" 
                 alt="Logo UNPAR" 
                 style="width: 100%; max-width: 180px; height: auto;"> 
        </div>

        <div class="text-center px-3 mb-4">
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" 
                 class="rounded-circle profile-img" 
                 alt="Profile">
            <h6 class="fw-bold text-white mb-1">${userSession.name}</h6>
            <small class="text-white-50 d-block">Informatika</small>
            <small class="text-white-50 d-block">NPM ${userSession.npm}</small>
        </div>

        <div class="nav-custom">
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" 
                   style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom" href="student_schedule.html">
                <i class="fas fa-calendar-alt me-3 text-center" style="width: 20px;"></i> 
                Jadwal Bimbingan
            </a>

            <a class="nav-item-custom" href="#">
                <i class="fas fa-chart-line me-3 text-center" style="width: 20px;"></i> 
                Pelacak Kemajuan
            </a>

            <!-- Link ke halaman Kalender (PERBAIKAN DI SINI) -->
            <a class="nav-item-custom" href="calendar.html">
                <i class="far fa-calendar me-3 text-center" style="width: 20px;"></i> 
                Kalender
            </a>

            <a class="nav-item-custom" href="#">
                <i class="fas fa-file-signature me-3 text-center" style="width: 20px;"></i> 
                Evaluasi Bimbingan
            </a>

            <a class="nav-item-custom" href="#">
                <i class="fas fa-file-import me-3 text-center" style="width: 20px;"></i> 
                Import Jadwal
            </a>

            <div class="mt-4"></div>

            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" 
                   style="font-size: 0.7rem;">Dokumen</small>

            <a class="nav-item-custom" href="#">
                <i class="fas fa-book me-3 text-center" style="width: 20px;"></i> 
                Topik TA
            </a>
            
            <div style="height: 50px;"></div>
        </div>
    `;

    document.getElementById('sidebar-wrapper').innerHTML = sidebarHTML;
}

renderSidebar();