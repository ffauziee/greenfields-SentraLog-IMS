# Penjelasan Diagram untuk SKPL Greenfields IMS

## A. Use Case Diagram

File: `diagrams/use_case.puml`

### Aktor

| Aktor | Deskripsi |
|---|---|
| **Operator** | Pengguna operasional yang bertugas membuat dan memperbarui insiden yang ditugaskan kepadanya |
| **Admin** | Pengguna yang memiliki akses penuh ke seluruh data insiden, manajemen pengguna, dan audit log |
| **Superadmin** | Pengguna dengan akses tertinggi — seluruh akses admin + kemampuan mengelola superadmin lain |

### Daftar Use Case

| Kode | Nama Use Case | Aktor | Deskripsi Singkat |
|---|---|---|---|
| UC-01 | Login | Semua | Autentikasi dengan username/password, menerima JWT token |
| UC-02 | View Dashboard | Semua | Melihat statistik real-time dan daftar insiden prioritas |
| UC-03 | List Incidents | Semua | Melihat daftar insiden dengan filter, sort, dan pagination |
| UC-04 | Create Incident | Semua | Membuat laporan insiden baru |
| UC-05 | View Incident Detail | Semua | Melihat detail insiden dan komentar |
| UC-06 | Edit Incident | Admin, Operator (assigned) | Mengubah data insiden dengan validasi role |
| UC-07 | Delete Incident | Admin | Soft-delete insiden |
| UC-08 | Export CSV | Semua | Export data insiden ke format CSV (streaming) |
| UC-09 | Manage Users | Admin | CRUD pengguna, reset password, aktivasi/deaktivasi |
| UC-10 | View Audit Logs | Admin | Melihat riwayat audit seluruh aktivitas sistem |
| UC-11 | Edit Profile | Semua | Mengubah nama dan password profil sendiri |

### Catatan
- Operator hanya dapat mengedit insiden yang ditugaskan kepadanya (UC-06).
- Admin memiliki akses ke seluruh insiden tanpa terkecuali.
- Superadmin memiliki hak yang sama dengan Admin, plus dapat mengelola akun superadmin lain.

---

## B. Activity Diagrams

### B.1 Activity Diagram — Login (UC-01)

File: `diagrams/activity_login.puml`

**Deskripsi:**
Alur autentikasi pengguna dimulai ketika pengguna membuka halaman Login. Pengguna mengisi username dan password, kemudian sistem memvalidasi kredensial melalui endpoint `POST /api/auth/login`. Jika valid, sistem membuat JWT token (HS256, expiry 8 jam) dan menyimpannya di localStorage, lalu redirect ke Dashboard. Jika tidak valid, sistem menampilkan pesan error dan memungkinkan pengguna untuk mencoba lagi hingga 5 kali per menit (rate limiting). Setelah melebihi batas, IP akan diblokir sementara.

**Poin Penting:**
- Rate limiting: 5 request per menit per IP pada endpoint login
- JWT disimpan di localStorage klien (stateless)
- Token expiry: 8 jam (konfigurabel via ACCESS_TOKEN_EXPIRE_MINUTES)

---

### B.2 Activity Diagram — View Dashboard (UC-02)

File: `diagrams/activity_view_dashboard.puml`

**Deskripsi:**
Setelah login, pengguna diarahkan ke halaman Dashboard. Frontend mengirim request `GET /api/incidents/dashboard`. Database mengeksekusi 4 subquery dalam 1 round-trip menggunakan JSON aggregation:
1. **Statistics** — total_open, critical_count, unassigned_count
2. **SLA Breach** — jumlah insiden yang melebihi SLA per severity
3. **Recent** — 10 insiden terbaru (chronological)
4. **Attention** — 50 insiden dengan prioritas tertinggi

Backend menghitung attention_score (0-100) untuk setiap insiden. Frontend mengelompokkan tampilan menjadi 3 section: SLA Breached, High Priority (Attention Score), dan Recent Incidents.

**Poin Penting:**
- 4 subquery dalam 1 round-trip — menghemat koneksi database
- Attention Score: Severity(40%) + SLA Breach(30%) + Recency(20%) + Status(10%)
- Skeleton loading selama proses loading data

---

### B.3 Activity Diagram — Create Incident (UC-04)

File: `diagrams/activity_create_incident.puml`

**Deskripsi:**
Pengguna membuka halaman Incidents dan mengklik tombol "Create Incident". Sistem menampilkan modal form dengan field: Title (wajib), Description, Severity (wajib), Location, dan Assigned To (khusus admin). Setelah data diisi dan tombol "Save" diklik, frontend mengirim request `POST /api/incidents`. Backend memvalidasi data, menyimpan ke database, dan mencatat audit log CREATE dengan snapshot JSONB dari data baru. Modal ditutup, toast notification muncul, dan daftar insiden direfresh.

**Poin Penting:**
- Validasi sisi klien (required fields) + sisi server
- Audit log otomatis dengan snapshot JSONB
- Operator tidak bisa menentukan assignment (hanya admin)

---

### B.4 Activity Diagram — Edit Incident (UC-06)

File: `diagrams/activity_edit_incident.puml`

**Deskripsi:**
Pengguna membuka detail insiden melalui modal IncidentDetail, lalu mengklik "Edit" untuk mengaktifkan mode edit. Field yang dapat diubah: Title, Description, Severity, Status, Location, Assigned To (admin only), dan Comment. Saat status diubah, sistem memvalidasi transisi berdasarkan role pengguna (operator hanya bisa OPEN→IN_PROGRESS→RESOLVED; admin bisa semua transisi). Jika ada perubahan, sistem mengirim `PUT /api/incidents/{id}`. Backend menyimpan snapshot old_value sebelum update dan new_value setelah update ke audit log.

**Poin Penting:**
- Operator: hanya bisa edit insiden yang ditugaskan kepadanya
- Transisi status dibatasi oleh ALLOWED_OPERATOR_TRANSITIONS
- Audit: old_value + new_value dicatat sebagai JSONB
- Jika tidak ada perubahan, sistem tidak mengirim request

---

### B.5 Activity Diagram — Manage Users (UC-09)

File: `diagrams/activity_manage_users.puml`

**Deskripsi:**
Halaman Manage Users hanya dapat diakses oleh admin. Tabel menampilkan daftar pengguna dengan kolom Username, Full Name, Role, Status. Admin dapat melakukan:
- **Create User**: Membuat user baru dengan username, full name, password, dan role. Validasi username unik.
- **Edit User**: Mengubah username, full name, role, dan status aktif. Terdapat proteksi superadmin (tidak bisa dinonaktifkan/demote) dan last-admin protection (minimal 1 admin aktif harus ada).
- **Reset Password**: Mengganti password user tanpa perlu password lama.
- **Delete User**: Soft-delete dengan mengatur is_active = FALSE.

Semua operasi dicatat di audit log.

**Poin Penting:**
- Superadmin protection: akun admin tidak bisa di-deactivate/di-demote
- Last-admin protection: minimal satu admin aktif harus selalu ada
- Reset password tidak memerlukan verifikasi password lama (oleh admin)

---

### B.6 Activity Diagram — Export CSV (UC-08)

File: `diagrams/activity_export_csv.puml`

**Deskripsi:**
Pengguna memilih filter (status group, severity, date range, search) pada halaman Incidents, lalu mengklik "Export CSV". Backend membuka server-side cursor dengan statement_timeout 5 menit. Data diambil dalam batch 2000 baris, dikonversi ke format CSV (dengan attention_score dihitung per baris), dan langsung dikirim ke klien secara streaming. Tidak ada data yang disimpan di memori server (zero memory overhead). Safety net: maksimal 100.000 baris.

**Poin Penting:**
- Streaming: data dikirim per potongan (chunked transfer)
- Zero memory overhead — tidak ada buffer/data disimpan di RAM
- Server-side cursor — koneksi DB tetap terbuka hingga selesai
- Safety net: 100.000 baris maksimal
- Format CSV: header + data dengan escaping untuk koma dan quotes
