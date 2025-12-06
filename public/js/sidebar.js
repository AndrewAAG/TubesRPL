// public/js/components/sidebar.js

function renderSidebar() {
    // Ambil data user dari session
    const userSession = JSON.parse(localStorage.getItem('user_session')) || { 
        name: 'User', role: 'student', npm: 'NPM'
    };

    const role = userSession.role; // 'student' atau 'lecturer'
    const path = window.location.pathname;
    
    // Fungsi cek aktif
    const isActive = (keyword) => path.includes(keyword) ? 'active' : '';

    // MENU CONFIGURATION
    let menuHTML = '';

    if (role === 'lecturer') {
        // --- MENU DOSEN ---
        menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive('lecturer/schedule')}" href="/lecturer/schedule">
                <i class="fas fa-calendar-alt me-3 text-center" style="width: 20px;"></i> Jadwal Bimbingan
            </a>
            <a class="nav-item-custom ${isActive('lecturer/calendar')}" href="#">
                <i class="far fa-calendar me-3 text-center" style="width: 20px;"></i> Kalender
            </a>
            <a class="nav-item-custom ${isActive('lecturer/requests')}" href="/lecturer/requests">
                <i class="fas fa-envelope-open-text me-3 text-center" style="width: 20px;"></i> Pengajuan Bimbingan
            </a>
            <a class="nav-item-custom ${isActive('lecturer/evaluation')}" href="/lecturer/evaluation">
                <i class="fas fa-file-signature me-3 text-center" style="width: 20px;"></i> Evaluasi Bimbingan
            </a>

            <div class="mt-4"></div>
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Mahasiswa Bimbingan</small>
            
            <a class="nav-item-custom ${isActive('lecturer/students')}" href="/lecturer/students">
                <i class="fas fa-users me-3 text-center" style="width: 20px;"></i> Daftar Mahasiswa
            </a>
        `;
    } else if (role === 'coordinator') {
        //userIdentity = userSession.nip || 'NIP Coordinator';
        // userRoleLabel = 'Informatika';

        menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive('coordinator/schedule')}" href="/coordinator/schedule">
                <i class="fas fa-calendar-check me-3 text-center" style="width: 20px;"></i> Manajemen Semester
            </a>
            </a>
            <a class="nav-item-custom ${isActive('coordinator/import')}" href="#">
                <i class="fas fa-file-import me-3 text-center" style="width: 20px;"></i> Import Jadwal
            </a>
            <a class="nav-item-custom ${isActive('coordinator/assignments')}" href="/coordinator/assignments">
                <i class="fas fa-clipboard-list me-3 text-center" style="width: 20px;"></i> Penetapan Bimbingan
            </a>

            <div class="mt-4"></div>
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Monitor</small>
            
            <a class="nav-item-custom ${isActive('coordinator/students')}" href="#">
                <i class="fas fa-users me-3 text-center" style="width: 20px;"></i> Mahasiswa
            </a>
        `;
    } else {
        // --- MENU MAHASISWA (Default) ---
        menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive('student/schedule')}" href="/student/schedule">
                <i class="fas fa-calendar-alt me-3 text-center" style="width: 20px;"></i> Jadwal Bimbingan
            </a>
            <a class="nav-item-custom ${isActive('student/progress')}" href="/student/progress">
                <i class="fas fa-chart-line me-3 text-center" style="width: 20px;"></i> Pelacak Kemajuan
            </a>
            <a class="nav-item-custom ${isActive('student/calendar')}" href="#">
                <i class="far fa-calendar me-3 text-center" style="width: 20px;"></i> Kalender
            </a>
            <a class="nav-item-custom ${isActive('student/evaluation')}" href="/student/evaluation">
                <i class="fas fa-file-signature me-3 text-center" style="width: 20px;"></i> Evaluasi Bimbingan
            </a>
            <a class="nav-item-custom ${isActive('student/import')}" href="#">
                <i class="fas fa-file-import me-3 text-center" style="width: 20px;"></i> Import Jadwal
            </a>
        `;
    }

    // Identitas User (NPM/NIP tergantung role)
    const userIdentity = role === 'lecturer' ? 'Informatika' : (userSession.npm || userSession.nip || '-');
    const userRoleLabel = role === 'lecturer' ? userSession.email : 'Informatika';

    const sidebarHTML = `
        <div class="text-center pt-5 pb-4 px-4">
            <img src="/images/LogoUnparHitam.png" 
                 alt="Logo UNPAR" 
                 style="width: 100%; max-width: 180px; height: auto;"> 
        </div>

        <div class="text-center px-3 mb-4">
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="rounded-circle profile-img" alt="Profile">
            <h6 class="fw-bold text-white mb-1">${userSession.name}</h6>
            <small class="text-white-50 d-block">${userRoleLabel}</small>
            <small class="text-white-50 d-block">${userIdentity}</small>
        </div>

        <div class="nav-custom">
            ${menuHTML}
            <div style="height: 50px;"></div>
        </div>
    `;

    const wrapper = document.getElementById('sidebar-wrapper');
    if(wrapper) wrapper.innerHTML = sidebarHTML;
}

document.addEventListener('DOMContentLoaded', renderSidebar);