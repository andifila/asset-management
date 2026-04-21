# 💰 Budget App v2 — Setup Guide

## 🚀 Deploy ke GitHub Pages (10 menit)

### Step 1: Buat Repository GitHub
1. Buka [github.com/new](https://github.com/new)
2. Nama repo: `budget-app` (atau bebas)
3. Visibility: **Public** (required untuk GitHub Pages gratis)
4. Klik **Create repository**

### Step 2: Upload File
```bash
# Clone repo kamu
git clone https://github.com/USERNAME/budget-app.git
cd budget-app

# Copy semua file dari folder ini ke repo
# Lalu commit & push
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 3: Aktifkan GitHub Pages
1. Buka repo di GitHub → **Settings**
2. Sidebar: **Pages**
3. Source: **GitHub Actions**
4. Tunggu ~2 menit → App live di:
   `https://USERNAME.github.io/budget-app`

---

## 🔐 Setup Google Drive Backup

### Step 1: Buat Google Cloud Project
1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Klik dropdown project → **New Project**
3. Nama: `Budget App` → **Create**

### Step 2: Enable Google Drive API
1. Menu → **APIs & Services** → **Library**
2. Cari "Google Drive API" → **Enable**

### Step 3: Buat OAuth Credentials
1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Jika diminta, setup Consent Screen dulu:
   - User Type: **External**
   - App name: `Budget App`
   - Email: email kamu
   - Save & Continue (lewati semua field opsional)
4. Kembali buat OAuth Client ID:
   - Application type: **Web application**
   - Name: `Budget App Web`
   - **Authorized JavaScript origins:**
     ```
     https://USERNAME.github.io
     http://localhost:8080
     ```
   - Klik **Create**

### Step 4: Copy Client ID
Setelah dibuat, copy **Client ID** yang terlihat (format: `xxx.apps.googleusercontent.com`)

### Step 5: Pasang ke App
Buka `index.html`, cari baris ini:
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';
```
Ganti dengan Client ID kamu:
```javascript
const GOOGLE_CLIENT_ID = '123456789-abc.apps.googleusercontent.com';
```

### Step 6: Push & Done!
```bash
git add index.html
git commit -m "Add Google Client ID"
git push
```

---

## 📱 Install PWA ke HP

### Android (Chrome):
1. Buka `https://USERNAME.github.io/budget-app`
2. Tap menu `⋮` → **Add to Home Screen**
3. **Install** → App muncul di home screen!

### iPhone (Safari):
1. Buka URL di Safari
2. Tap Share `⬆` → **Add to Home Screen**
3. **Add** → Done!

---

## ✅ Fitur Lengkap

| Fitur | Status |
|-------|--------|
| Dashboard saldo & kategori | ✅ |
| Grafik pengeluaran harian | ✅ |
| CRUD transaksi | ✅ |
| Filter transaksi | ✅ |
| Manajemen akun (debit/kredit) | ✅ |
| Kategori custom | ✅ |
| Dark / Light / Auto mode | ✅ |
| Export JSON & CSV | ✅ |
| Import backup lokal | ✅ |
| Login Google OAuth | ✅ |
| Backup Google Drive | ✅ |
| Auto backup (3s debounce) | ✅ |
| Restore dari Drive | ✅ |
| PWA (installable) | ✅ |
| Offline support | ✅ |

---

## 🔒 Keamanan Data

- Data Drive disimpan di **appDataFolder** (folder tersembunyi khusus app)
- Tidak terlihat di Google Drive biasa pengguna
- Hanya app ini yang bisa akses folder tersebut
- Token OAuth tidak disimpan permanen (perlu login ulang jika expired)

---

## 💡 Tips

- Backup manual: Settings → tombol "Backup"
- Jika auto backup aktif, data tersimpan otomatis 3 detik setelah setiap perubahan
- Untuk multi-device: login Google di semua device → restore dari Drive
