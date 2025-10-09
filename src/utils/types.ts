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
export type FieldMapping = {
    [contentfulFieldId: string]: string | string[] | undefined;
};

// --- 4. Tipe Data Final Entry Contentful ---
// Struktur dasar yang akan dikirim ke Contentful CMA
export type ContentfulEntryFields = {
    [key: string]: {
        [locale: string]: any;
    };
};