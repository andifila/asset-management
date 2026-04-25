# Asset Tracker v2 — Setup Guide
## Stack: React + Vite + Supabase (Google OAuth) + GitHub Pages

---

## STEP 1 — Buat Project Supabase

1. Buka https://supabase.com → **Start your project** → login dengan GitHub/Google
2. Klik **New project**
   - Name: `asset-tracker`
   - Database Password: buat yang kuat, simpan baik-baik
   - Region: **Southeast Asia (Singapore)**
3. Tunggu ~1-2 menit sampai project siap

---

## STEP 2 — Jalankan Schema Database

1. Di Supabase dashboard → klik **SQL Editor** (ikon terminal di sidebar)
2. Klik **New query**
3. Copy-paste seluruh isi file `supabase_schema.sql`
4. Klik **Run** (atau Ctrl+Enter)
5. Pastikan muncul pesan sukses, tidak ada error merah

---

## STEP 3 — Setup Google OAuth

### A. Di Google Cloud Console

1. Buka https://console.cloud.google.com
2. Buat project baru (atau pakai yang sudah ada):
   - Klik dropdown project di atas → **New Project** → beri nama → Create
3. Di sidebar → **APIs & Services** → **OAuth consent screen**
   - User Type: **External** → Create
   - App name: `Asset Tracker`
   - User support email: email kamu
   - Developer contact: email kamu
   - Klik **Save and Continue** (skip bagian Scopes dan Test users)
   - Klik **Back to Dashboard**
4. Di sidebar → **APIs & Services** → **Credentials**
   - Klik **+ Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Asset Tracker Web`
   - **Authorized JavaScript origins**: tambahkan
     ```
     https://NAMA_REPO_SUPABASE.supabase.co
     ```
     (URL project Supabase kamu)
   - **Authorized redirect URIs**: tambahkan
     ```
     https://NAMA_REPO_SUPABASE.supabase.co/auth/v1/callback
     ```
   - Klik **Create**
5. Catat **Client ID** dan **Client Secret** yang muncul

### B. Di Supabase

1. Supabase dashboard → **Authentication** → **Providers**
2. Scroll ke **Google** → klik untuk expand
3. Toggle **Enable** → ON
4. Isi:
   - **Client ID**: dari langkah A nomor 5
   - **Client Secret**: dari langkah A nomor 5
5. Copy **Callback URL (for OAuth)** yang tertera di sini
   (Bentuknya: `https://xxxx.supabase.co/auth/v1/callback`)
   → Pastikan URL ini sudah dimasukkan di Google Cloud tadi
6. Klik **Save**

### C. Tambahkan Redirect URL

1. Masih di Supabase → **Authentication** → **URL Configuration**
2. Di **Redirect URLs**, tambahkan URL GitHub Pages kamu:
   ```
   https://USERNAME.github.io/asset-tracker/
   ```
   (ganti USERNAME dengan username GitHub kamu)
3. Klik **Save**

---

## STEP 4 — Setup Project Lokal

```bash
# Masuk ke folder project
cd asset-tracker-v2

# Install dependencies
npm install

# Buat file .env.local
cp .env.local.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Nilai ini ada di: Supabase → **Settings** → **API**

### Test lokal dulu
```bash
npm run dev
```
Buka http://localhost:5173/asset-tracker/ → klik **Masuk dengan Google**

> Jika muncul error "redirect_uri_mismatch", tambahkan juga
> `http://localhost:5173/asset-tracker/` ke Authorized redirect URIs
> di Google Cloud Console.

---

## STEP 5 — Deploy ke GitHub Pages

### Buat repo GitHub (Private!)

1. Buka https://github.com → **New repository**
2. Repository name: `asset-tracker`
3. Visibility: **Private** ✅
4. **Jangan** centang "Add README"
5. Klik **Create repository**

### Tambah Secrets ke GitHub

1. Di repo GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Klik **New repository secret**, tambahkan 2 secrets:
   - Name: `VITE_SUPABASE_URL` → Value: URL Supabase kamu
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: Anon key Supabase kamu

### Push ke GitHub

```bash
git init
git add .
git commit -m "feat: initial asset tracker"
git branch -M main
git remote add origin https://github.com/USERNAME/asset-tracker.git
git push -u origin main
```

### Aktifkan GitHub Pages

Setelah push, GitHub Actions akan otomatis build & deploy.
Tunggu ~2 menit, lalu:

1. Repo GitHub → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** → folder: **/ (root)** → Save

Website live di: `https://USERNAME.github.io/asset-tracker/`

---

## Troubleshooting

| Problem | Solusi |
|---------|--------|
| Redirect error setelah login Google | Pastikan redirect URL sudah ditambah di Supabase Auth → URL Configuration |
| `redirect_uri_mismatch` di Google | Tambahkan URL yang tertera di error ke Google Cloud Console → Credentials |
| Data tidak muncul setelah login | Pastikan SQL schema sudah dijalankan di Supabase |
| Build gagal di GitHub Actions | Cek apakah secrets sudah diisi dengan benar |
| Blank page di GitHub Pages | Pastikan `base` di `vite.config.js` sesuai nama repo |

---

## Struktur File

```
asset-tracker-v2/
├── .github/workflows/deploy.yml   ← Auto-deploy CI/CD
├── src/
│   ├── App.jsx                    ← Auth gate
│   ├── main.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js
│   │   └── format.js
│   ├── pages/
│   │   ├── Login.jsx              ← Tombol "Masuk dengan Google"
│   │   └── Dashboard.jsx
│   └── components/
│       ├── Modal.jsx
│       ├── Summary.jsx
│       ├── BibitTable.jsx
│       ├── BinanceTable.jsx
│       ├── PhysicalTable.jsx
│       └── LiquidTable.jsx
├── supabase_schema.sql
├── vite.config.js
├── package.json
└── .env.local.example
```
