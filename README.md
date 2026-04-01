# MASDO OFFICIAL [XI-9] 🎓
## Website Portofolio Premium + Sistem Absensi Digital

Sistem web modern dengan design glassmorphism yang menggabungkan portofolio personal dengan sistem absensi digital terintegrasi Google Sheets.

---

## ✨ FITUR UNGGULAN

### 🎨 Design Premium
- **Glassmorphism UI** - Design modern dengan efek glass blur
- **Dark/Light Theme** - Toggle tema dengan animasi smooth
- **Particles.js Background** - Animated particles untuk visual yang menarik
- **Responsive Design** - Optimal di semua perangkat (mobile, tablet, desktop)
- **Smooth Animations** - Scroll animations & transitions yang halus

### 📊 Sistem Absensi
- **Real-time Sync** - Integrasi langsung dengan Google Sheets
- **Dashboard Siswa** - Visualisasi kehadiran dengan Chart.js
- **Panel Admin** - CRUD lengkap untuk kelola siswa & absensi
- **Export Data** - Download data ke CSV
- **Search & Filter** - Cari dan filter data dengan mudah
- **Pagination** - Navigasi data yang efisien

### 🔐 Keamanan
- **JWT Authentication** - Token-based authentication
- **Password Hashing** - Bcrypt untuk enkripsi password
- **Rate Limiting** - Proteksi dari brute force attack
- **Helmet.js** - Security headers
- **Admin Guard** - Middleware khusus untuk akses admin

### 📱 Fitur Tambahan
- **FAQ Section** - Pertanyaan umum dengan toggle animation
- **Skills Showcase** - Progress bar untuk visualisasi skill
- **Projects Portfolio** - Grid showcase project
- **Social Media Links** - Kartu sosial media dengan gradient
- **Toast Notifications** - Notifikasi real-time yang elegan
- **Modal System** - Sistem modal untuk konfirmasi & forms

---

## 📁 STRUKTUR FILE

```
masdo-official/
├── public/
│   ├── index.html          # Frontend SPA (2323 baris)
│   └── style.css           # Styling lengkap (1758 baris)
├── index.js                # Backend Node.js (1105 baris)
├── config.json             # Konfigurasi lengkap (197 baris)
├── package.json            # Dependencies
└── README.md               # Panduan ini
```

**Total: 5419 baris code!**

---

## 🚀 QUICK START

### 1. Install Dependencies
```bash
npm install
```

### 2. Konfigurasi Google Sheets

#### A. Setup Google Cloud Console
1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru atau pilih existing
3. **Enable API:**
   - Cari "Google Sheets API" di Library
   - Klik "Enable"

4. **Buat Service Account:**
   - Menu: IAM & Admin > Service Accounts
   - Create Service Account
   - Name: `masdo-absensi-bot` (atau nama lain)
   - Click "Create and Continue"
   - Skip role assignment > Done

5. **Generate JSON Key:**
   - Klik service account yang baru dibuat
   - Tab "Keys" > Add Key > Create new key
   - Pilih JSON > Create
   - File JSON akan terdownload otomatis

#### B. Setup Google Sheets
1. Buka [sheets.google.com](https://sheets.google.com)
2. Buat spreadsheet baru
3. Buat 2 sheet dengan nama **PERSIS** seperti ini:

**Sheet 1: `DATA_SISWA`**
```
| kode_siswa | nama         | password_hash | jenis_kelamin | no_telepon   |
|------------|--------------|---------------|---------------|--------------|
| XI9-001    | Budi Santoso | [hash]        | L             | 081234567801 |
```

**Sheet 2: `ABSENSI`**
```
| tanggal    | kode_siswa | nama         | status | keterangan |
|------------|------------|--------------|--------|------------|
| 2025-01-15 | XI9-001    | Budi Santoso | H      |            |
```

4. **Share Sheets:**
   - Klik tombol "Share" (pojok kanan atas)
   - Paste email service account dari file JSON
     Contoh: `masdo-absensi-bot@project-id.iam.gserviceaccount.com`
   - Beri akses **Editor**
   - Klik **Send**

5. **Copy Spreadsheet ID:**
   - Lihat URL sheets Anda
   - Format: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`
   - Copy bagian `[SPREADSHEET_ID]`

#### C. Update config.json
1. Buka file JSON key yang didownload dari Google Cloud
2. Copy semua isi file tersebut
3. Buka `config.json` dalam project
4. Paste ke bagian `googleSheets.serviceAccount`:

```json
{
  "googleSheets": {
    "spreadsheetId": "PASTE_SPREADSHEET_ID_DISINI",
    "serviceAccount": {
      "type": "service_account",
      "project_id": "...",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "masdo-absensi-bot@project-id.iam.gserviceaccount.com",
      ...
    }
  }
}
```

5. **Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy hasilnya ke `config.json` > `security.jwtSecret`

6. **Hash Password Admin:**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('passwordAnda', 10).then(console.log)"
```
Copy hasilnya ke `config.json` > `security.adminCredentials.passwordHash`

### 3. Jalankan Server
```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

---

## 🌐 DEPLOYMENT

### Option 1: Render.com (RECOMMENDED - Gratis)

#### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/masdo-official.git
git push -u origin main
```

#### 2. Deploy di Render
1. Buka [render.com](https://render.com) dan login
2. Click **New** > **Web Service**
3. Connect repository GitHub Anda
4. Konfigurasi:
   - **Name:** `masdo-official`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

#### 3. Environment Variables
Tidak perlu - semua konfigurasi sudah di `config.json`

#### 4. Deploy!
Click **Create Web Service**

URL Anda: `https://masdo-official.onrender.com`

⚠️ **Catatan:**  
Free tier Render akan "sleep" setelah 15 menit tidak ada akses.  
Request pertama setelah sleep butuh ~30 detik untuk wake up.

---

### Option 2: Railway.app (Gratis $5/bulan)

1. Buka [railway.app](https://railway.app)
2. Login dengan GitHub
3. **New Project** > **Deploy from GitHub repo**
4. Pilih repository
5. Railway auto-detect Node.js dan deploy otomatis

URL: `https://masdo-official-production.up.railway.app`

---

### Option 3: Vercel (Frontend Only)

Jika ingin deploy frontend terpisah:

1. Deploy folder `public/` ke Vercel
2. Update `API_URL` di `index.html` (line 360) ke URL backend Anda

---

## 🎨 KUSTOMISASI

### Update Profil
Edit `config.json` bagian `profil`:
```json
{
  "profil": {
    "nama": "Nama Kamu",
    "kelas": "XI-9",
    "sekolah": "SMA NEGERI X",
    "tagline": "Developer • Student • Creator",
    "deskripsi": "Deskripsi tentang kamu..."
  }
}
```

### Update Social Media
Edit `config.json` bagian `sosmed`:
```json
{
  "sosmed": [
    {
      "platform": "Instagram",
      "url": "https://instagram.com/username_kamu",
      "username": "@username_kamu"
    }
  ]
}
```

### Update Skills & Projects
Edit di `config.json` bagian `skills` dan `projects`

---

## 📊 CARA PENGGUNAAN

### Login Pertama Kali

**Admin:**
- Username: sesuai `config.json`
- Password: sesuai yang di-hash

**Siswa:**
- Kode Siswa: XI9-XXX (dari Google Sheets)
- Password: sesuai yang di-hash di Sheets

### Admin Input Absensi
1. Login sebagai admin
2. Klik "Input Absensi"
3. Pilih tanggal
4. Klik "Muat Daftar Siswa"
5. Tandai status setiap siswa (H/I/S/A)
6. (Opsional) Tambah keterangan
7. Klik "Simpan Absensi"

Data otomatis tersimpan ke Google Sheets!

### Siswa Cek Absensi
1. Login dengan kode siswa
2. Lihat dashboard dengan statistik & chart
3. Scroll ke bawah untuk detail riwayat

---

## 🔧 TROUBLESHOOTING

### ❌ Error: "Gagal koneksi Google Sheets"
**Solusi:**
- Pastikan `SPREADSHEET_ID` benar
- Pastikan Sheets sudah di-share ke email service account dengan akses Editor
- Pastikan `private_key` di config.json ada `\n` di akhir baris
- Restart server: `npm start`

### ❌ Error: "Token expired"
**Solusi:**
- Token JWT berlaku 8 jam
- Logout dan login ulang
- Pastikan `JWT_SECRET` tidak berubah

### ❌ Server tidak jalan
**Solusi:**
```bash
# Hapus node_modules dan reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### ❌ Port sudah digunakan
**Solusi:**
```bash
# Ganti port di environment variable
PORT=3001 npm start
```

---

## 🛡️ KEAMANAN

### ✅ Best Practices yang Sudah Diterapkan:
- Password di-hash dengan bcrypt (10 rounds)
- JWT token dengan expiry 8 jam
- Helmet.js untuk security headers
- Rate limiting (100 requests/15 menit)
- CORS configured
- Input validation server-side
- Admin-only middleware
- Google Sheets credentials aman di service account

### ⚠️ JANGAN LUPA:
- **JANGAN** commit file dengan credentials ke GitHub
- Ganti JWT_SECRET dengan string random panjang
- Ganti password admin default
- Backup Google Sheets secara berkala
- Aktifkan 2FA di akun Google

---

## 📈 MONITORING

### Check System Health
```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "online",
    "version": "2.0.0",
    "services": {
      "googleSheets": true
    }
  }
}
```

---

## 🆘 SUPPORT

Jika ada masalah atau pertanyaan:
1. Cek dokumentasi di atas dengan teliti
2. Cek log error di console browser (F12)
3. Cek log server di terminal
4. Hubungi developer/admin kelas

---

## 📄 LICENSE

© 2025 MASDO OFFICIAL [XI-9]. All rights reserved.

---

## 🎉 CREDITS

**Technology Stack:**
- Node.js + Express.js
- Google Sheets API
- Chart.js untuk visualisasi
- Particles.js untuk animasi background
- Bcrypt untuk password hashing
- JSON Web Tokens (JWT)
- Helmet.js untuk security

**Dibuat dengan 💙 untuk Kelas XI-9**

---

**Happy Coding! 🚀**
