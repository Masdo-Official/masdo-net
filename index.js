const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// ==================== SETUP ====================
const app = express();
const PORT = process.env.PORT || 3000;

// Load konfigurasi
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Konstanta
const JWT_SECRET = config.security.jwtSecret;
const JWT_EXPIRY = config.security.jwtExpiry;
const BCRYPT_ROUNDS = config.security.bcryptRounds;
const ADMIN_USERNAME = config.security.adminCredentials.username;
const ADMIN_PASSWORD_HASH = config.security.adminCredentials.passwordHash;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimiting.windowMs,
  max: config.security.rateLimiting.maxRequests,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti' }
});
app.use('/api/', limiter);

// Static files
app.use(express.static('public'));

// ==================== GOOGLE SHEETS SETUP ====================

let sheets = null;
const spreadsheetId = config.googleSheets.spreadsheetId;
const SHEET_DATA_SISWA = config.googleSheets.sheets.dataSiswa;
const SHEET_ABSENSI = config.googleSheets.sheets.absensi;

// Initialize Google Sheets API
async function initializeGoogleSheets() {
  try {
    if (!config.googleSheets.serviceAccount.private_key || !spreadsheetId) {
      throw new Error('Google Sheets credentials belum dikonfigurasi di config.json');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: config.googleSheets.serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });

    // Test koneksi
    await sheets.spreadsheets.get({ spreadsheetId });
    
    console.log('✓ Google Sheets API terhubung');
    return true;
  } catch (error) {
    console.error('✗ Gagal koneksi Google Sheets:', error.message);
    console.error('  → Periksa konfigurasi di config.json');
    console.error('  → Pastikan Service Account JSON sudah benar');
    console.error('  → Pastikan Spreadsheet ID sudah benar');
    console.error('  → Pastikan Sheets sudah di-share ke email service account');
    return false;
  }
}

// ==================== HELPER FUNCTIONS ====================

// Log aktivitas
function logActivity(action, user, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${action} | User: ${user} | Details:`, details);
}

// Validasi email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate password hash
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Verify password
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    return false;
  }
}

// ==================== GOOGLE SHEETS OPERATIONS ====================

// Ambil data siswa dari Sheets
async function getSiswaData(kodeSiswa = null) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_DATA_SISWA}!A2:E`
    });

    const rows = response.data.values || [];
    let data = rows.map(row => ({
      kode_siswa: row[0] || '',
      nama: row[1] || '',
      password_hash: row[2] || '',
      jenis_kelamin: row[3] || '',
      no_telepon: row[4] || ''
    }));

    if (kodeSiswa) {
      data = data.filter(s => s.kode_siswa === kodeSiswa);
    }

    return data;
  } catch (error) {
    console.error('Error getSiswaData:', error.message);
    throw new Error('Gagal mengambil data siswa dari Google Sheets');
  }
}

// Tambah siswa baru
async function addSiswa(siswaData) {
  try {
    const { kode_siswa, nama, password, jenis_kelamin, no_telepon } = siswaData;
    
    // Hash password
    const password_hash = await hashPassword(password);

    const values = [[kode_siswa, nama, password_hash, jenis_kelamin, no_telepon]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_DATA_SISWA}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    logActivity('ADD_SISWA', 'ADMIN', { kode_siswa, nama });
    return true;
  } catch (error) {
    console.error('Error addSiswa:', error.message);
    throw new Error('Gagal menambahkan siswa');
  }
}

// Update password siswa
async function updatePasswordSiswa(kodeSiswa, newPassword) {
  try {
    const siswaList = await getSiswaData();
    const siswaIndex = siswaList.findIndex(s => s.kode_siswa === kodeSiswa);
    
    if (siswaIndex === -1) {
      throw new Error('Siswa tidak ditemukan');
    }

    const password_hash = await hashPassword(newPassword);
    const rowIndex = siswaIndex + 2; // +2 karena header di row 1, data mulai row 2

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_DATA_SISWA}!C${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[password_hash]] }
    });

    logActivity('UPDATE_PASSWORD', kodeSiswa);
    return true;
  } catch (error) {
    console.error('Error updatePasswordSiswa:', error.message);
    throw error;
  }
}

// Hapus siswa
async function deleteSiswa(kodeSiswa) {
  try {
    const siswaList = await getSiswaData();
    const siswaIndex = siswaList.findIndex(s => s.kode_siswa === kodeSiswa);
    
    if (siswaIndex === -1) {
      throw new Error('Siswa tidak ditemukan');
    }

    const rowIndex = siswaIndex + 2;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0, // Assuming DATA_SISWA is first sheet
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });

    logActivity('DELETE_SISWA', 'ADMIN', { kode_siswa: kodeSiswa });
    return true;
  } catch (error) {
    console.error('Error deleteSiswa:', error.message);
    throw new Error('Gagal menghapus siswa');
  }
}

// Ambil data absensi dari Sheets
async function getAbsensiData(filters = {}) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_ABSENSI}!A2:E`
    });

    const rows = response.data.values || [];
    let data = rows.map(row => ({
      tanggal: row[0] || '',
      kode_siswa: row[1] || '',
      nama: row[2] || '',
      status: row[3] || '',
      keterangan: row[4] || ''
    }));

    // Apply filters
    if (filters.kodeSiswa) {
      data = data.filter(item => item.kode_siswa === filters.kodeSiswa);
    }

    if (filters.tanggalMulai && filters.tanggalSelesai) {
      data = data.filter(item => 
        item.tanggal >= filters.tanggalMulai && 
        item.tanggal <= filters.tanggalSelesai
      );
    }

    if (filters.status) {
      data = data.filter(item => item.status === filters.status);
    }

    return data;
  } catch (error) {
    console.error('Error getAbsensiData:', error.message);
    throw new Error('Gagal mengambil data absensi dari Google Sheets');
  }
}

// Simpan absensi batch
async function saveAbsensiBatch(dataAbsensi) {
  try {
    const values = dataAbsensi.map(item => [
      item.tanggal,
      item.kode_siswa,
      item.nama,
      item.status,
      item.keterangan || ''
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_ABSENSI}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    logActivity('SAVE_ABSENSI_BATCH', 'ADMIN', { 
      tanggal: dataAbsensi[0]?.tanggal,
      jumlah: dataAbsensi.length 
    });
    
    return true;
  } catch (error) {
    console.error('Error saveAbsensiBatch:', error.message);
    throw new Error('Gagal menyimpan absensi ke Google Sheets');
  }
}

// Update absensi single
async function updateAbsensi(tanggal, kodeSiswa, newStatus, newKeterangan) {
  try {
    const absensiList = await getAbsensiData({});
    const absensiIndex = absensiList.findIndex(a => 
      a.tanggal === tanggal && a.kode_siswa === kodeSiswa
    );

    if (absensiIndex === -1) {
      throw new Error('Data absensi tidak ditemukan');
    }

    const rowIndex = absensiIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_ABSENSI}!D${rowIndex}:E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[newStatus, newKeterangan || '']] }
    });

    logActivity('UPDATE_ABSENSI', kodeSiswa, { tanggal, newStatus });
    return true;
  } catch (error) {
    console.error('Error updateAbsensi:', error.message);
    throw error;
  }
}

// Hapus absensi
async function deleteAbsensi(tanggal, kodeSiswa) {
  try {
    const absensiList = await getAbsensiData({});
    const absensiIndex = absensiList.findIndex(a => 
      a.tanggal === tanggal && a.kode_siswa === kodeSiswa
    );

    if (absensiIndex === -1) {
      throw new Error('Data absensi tidak ditemukan');
    }

    const rowIndex = absensiIndex + 2;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 1, // Assuming ABSENSI is second sheet
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });

    logActivity('DELETE_ABSENSI', kodeSiswa, { tanggal });
    return true;
  } catch (error) {
    console.error('Error deleteAbsensi:', error.message);
    throw new Error('Gagal menghapus absensi');
  }
}

// Get statistik absensi
async function getAbsensiStats(filters = {}) {
  try {
    const absensiData = await getAbsensiData(filters);
    
    const stats = {
      total: absensiData.length,
      hadir: absensiData.filter(a => a.status === 'H').length,
      izin: absensiData.filter(a => a.status === 'I').length,
      sakit: absensiData.filter(a => a.status === 'S').length,
      alpa: absensiData.filter(a => a.status === 'A').length
    };

    stats.persentaseKehadiran = stats.total > 0 
      ? ((stats.hadir / stats.total) * 100).toFixed(2)
      : 0;

    return stats;
  } catch (error) {
    console.error('Error getAbsensiStats:', error.message);
    throw new Error('Gagal menghitung statistik absensi');
  }
}

// ==================== MIDDLEWARE AUTH ====================

// Verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token tidak ditemukan. Silakan login terlebih dahulu.' 
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token sudah kadaluarsa. Silakan login ulang.' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Token tidak valid.' 
    });
  }
}

// Admin only middleware
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya admin yang dapat mengakses.' 
    });
  }
  next();
}

// ==================== ROUTES - PUBLIC ====================

// GET /api/config - Ambil konfigurasi publik
app.get('/api/config', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        app: config.app,
        profil: config.profil,
        sosmed: config.sosmed,
        projects: config.projects,
        ui: config.ui,
        features: {
          enableRegistration: config.features.enableRegistration
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Gagal memuat konfigurasi' 
    });
  }
});

// GET /api/health - Health check
app.get('/api/health', async (req, res) => {
  try {
    const sheetsConnected = sheets !== null;
    
    res.json({
      success: true,
      data: {
        status: 'online',
        version: config.app.version,
        timestamp: new Date().toISOString(),
        services: {
          googleSheets: sheetsConnected
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Health check failed' 
    });
  }
});

// ==================== ROUTES - AUTH ====================

// POST /api/login - Login siswa
app.post('/api/login', async (req, res) => {
  try {
    const { kode_siswa, password } = req.body;

    // Validasi input
    if (!kode_siswa || !password) {
      return res.status(400).json({
        success: false,
        message: 'Kode siswa dan password wajib diisi'
      });
    }

    // Cek siswa di database
    const siswaList = await getSiswaData(kode_siswa);
    
    if (siswaList.length === 0) {
      logActivity('LOGIN_FAILED', kode_siswa, { reason: 'Kode siswa tidak ditemukan' });
      return res.status(401).json({
        success: false,
        message: 'Kode siswa tidak ditemukan'
      });
    }

    const siswa = siswaList[0];

    // Verify password
    const passwordMatch = await verifyPassword(password, siswa.password_hash);

    if (!passwordMatch) {
      logActivity('LOGIN_FAILED', kode_siswa, { reason: 'Password salah' });
      return res.status(401).json({
        success: false,
        message: 'Password salah'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        kode_siswa: siswa.kode_siswa,
        nama: siswa.nama,
        role: 'siswa'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    logActivity('LOGIN_SUCCESS', kode_siswa);

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        kode_siswa: siswa.kode_siswa,
        nama: siswa.nama,
        jenis_kelamin: siswa.jenis_kelamin,
        role: 'siswa'
      }
    });

  } catch (error) {
    console.error('Error login siswa:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat login'
    });
  }
});

// POST /api/admin/login - Login admin
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi'
      });
    }

    if (username !== ADMIN_USERNAME) {
      logActivity('ADMIN_LOGIN_FAILED', username, { reason: 'Username salah' });
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    const passwordMatch = await verifyPassword(password, ADMIN_PASSWORD_HASH);

    if (!passwordMatch) {
      logActivity('ADMIN_LOGIN_FAILED', username, { reason: 'Password salah' });
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    logActivity('ADMIN_LOGIN_SUCCESS', username);

    res.json({
      success: true,
      message: 'Login admin berhasil',
      token,
      user: {
        username: ADMIN_USERNAME,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Error login admin:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat login'
    });
  }
});

// POST /api/change-password - Ubah password (siswa)
app.post('/api/change-password', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'siswa') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint ini hanya untuk siswa'
      });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password lama dan baru wajib diisi'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal 6 karakter'
      });
    }

    // Verify old password
    const siswaList = await getSiswaData(req.user.kode_siswa);
    const siswa = siswaList[0];

    const oldPasswordMatch = await verifyPassword(oldPassword, siswa.password_hash);

    if (!oldPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Password lama salah'
      });
    }

    // Update password
    await updatePasswordSiswa(req.user.kode_siswa, newPassword);

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });

  } catch (error) {
    console.error('Error change password:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengubah password'
    });
  }
});

// ==================== ROUTES - SISWA ====================

// GET /api/absensi - Ambil absensi siswa yang login
app.get('/api/absensi', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'siswa') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint ini hanya untuk siswa'
      });
    }

    const absensiData = await getAbsensiData({ kodeSiswa: req.user.kode_siswa });
    const stats = await getAbsensiStats({ kodeSiswa: req.user.kode_siswa });

    // Sort by date descending
    absensiData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    res.json({
      success: true,
      data: {
        stats,
        detail: absensiData
      }
    });

  } catch (error) {
    console.error('Error get absensi siswa:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil data absensi'
    });
  }
});

// GET /api/absensi/stats - Statistik absensi siswa
app.get('/api/absensi/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'siswa') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint ini hanya untuk siswa'
      });
    }

    const stats = await getAbsensiStats({ kodeSiswa: req.user.kode_siswa });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error get stats:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik absensi'
    });
  }
});

// ==================== ROUTES - ADMIN ====================

// GET /api/admin/siswa - Daftar semua siswa
app.get('/api/admin/siswa', verifyToken, adminOnly, async (req, res) => {
  try {
    const siswaList = await getSiswaData();

    // Remove password hash from response
    const siswaClean = siswaList.map(s => ({
      kode_siswa: s.kode_siswa,
      nama: s.nama,
      jenis_kelamin: s.jenis_kelamin,
      no_telepon: s.no_telepon
    }));

    res.json({
      success: true,
      data: siswaClean
    });

  } catch (error) {
    console.error('Error get siswa list:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil data siswa'
    });
  }
});

// POST /api/admin/siswa - Tambah siswa baru
app.post('/api/admin/siswa', verifyToken, adminOnly, async (req, res) => {
  try {
    const { kode_siswa, nama, password, jenis_kelamin, no_telepon } = req.body;

    // Validasi
    if (!kode_siswa || !nama || !password || !jenis_kelamin) {
      return res.status(400).json({
        success: false,
        message: 'Kode siswa, nama, password, dan jenis kelamin wajib diisi'
      });
    }

    // Cek duplikasi
    const existing = await getSiswaData(kode_siswa);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Kode siswa sudah terdaftar'
      });
    }

    await addSiswa({ kode_siswa, nama, password, jenis_kelamin, no_telepon: no_telepon || '' });

    res.json({
      success: true,
      message: 'Siswa berhasil ditambahkan'
    });

  } catch (error) {
    console.error('Error add siswa:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal menambahkan siswa'
    });
  }
});

// DELETE /api/admin/siswa/:kode - Hapus siswa
app.delete('/api/admin/siswa/:kode', verifyToken, adminOnly, async (req, res) => {
  try {
    const kodeSiswa = req.params.kode;

    await deleteSiswa(kodeSiswa);

    res.json({
      success: true,
      message: 'Siswa berhasil dihapus'
    });

  } catch (error) {
    console.error('Error delete siswa:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal menghapus siswa'
    });
  }
});

// GET /api/admin/absensi - Semua data absensi
app.get('/api/admin/absensi', verifyToken, adminOnly, async (req, res) => {
  try {
    const { tanggalMulai, tanggalSelesai, status } = req.query;

    const filters = {};
    if (tanggalMulai) filters.tanggalMulai = tanggalMulai;
    if (tanggalSelesai) filters.tanggalSelesai = tanggalSelesai;
    if (status) filters.status = status;

    const absensiData = await getAbsensiData(filters);

    // Sort by date descending
    absensiData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    res.json({
      success: true,
      data: absensiData
    });

  } catch (error) {
    console.error('Error get all absensi:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil data absensi'
    });
  }
});

// POST /api/admin/absensi - Simpan absensi baru
app.post('/api/admin/absensi', verifyToken, adminOnly, async (req, res) => {
  try {
    const { tanggal, dataAbsensi } = req.body;

    if (!tanggal || !Array.isArray(dataAbsensi) || dataAbsensi.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal dan data absensi wajib diisi'
      });
    }

    // Format data
    const formattedData = dataAbsensi.map(item => ({
      tanggal,
      kode_siswa: item.kode_siswa,
      nama: item.nama,
      status: item.status,
      keterangan: item.keterangan || ''
    }));

    await saveAbsensiBatch(formattedData);

    res.json({
      success: true,
      message: `Absensi untuk ${dataAbsensi.length} siswa berhasil disimpan`
    });

  } catch (error) {
    console.error('Error save absensi:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal menyimpan absensi'
    });
  }
});

// PUT /api/admin/absensi - Update absensi
app.put('/api/admin/absensi', verifyToken, adminOnly, async (req, res) => {
  try {
    const { tanggal, kode_siswa, status, keterangan } = req.body;

    if (!tanggal || !kode_siswa || !status) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal, kode siswa, dan status wajib diisi'
      });
    }

    await updateAbsensi(tanggal, kode_siswa, status, keterangan);

    res.json({
      success: true,
      message: 'Absensi berhasil diupdate'
    });

  } catch (error) {
    console.error('Error update absensi:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengupdate absensi'
    });
  }
});

// DELETE /api/admin/absensi - Hapus absensi
app.delete('/api/admin/absensi', verifyToken, adminOnly, async (req, res) => {
  try {
    const { tanggal, kode_siswa } = req.body;

    if (!tanggal || !kode_siswa) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal dan kode siswa wajib diisi'
      });
    }

    await deleteAbsensi(tanggal, kode_siswa);

    res.json({
      success: true,
      message: 'Absensi berhasil dihapus'
    });

  } catch (error) {
    console.error('Error delete absensi:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal menghapus absensi'
    });
  }
});

// GET /api/admin/stats - Dashboard statistik admin
app.get('/api/admin/stats', verifyToken, adminOnly, async (req, res) => {
  try {
    const siswaList = await getSiswaData();
    const today = new Date().toISOString().split('T')[0];
    
    const statsToday = await getAbsensiStats({ 
      tanggalMulai: today, 
      tanggalSelesai: today 
    });

    const statsAll = await getAbsensiStats({});

    res.json({
      success: true,
      data: {
        totalSiswa: siswaList.length,
        absensiHariIni: statsToday,
        absensiKeseluruhan: statsAll
      }
    });

  } catch (error) {
    console.error('Error get admin stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil statistik'
    });
  }
});

// GET /api/admin/export - Export data absensi
app.get('/api/admin/export', verifyToken, adminOnly, async (req, res) => {
  try {
    const { format = 'json', tanggalMulai, tanggalSelesai } = req.query;

    const filters = {};
    if (tanggalMulai) filters.tanggalMulai = tanggalMulai;
    if (tanggalSelesai) filters.tanggalSelesai = tanggalSelesai;

    const absensiData = await getAbsensiData(filters);

    if (format === 'csv') {
      // Generate CSV
      const headers = 'Tanggal,Kode Siswa,Nama,Status,Keterangan\n';
      const rows = absensiData.map(item => 
        `${item.tanggal},${item.kode_siswa},${item.nama},${item.status},${item.keterangan}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=absensi_export.csv');
      res.send(headers + rows);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: absensiData,
        metadata: {
          totalRecords: absensiData.length,
          exportedAt: new Date().toISOString(),
          filters
        }
      });
    }

  } catch (error) {
    console.error('Error export data:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal export data'
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'API endpoint tidak ditemukan'
    });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan server internal'
  });
});

// ==================== START SERVER ====================

async function startServer() {
  console.log('='.repeat(60));
  console.log('🚀 MASDO OFFICIAL [XI-9] - Backend Server');
  console.log('='.repeat(60));

  // Initialize Google Sheets
  const sheetsInitialized = await initializeGoogleSheets();

  if (!sheetsInitialized) {
    console.log('');
    console.log('⚠️  WARNING: Google Sheets tidak terhubung!');
    console.log('   Server akan tetap berjalan tapi API akan error.');
    console.log('   Silakan konfigurasikan Google Sheets di config.json');
    console.log('');
  }

  app.listen(PORT, () => {
    console.log(`✓ Server running: http://localhost:${PORT}`);
    console.log(`✓ Version: ${config.app.version}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Google Sheets: ${sheetsInitialized ? 'Connected ✓' : 'Not Connected ✗'}`);
    console.log('='.repeat(60));
    
    if (sheetsInitialized) {
      console.log('');
      console.log('📊 Sistem siap digunakan!');
      console.log('   Frontend: http://localhost:' + PORT);
      console.log('   API: http://localhost:' + PORT + '/api');
      console.log('');
    }
    
    console.log('='.repeat(60));
  });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Start the server
startServer();
