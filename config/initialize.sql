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

-- DATA DUMMY
-- 1. DATA SEMESTER 
INSERT IGNORE  INTO semesters (semester_id, name, year, start_date, end_date, uts_start_date, uts_end_date, uas_start_date, uas_end_date, is_active) VALUES
(1, 'Genap 2024/2025', 2024, '2025-01-15', '2025-06-15', '2025-03-10', '2025-03-24', '2025-06-01', '2025-06-14', FALSE),
(2, 'Ganjil 2025/2026', 2025, '2025-08-15', '2025-12-15', '2025-10-20', '2025-10-31', '2025-12-01', '2025-12-14', TRUE);

-- 2. USERS
INSERT IGNORE INTO users (user_id, name, email, password, role) VALUES 
(1, 'Dr. Koordinator TA', 'koor@unpar.ac.id', '123456', 'coordinator'),
(2, 'Pascal Alfadian', 'pascal@unpar.ac.id', '123456', 'lecturer'),
(3, 'Vania Natali', 'vania@unpar.ac.id', '123456', 'lecturer'),
(4, 'Lionov', 'lionov@unpar.ac.id', '123456', 'lecturer'),
(5, 'Andrew Alexander Gunawan', 'andrew@student.unpar.ac.id', '123456', 'student'),
(6, 'Stevan Axel', 'stevan@student.unpar.ac.id', '123456', 'student'),
(7, 'Cloud Althea', 'cloud@student.unpar.ac.id', '123456', 'student'),
(8, 'Kevin Sanjaya', 'kevin@student.unpar.ac.id', '123456', 'student');

-- 3. DETAIL USERS
INSERT IGNORE INTO coordinators (user_id, nip) VALUES (1, 'KOOR001');
INSERT IGNORE INTO lecturers (user_id, nip) VALUES (2, '19900101'), (3, '19900202'), (4, '19900303');
INSERT IGNORE INTO students (user_id, npm, cohort_year) VALUES 
(5, '6182301010', 2022), (6, '6182301040', 2022), (7, '6182301081', 2023), (8, '6182301022', 2021);

-- 4. THESIS
INSERT IGNORE INTO thesis (thesis_id, student_id, semester_id, title, stage_type) VALUES
(1, 5, 2, 'Pengembangan Sistem Manajemen Bimbingan TA Berbasis Web', 'TA1'),
(2, 6, 2, 'Analisis Sentimen Menggunakan Deep Learning', 'TA1'),
(3, 7, 2, 'Implementasi Blockchain pada Supply Chain', 'TA1'),
(4, 8, 2, 'Rancang Bangun IoT Smart Home', 'TA2');

-- 5. PEMBIMBING
INSERT IGNORE INTO thesis_supervisors (thesis_id, lecturer_id, role) VALUES 
(1, 2, 'pembimbing_1'), (1, 3, 'pembimbing_2'), -- Andrew dibimbing Pascal & Vania
(2, 4, 'pembimbing_1'),
(4, 2, 'pembimbing_1');

-- 6. JADWAL KULIAH MAHASISWA
INSERT IGNORE INTO student_schedules (student_id, semester_id, day_of_week, start_time, end_time) VALUES
(5, 2, 'Monday', '08:00:00', '10:00:00'),
(5, 2, 'Wednesday', '13:00:00', '15:00:00');

-- 7. KETERSEDIAAN DOSEN
INSERT IGNORE INTO lecturer_schedules (lecturer_id, semester_id, day_of_week, start_time, end_time, description) VALUES
(2, 2, 'Wednesday', '08:00:00', '12:00:00', 'Available Bimbingan di Ruang Dosen'),
(2, 2, 'Friday', '13:00:00', '16:00:00', 'Available Online Only');

-- 8. APPOINTMENTS 

-- A. COMPLETED (Sudah selesai, ada notes)
INSERT IGNORE INTO appointments (app_id, student_id, start_time, end_time, location, mode, origin, status, notes) 
VALUES (101, 5, '2025-10-01 09:00:00', '2025-10-01 10:00:00', '09.01.21', 'offline', 'student_request', 'completed', 'Membahas Bab 1');
INSERT IGNORE INTO appointment_lecturers VALUES (101, 2, 'accepted', NULL);
INSERT IGNORE INTO session_notes (app_id, summary) VALUES (101, 'Revisi rumusan masalah.');

-- B. APPROVED (Akan datang)
INSERT IGNORE INTO appointments (app_id, student_id, start_time, end_time, location, mode, origin, status, notes) 
VALUES (102, 5, '2025-10-08 08:00:00', '2025-10-08 10:00:00', '09.01.21', 'offline', 'student_request', 'approved', 'Diskusi Bab 2');
INSERT IGNORE INTO appointment_lecturers VALUES (102, 2, 'accepted', NULL);

-- C. PENDING (Menunggu konfirmasi)
INSERT IGNORE INTO appointments (app_id, student_id, start_time, end_time, location, mode, origin, status, notes) 
VALUES (103, 5, '2025-10-17 11:00:00', '2025-10-17 13:00:00', 'https://meet.google.com/ori-dead-yqs', 'online', 'student_request', 'pending', 'Membahas Metodologi');
INSERT IGNORE INTO appointment_lecturers VALUES (103, 2, 'pending', NULL);

-- 9. NOTIFIKASI
INSERT IGNORE INTO notifications (user_id, title, content, is_read) VALUES
(5, 'Jadwal Disetujui', 'Pengajuan bimbingan 8 Oktober disetujui.', FALSE);

-- 10. SESSION TASKS
INSERT IGNORE INTO session_tasks (app_id, description, due_date, status) VALUES 
(101, 'Revisi Bab 1 (Latar Belakang)', '2025-10-10', 'in_progress'),
(101, 'Cari 5 Jurnal Internasional', '2025-10-15', 'pending');