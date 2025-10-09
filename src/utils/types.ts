// src/utils/types.ts

// --- 1. Tipe Data dari Google Sheets API ---
// Record adalah satu baris data dari spreadsheet, dengan key adalah header kolom
export type SheetRecord = {
    [sheetHeader: string]: string;
};

// --- 2. Tipe Data dari Contentful API (Skema Field) ---
export interface ContentfulField {
    id: string; // ID Field Contentful (e.g., 'title', 'content')
    name: string; // Nama Field (e.g., 'Judul Halaman')
    type: string; // Tipe Field (e.g., 'Symbol', 'RichText')
    isText: boolean; // Flag untuk input teks sederhana
    isRichText: boolean; // Flag untuk Rich Text builder
    isLink: boolean; // Flag untuk Link/Reference
}

// --- 3. Tipe Data Mapping dari Frontend ---
// Kunci adalah Contentful Field ID (e.g., 'title'), Nilai adalah template Sheets atau array template.
// Menghapus 'undefined' karena mapping yang kosong diabaikan di backend
export type FieldMapping = {
    [contentfulFieldId: string]: string | string[];
};

// --- 4. Tipe Data Final Entry Contentful ---
// Struktur dasar yang akan dikirim ke Contentful CMA
// FIX: Mengganti 'any' dengan tipe yang lebih spesifik (string untuk teks, object/object[] untuk RichText/Link/JSON Object)
export type ContentfulEntryFields = {
    [key: string]: {
        [locale: string]: string | object | object[];
    };
};