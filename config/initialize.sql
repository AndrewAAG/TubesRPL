-- Membuat Database
-- CREATE DATABASE IF NOT EXISTS bimbingan_ta_db;
-- USE bimbingan_ta_db;

-- ==========================================
-- 1. TABEL UTAMA (PARENT TABLES)
-- ==========================================

-- Tabel Users (Superclass untuk Lecturers, Students, Coordinator)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Disarankan menyimpan hash password
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    role ENUM('student', 'lecturer', 'coordinator') NOT NULL
);

-- Tabel Semesters
CREATE TABLE IF NOT EXISTS semesters (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- Contoh: "Ganjil 2023/2024"
    year INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    uts_start_date DATE,
    uts_end_date DATE,
    uas_start_date DATE,
    uas_end_date DATE,
    is_active BOOLEAN DEFAULT FALSE
);

-- ==========================================
-- 2. TABEL PENGGUNA KHUSUS (SUBCLASSES)
-- ==========================================

-- Tabel Lecturers (Dosen)
CREATE TABLE IF NOT EXISTS lecturers (
    user_id INT PRIMARY KEY,
    nip VARCHAR(50) NOT NULL UNIQUE,
    -- Atribut lain spesifik dosen bisa ditambahkan di sini
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Tabel Students (Mahasiswa)
CREATE TABLE IF NOT EXISTS students (
    user_id INT PRIMARY KEY,
    npm VARCHAR(50) NOT NULL UNIQUE,
    cohort_year YEAR NOT NULL, -- Angkatan
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Tabel Coordinator (Koordinator)
CREATE TABLE IF NOT EXISTS coordinators (
    user_id INT PRIMARY KEY,
    nip VARCHAR(50), 
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ==========================================
-- 3. TABEL KEGIATAN AKADEMIK (THESIS & SCHEDULES)
-- ==========================================

-- Tabel Thesis (Tugas Akhir)
CREATE TABLE IF NOT EXISTS thesis (
    thesis_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    semester_id INT NOT NULL,
    title VARCHAR(255) NOT NULL, -- Judul
    stage_type ENUM('TA1', 'TA2', 'TA1-TA2') NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE,
     FOREIGN KEY (semester_id) REFERENCES semesters(semester_id) ON DELETE CASCADE
);

-- Tabel Pivot: Supervising (Relasi Dosen Membimbing Tesis)
-- Menangani relasi diamond "Supervising" dengan atribut "role"
CREATE TABLE IF NOT EXISTS thesis_supervisors (
    thesis_id INT,
    lecturer_id INT,
    role ENUM('pembimbing_1', 'pembimbing_2') NOT NULL,
    PRIMARY KEY (thesis_id, lecturer_id),
    FOREIGN KEY (thesis_id) REFERENCES thesis(thesis_id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(user_id) ON DELETE CASCADE
);

-- Tabel Lecturer Schedules (Jadwal Ketersediaan Dosen)
CREATE TABLE IF NOT EXISTS lecturer_schedules (
    lecturer_sched_id INT AUTO_INCREMENT PRIMARY KEY,
    lecturer_id INT NOT NULL,
    semester_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(user_id) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES semesters(semester_id) ON DELETE CASCADE
);

-- Tabel Student Schedules (Jadwal Kuliah Mahasiswa)
CREATE TABLE IF NOT EXISTS student_schedules (
    student_sched_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    semester_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES semesters(semester_id) ON DELETE CASCADE
);

-- ==========================================
-- 4. TABEL BIMBINGAN (APPOINTMENTS)
-- ==========================================

-- Tabel Appointments (Janji Temu Bimbingan)
CREATE TABLE IF NOT EXISTS appointments (
    app_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    location VARCHAR(100), -- Ruangan atau Link Meeting
    mode ENUM('offline', 'online') NOT NULL,
    origin ENUM('student_request', 'lecturer_invite') NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    notes TEXT, -- Catatan awal saat request
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_lecturers (
    app_id INT NOT NULL,
    lecturer_id INT NOT NULL,
    response_status ENUM('pending', 'accepted', 'rejected', 'reschedule') DEFAULT 'pending',
    notes VARCHAR(255), -- Alasan jika reject/reschedule (opsional)
    
    PRIMARY KEY (app_id, lecturer_id), -- Composite Key mencegah duplikasi dosen yang sama di 1 appt
    
    FOREIGN KEY (app_id) REFERENCES appointments(app_id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(user_id) ON DELETE CASCADE
);

-- Tabel Session Notes (Catatan Hasil Bimbingan)
CREATE TABLE IF NOT EXISTS session_notes (
    notes_id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL UNIQUE, -- 1 Appointment punya 1 Note utama
    summary TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES appointments(app_id) ON DELETE CASCADE
);

-- Tabel Session Tasks (Tugas dari Bimbingan)
CREATE TABLE IF NOT EXISTS session_tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    app_id INT NOT NULL,
    description TEXT NOT NULL,
    due_date DATE,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    FOREIGN KEY (app_id) REFERENCES appointments(app_id) ON DELETE CASCADE
);

-- ==========================================
-- 5. FITUR PENDUKUNG
-- ==========================================

-- Tabel Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notif_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    time_notified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);