// src/utils/googleSheetsApi.ts

import { GoogleAuth } from 'google-auth-library';
import { sheets } from '@googleapis/sheets';
import { SheetRecord } from './types';

// Inisialisasi Klien Google Sheets
// Ambil variabel dari .env.local
const auth = new GoogleAuth({
    credentials: {
        // Private Key harus dikonversi dari string dengan escape sequence '\n' menjadi karakter new line yang sebenarnya.
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const googleSheetsClient = sheets({ version: 'v4', auth });

/**
 * Mengambil data dari Google Sheets dan mengembalikannya sebagai array objek JavaScript.
 * @param spreadsheetId ID spreadsheet.
 * @param range Range data (misal: 'Sheet1!A1:Z').
 * @returns Array of SheetRecord.
 */
export async function getSheetData(spreadsheetId: string, range: string): Promise<SheetRecord[]> {
    
    // Panggilan API ke Google Sheets
    const sheetResponse = await googleSheetsClient.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
    });

    const rawData = sheetResponse.data.values;
    if (!rawData || rawData.length < 2) {
        throw new Error('Tidak ada data yang valid ditemukan di spreadsheet.');
    }

    // Baris pertama adalah Header
    const headers = rawData[0];
    // Baris-baris berikutnya adalah Data
    const dataRows = rawData.slice(1);
    
    // Konversi Array of Arrays menjadi Array of Objects (SheetRecord)
    const records: SheetRecord[] = dataRows.map(row => {
        const record: SheetRecord = {};
        headers.forEach((header: string, index: number) => {
            // Trim whitespace dan pastikan nilai adalah string
            record[header.trim()] = (row[index] || '').trim();
        });
        return record;
    });

    return records;
}