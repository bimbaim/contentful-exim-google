# Contentful Bulk Importer Tool

Proyek **Next.js** ini berfungsi sebagai *bulk import tool* spesifik untuk **Contentful**.  
Aplikasi ini dirancang untuk membaca data terstruktur dari **Google Sheets** dan mengonversinya menjadi entri di Contentful, dengan dukungan penuh untuk **Rich Text**, **Link Asset/Entry**, dan **Object JSON (SEO)**.

---

---

## Instalasi dan Menjalankan Server

Setelah Anda mengunduh atau mengkloning repositori ini, lakukan langkah berikut untuk menjalankan proyek secara lokal.

- npm install
- npm run dev

## 1. Getting Started

Ikuti langkah-langkah di bawah ini untuk menyiapkan dan menjalankan tool impor Anda.

---



### 1.1 Prasyarat

Pastikan Anda sudah memiliki hal-hal berikut:

- **Node.js** (versi 18 atau lebih baru) dan **npm / yarn / pnpm**.
- **Akses Contentful**: memiliki **CMA Token (Access Token)** yang valid.
- **Akses Google Sheets**: file **JSON Service Account Key** dari Google Cloud Console dengan izin baca (*View*) ke spreadsheet Anda.

---

### 1.2 Konfigurasi Lingkungan (`.env.local`)

Buat file bernama `.env.local` di root proyek Anda, lalu isi dengan variabel lingkungan berikut.

```toml
# --- CONTENTFUL CONFIGURATION ---
CONTENTFUL_CMA_TOKEN="<Token CMA Contentful Anda>"
CONTENTFUL_SPACE_ID="<ID Space Contentful Anda>"
CONTENTFUL_ENVIRONMENT_ID="master"
# Kunci: ID Content Type yang dikunci di aplikasi Anda
NEXT_PUBLIC_LOCKED_CONTENT_TYPE_ID="landingPage"

# --- GOOGLE SHEETS API CONFIGURATION ---
# Gunakan Kunci JSON Service Account.
# Pastikan Service Account memiliki izin baca (View) ke Google Sheet Anda.
GOOGLE_PRIVATE_KEY='<Kunci Private dari JSON Service Account, termasuk \\n>'
GOOGLE_CLIENT_EMAIL="<Email Service Account Anda>"


.
