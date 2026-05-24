-- Migration: seed dummy data for users and incidents
-- Purpose: Populate the database with realistic test data for development and demo.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / checks).
-- Run: psql -U postgres -d greenfields_audit -f backend/app/migration/003_seed_dummy_data.sql

BEGIN;

-- ============================================================================
-- 1. DUMMY USERS
-- ============================================================================
-- Passwords are bcrypt hashes. All dummy users use password: "password123"
-- Hash generated with bcrypt rounds=12: $2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi

-- Admin users
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'admin_dairy', 'admin_dairy@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Budi Santoso', 'admin', TRUE),

    ('a1000000-0000-0000-0000-000000000002', 'admin_quality', 'admin_quality@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Siti Rahayu', 'admin', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Operator users
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
VALUES
    ('b2000000-0000-0000-0000-000000000001', 'op_pasteurizer', 'op_pasteurizer@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Ahmad Fauzi', 'operator', TRUE),

    ('b2000000-0000-0000-0000-000000000002', 'op_filling', 'op_filling@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Dewi Lestari', 'operator', TRUE),

    ('b2000000-0000-0000-0000-000000000003', 'op_cooling', 'op_cooling@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Riko Pratama', 'operator', TRUE),

    ('b2000000-0000-0000-0000-000000000004', 'op_storage', 'op_storage@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Rina Wulandari', 'operator', TRUE),

    ('b2000000-0000-0000-0000-000000000005', 'op_boiler', 'op_boiler@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Hendra Wijaya', 'operator', TRUE),

    ('b2000000-0000-0000-0000-000000000006', 'op_warehouse', 'op_warehouse@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Maya Anggraeni', 'operator', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Inactive user (for testing filters)
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
VALUES
    ('b2000000-0000-0000-0000-000000000099', 'op_retired', 'op_retired@greenfields.co.id',
     '$2b$12$LJ3m4ys3Lz0QFgPGXnDy4u1Z7VdFv/cXrNqU3I7yR5PjX0v2F8Rdi',
     'Joko Susilo', 'operator', FALSE)
ON CONFLICT (username) DO NOTHING;


-- ============================================================================
-- 2. DUMMY INCIDENTS
-- ============================================================================
-- Spread across severities, statuses, locations, and time ranges.
-- Uses the dummy user IDs created above.

-- ---- CRITICAL incidents (severity_id=4) ----
INSERT INTO incidents (title, description, severity_id, status_id, location, assigned_to, reported_by, is_resolved, is_deleted, resolved_at, created_at, updated_at)
VALUES
    -- CRITICAL / OPEN — urgent, unresolved
    ('Kebocoran pipa susu di area pasteurisasi',
     'Ditemukan kebocoran pada sambungan pipa transfer susu di unit pasteurisasi line 2. Tekanan abnormal terdeteksi pada pressure gauge PG-201. Perlu segera ditangani untuk menghindari kontaminasi produk dan kerugian bahan baku.',
     4, 1, 'Pasteurizer Line 2', 'b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
     FALSE, FALSE, NULL, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

    -- CRITICAL / ESCALATED — SLA breached
    ('Chiller utama mati total — suhu naik ke 15°C',
     'Chiller unit CH-01 berhenti beroperasi secara mendadak. Suhu cold storage naik dari 4°C ke 15°C dalam 30 menit. Seluruh produk di cold room A berisiko rusak. Teknisi sedang menunggu spare part kompresor.',
     4, 5, 'Cold Storage Room A', 'b2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003',
     FALSE, FALSE, NULL, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '1 hour'),

    -- CRITICAL / RESOLVED
    ('Kontaminasi bakteri E.coli pada batch #2024-0512',
     'Hasil lab menunjukkan kontaminasi E.coli pada batch susu pasteurisasi #2024-0512. Seluruh batch telah diisolasi dan ditarik dari jalur distribusi. Investigasi akar masalah menunjukkan sanitasi CIP yang tidak optimal pada tangki T-05.',
     4, 3, 'Lab Quality Control', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
     TRUE, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),

-- ---- HIGH incidents (severity_id=3) ----
    -- HIGH / OPEN
    ('Motor conveyor filling macet berulang',
     'Motor conveyor pada mesin filling line 1 sering trip (3x dalam shift pagi). Motor overheat dengan suhu 85°C. Diduga bearing aus dan perlu penggantian segera sebelum menyebabkan kerusakan lebih parah.',
     3, 1, 'Filling Line 1', 'b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002',
     FALSE, FALSE, NULL, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),

    -- HIGH / IN_PROGRESS
    ('Sensor suhu tangki penyimpanan T-03 error',
     'Sensor suhu PT-100 pada tangki T-03 menunjukkan pembacaan yang tidak konsisten (fluktuasi 2-8°C dalam 5 menit). Kemungkinan sensor rusak atau kabel terputus. Operator sedang melakukan kalibrasi ulang.',
     3, 2, 'Storage Tank T-03', 'b2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000001',
     FALSE, FALSE, NULL, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '4 hours'),

    -- HIGH / OPEN — unassigned
    ('Alarm gas amonia berbunyi di area mesin pendingin',
     'Detektor gas amonia di area kompresor pendingin menunjukkan level 30 ppm (batas normal 25 ppm). Kemungkinan ada kebocoran kecil pada seal kompresor. Area telah dievakuasi sesuai SOP keselamatan.',
     3, 1, 'Compressor Room', NULL, 'b2000000-0000-0000-0000-000000000005',
     FALSE, FALSE, NULL, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),

    -- HIGH / RESOLVED
    ('Pompa CIP tidak menghasilkan tekanan cukup',
     'Pompa CIP (Clean-in-Place) pada tangki pasteurisasi hanya menghasilkan 1.5 bar dari target 3 bar. Impeller pompa ditemukan aus dan telah diganti dengan yang baru. Sistem CIP telah diuji dan berfungsi normal.',
     3, 3, 'CIP Station', 'b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
     TRUE, FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),

-- ---- MEDIUM incidents (severity_id=2) ----
    -- MEDIUM / OPEN
    ('Label kemasan tidak sesuai batch number',
     'Ditemukan 200 unit produk susu UHT dengan label batch number yang tidak sesuai. Label menunjukkan batch #B-0501 padahal isi produk dari batch #B-0503. Produk telah ditahan di gudang packing.',
     2, 1, 'Packaging Area', 'b2000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000006',
     FALSE, FALSE, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

    -- MEDIUM / IN_PROGRESS
    ('AC ruang kontrol sering mati sendiri',
     'Unit AC di ruang kontrol produksi mati sendiri setiap 2-3 jam. Suhu ruang kontrol mencapai 32°C yang berdampak pada kenyamanan operator dan performa peralatan elektronik. Teknisi HVAC sedang memeriksa.',
     2, 2, 'Production Control Room', 'b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000004',
     FALSE, FALSE, NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

    -- MEDIUM / RESOLVED
    ('Kebocoran air pada atap gudang bahan baku',
     'Kebocoran air hujan terdeteksi di sudut timur gudang bahan baku. Beberapa karton kemasan terkena air. Tim maintenance telah memperbaiki atap dan mengganti karton yang rusak.',
     2, 3, 'Raw Material Warehouse', 'b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000006',
     TRUE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days'),

    -- MEDIUM / CLOSED
    ('Jadwal kalibrasi flowmeter FM-12 terlewat',
     'Flowmeter FM-12 pada jalur susu segar belum dikalibrasi sesuai jadwal (seharusnya setiap 6 bulan). Terakhir kalibrasi 8 bulan lalu. Kalibrasi telah dilakukan oleh vendor dan sertifikat telah diperbarui.',
     2, 4, 'Receiving Bay', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
     TRUE, FALSE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),

    -- MEDIUM / OPEN
    ('Forklift #3 rem tidak berfungsi optimal',
     'Operator gudang melaporkan bahwa rem forklift #3 terasa blong saat membawa beban penuh. Forklift telah diberi tanda "out of service" dan diparkir di area maintenance.',
     2, 1, 'Finished Goods Warehouse', NULL, 'b2000000-0000-0000-0000-000000000006',
     FALSE, FALSE, NULL, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

-- ---- LOW incidents (severity_id=1) ----
    -- LOW / OPEN
    ('Lampu area loading dock mati 3 unit',
     'Tiga unit lampu sorot di area loading dock timur tidak menyala. Mempengaruhi visibilitas saat loading malam hari. Perlu penggantian lampu LED 200W.',
     1, 1, 'Loading Dock East', NULL, 'b2000000-0000-0000-0000-000000000006',
     FALSE, FALSE, NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

    -- LOW / IN_PROGRESS
    ('Cat lantai area produksi terkelupas',
     'Cat epoxy lantai di area produksi sudah terkelupas di beberapa titik (sekitar 5m²). Perlu pengecatan ulang untuk memenuhi standar GMP. Vendor cat telah dihubungi untuk jadwal pengecatan.',
     1, 2, 'Production Floor Zone B', 'b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002',
     FALSE, FALSE, NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),

    -- LOW / RESOLVED
    ('Papan informasi K3 di pintu masuk sudah usang',
     'Papan informasi K3 (Keselamatan dan Kesehatan Kerja) di pintu masuk utama pabrik sudah pudar dan beberapa informasi tidak terbaca. Papan baru telah dipasang oleh tim HSE.',
     1, 3, 'Main Gate', 'a1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000004',
     TRUE, FALSE, NOW() - INTERVAL '7 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days'),

    -- LOW / CLOSED
    ('Loker karyawan nomor 45-52 kunci rusak',
     'Delapan unit loker karyawan di ruang ganti shift B memiliki kunci yang rusak atau macet. Kunci telah diganti oleh maintenance. Karyawan terdampak telah diberi kunci baru.',
     1, 4, 'Employee Locker Room B', 'b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000004',
     TRUE, FALSE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days'),

    -- LOW / OPEN
    ('Request penambahan APAR di area boiler',
     'Berdasarkan audit safety bulanan, area boiler memerlukan 2 unit APAR (Alat Pemadam Api Ringan) tambahan tipe CO2 untuk memenuhi standar NFPA. Pengadaan sedang diproses.',
     1, 1, 'Boiler Room', NULL, 'b2000000-0000-0000-0000-000000000005',
     FALSE, FALSE, NULL, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

-- ---- Soft-deleted incident (for testing) ----
    ('[DELETED] Test incident — abaikan',
     'Incident ini dibuat untuk testing dan telah dihapus.',
     1, 1, 'Test Area', NULL, 'a1000000-0000-0000-0000-000000000001',
     FALSE, TRUE, NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days');

-- ============================================================================
-- 3. DUMMY COMMENTS
-- ============================================================================
-- Add some comments to a few incidents for realistic data

-- Get the IDs of the first few inserted incidents by title match
DO $$
DECLARE
    v_incident_1 UUID;
    v_incident_2 UUID;
    v_incident_4 UUID;
BEGIN
    SELECT id INTO v_incident_1 FROM incidents WHERE title = 'Kebocoran pipa susu di area pasteurisasi' LIMIT 1;
    SELECT id INTO v_incident_2 FROM incidents WHERE title = 'Chiller utama mati total — suhu naik ke 15°C' LIMIT 1;
    SELECT id INTO v_incident_4 FROM incidents WHERE title = 'Motor conveyor filling macet berulang' LIMIT 1;

    IF v_incident_1 IS NOT NULL THEN
        INSERT INTO incident_comments (incident_id, user_id, content, created_at) VALUES
            (v_incident_1, 'b2000000-0000-0000-0000-000000000001',
             'Sudah dilakukan isolasi area. Tekanan pipa diturunkan ke 0 bar. Menunggu tim maintenance untuk penggantian gasket.',
             NOW() - INTERVAL '1 hour 30 minutes'),
            (v_incident_1, 'a1000000-0000-0000-0000-000000000001',
             'Tim maintenance sudah dikirim. ETA 30 menit. Pastikan area tetap steril.',
             NOW() - INTERVAL '1 hour');
    END IF;

    IF v_incident_2 IS NOT NULL THEN
        INSERT INTO incident_comments (incident_id, user_id, content, created_at) VALUES
            (v_incident_2, 'b2000000-0000-0000-0000-000000000003',
             'Spare part kompresor diperkirakan tiba besok pagi dari Surabaya. Sementara ini produk dipindahkan ke Cold Room B.',
             NOW() - INTERVAL '6 hours'),
            (v_incident_2, 'a1000000-0000-0000-0000-000000000001',
             'Ini sudah critical — tolong eskalasi ke vendor PT Refrigindo untuk emergency service.',
             NOW() - INTERVAL '4 hours'),
            (v_incident_2, 'a1000000-0000-0000-0000-000000000002',
             'Sudah menghubungi PT Refrigindo. Teknisi mereka akan datang hari ini jam 14:00.',
             NOW() - INTERVAL '3 hours');
    END IF;

    IF v_incident_4 IS NOT NULL THEN
        INSERT INTO incident_comments (incident_id, user_id, content, created_at) VALUES
            (v_incident_4, 'b2000000-0000-0000-0000-000000000002',
             'Motor sudah trip lagi untuk ke-4 kalinya hari ini. Suhu winding mencapai 92°C. Saya matikan total untuk mencegah kerusakan permanen.',
             NOW() - INTERVAL '3 hours');
    END IF;
END $$;

COMMIT;
