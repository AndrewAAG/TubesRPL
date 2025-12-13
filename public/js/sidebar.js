function renderSidebar() {
  // Ambil data user dari session
  const userSession = JSON.parse(localStorage.getItem("user_session")) || {
    name: "User",
    role: "student",
    npm: "NPM",
  };

  const role = userSession.role;
  const path = window.location.pathname;

  // Fungsi cek aktif
  const isActive = (keyword) => (path.includes(keyword) ? "active" : "");

  // MENU CONFIGURATION
  let menuHTML = "";

  if (role === "lecturer") {
    // --- MENU DOSEN ---
    menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive("lecturer/schedule")}" href="/lecturer/schedule">
                <i class="fas fa-calendar-alt me-3 text-center" style="width: 20px;"></i> Jadwal Bimbingan
            </a>
            <a class="nav-item-custom ${isActive("lecturer/calendar")}" href="/lecturer/calendar">
                <i class="far fa-calendar-check me-3 text-center" style="width: 20px;"></i> Kalender
            </a>
            <a class="nav-item-custom ${isActive("lecturer/requests")}" href="/lecturer/requests">
                <i class="fas fa-envelope-open-text me-3 text-center" style="width: 20px;"></i> Pengajuan Bimbingan
            </a>
            <a class="nav-item-custom ${isActive("lecturer/evaluation")}" href="/lecturer/evaluation">
                <i class="fas fa-file-signature me-3 text-center" style="width: 20px;"></i> Evaluasi Bimbingan
            </a>

            <div class="mt-4"></div>
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Mahasiswa Bimbingan</small>
            
            <a class="nav-item-custom ${isActive("lecturer/students")}" href="/lecturer/students">
                <i class="fas fa-users me-3 text-center" style="width: 20px;"></i> Daftar Mahasiswa
            </a>
        `;
  } else if (role === "coordinator") {
    //userIdentity = userSession.nip || 'NIP Coordinator';
    // userRoleLabel = 'Informatika';

    menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive("coordinator/schedule")}" href="/coordinator/schedule">
                <i class="fas fa-calendar-check me-3 text-center" style="width: 20px;"></i> Manajemen Semester
            </a>
            </a>
            <a class="nav-item-custom ${isActive("coordinator/import")}" href="/coordinator/import">
                <i class="fas fa-file-import me-3 text-center" style="width: 20px;"></i> Import Jadwal
            </a>
            <a class="nav-item-custom ${isActive("coordinator/assignments")}" href="/coordinator/assignments">
                <i class="fas fa-clipboard-list me-3 text-center" style="width: 20px;"></i> Penetapan Bimbingan
            </a>

            <div class="mt-4"></div>
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Monitor</small>
            
            <a class="nav-item-custom ${isActive("coordinator/users")}" href="/coordinator/users">
                <i class="fas fa-users me-3 text-center" style="width: 20px;"></i> Manajemen Pengguna
            </a>
        `;
  } else {
    // --- MENU MAHASISWA (Default) ---
    menuHTML = `
            <small class="text-white-50 text-uppercase fw-bold ps-4 mb-2 d-block" style="font-size: 0.7rem;">Penjadwalan</small>
            
            <a class="nav-item-custom ${isActive("student/schedule")}" href="/student/schedule">
                <i class="fas fa-calendar-alt me-3 text-center" style="width: 20px;"></i> Jadwal Bimbingan
            </a>
            <a class="nav-item-custom ${isActive("student/progress")}" href="/student/progress">
                <i class="fas fa-chart-line me-3 text-center" style="width: 20px;"></i> Pelacak Kemajuan
            </a>
            <a class="nav-item-custom ${isActive("student/calendar")}" href="/student/calendar">
                <i class="far fa-calendar-alt me-3 text-center" style="width: 20px;"></i> Kalender
            </a>
            <a class="nav-item-custom ${isActive("student/evaluation")}" href="/student/evaluation">
                <i class="fas fa-file-signature me-3 text-center" style="width: 20px;"></i> Evaluasi Bimbingan
            </a>
            <a class="nav-item-custom ${isActive("student/import")}" href="/student/import">
                <i class="fas fa-file-import me-3 text-center" style="width: 20px;"></i> Import Jadwal
            </a>
        `;
  }

  // Identitas User (NPM/NIP tergantung role)
  const userIdentity = role === "lecturer" ? "Informatika" : userSession.npm || userSession.nip || "-";
  const userRoleLabel = role === "lecturer" ? userSession.email : "Informatika";

  const sidebarHTML = `
        <div class="text-center pt-5 pb-4 px-4">
            <img src="/images/LogoUnparPutih.png" 
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
        </div>

        <div class="px-4 pb-5 mt-3">
                <hr class="border-secondary opacity-50 mb-4">
                
                <button onclick="globalLogout()" 
                        class="btn btn-danger w-100 d-flex align-items-center justify-content-center py-2 rounded-pill shadow-sm"
                        style="transition: all 0.3s ease;">
                    <i class="fas fa-sign-out-alt me-2"></i> 
                    <span class="fw-bold">Logout</span>
                </button>
            </div>
    `;

  const wrapper = document.getElementById("sidebar-wrapper");
  if (wrapper) wrapper.innerHTML = sidebarHTML;
}

window.globalLogout = function () {
  if (confirm("Apakah Anda yakin ingin keluar?")) {
    localStorage.clear();
    // Arahkan ke halaman login (sesuaikan path jika perlu, misal /login.html)
    window.location.href = "/login";
  }
};

document.addEventListener("DOMContentLoaded", renderSidebar);
