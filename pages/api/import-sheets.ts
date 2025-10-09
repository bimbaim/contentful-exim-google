// pages/api/import-sheets.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient, Entry, Environment } from 'contentful-management';
import { getSheetData } from '../../src/utils/googleSheetsApi';
import { processRichTextMapping } from '../../src/utils/richTextConverter';
import { FieldMapping, SheetRecord, ContentfulEntryFields } from '../../src/utils/types';

// Konfigurasi Contentful (Ambil dari .env.local)
const CMA_TOKEN = process.env.CONTENTFUL_CMA_TOKEN!;
const SPACE_ID = process.env.CONTENTFUL_SPACE_ID!;
const ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';
const LOCALE = 'nl'; // Locale default

// Inisialisasi Klien CMA
const client = createClient({ accessToken: CMA_TOKEN });

/**
 * Helper: Mengubah string URL Google Sheets menjadi ID-nya.
 */
function extractSpreadsheetId(url: string): string {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match || match.length < 2) {
        throw new Error('URL Google Spreadsheet tidak valid.');
    }
    return match[1];
}

/**
 * Helper: Mengonversi nilai yang disubstitusi menjadi objek Link Contentful.
 */
function createContentfulLink(value: string, linkType: 'Entry' | 'Asset'): object | null {
    if (!value) return null;
    return {
        sys: {
            type: 'Link',
            linkType: linkType,
            id: value.trim(),
        }
    };
}

/**
 * Helper: Mengubah string ID yang dipisahkan koma menjadi array Link Contentful.
 */
function createContentfulLinkArray(value: string, linkType: 'Entry' | 'Asset'): object[] {
    if (!value) return [];
    
    const ids = value.split(',').map(id => id.trim()).filter(id => id.length > 0);

    return ids.map(id => ({
        sys: {
            type: 'Link',
            linkType: linkType,
            id: id,
        }
    }));
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed.' });
    }

    const { 
        spreadsheetUrl, 
        sheetName, 
        range, 
        contentTypeId, 
        mapping 
    } = req.body as {
        spreadsheetUrl: string;
        sheetName: string;
        range: string;
        contentTypeId: string;
        mapping: FieldMapping;
    };

    if (!spreadsheetUrl || !contentTypeId || !mapping || Object.keys(mapping).length === 0) {
        return res.status(400).json({ error: 'Data input tidak lengkap.' });
    }

    let importedCount = 0;

    try {
        const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);

        // 1. AMBIL DATA dari Google Sheets
        const records: SheetRecord[] = await getSheetData(spreadsheetId, `${sheetName}!${range}`);
        
        if (records.length === 0) {
             return res.status(404).json({ error: 'Tidak ada baris data ditemukan di spreadsheet.' });
        }

        const space = await client.getSpace(SPACE_ID);
        const environment: Environment = await space.getEnvironment(ENVIRONMENT_ID);

        // 2. ITERASI & IMPOR MASSAL
        for (const record of records) {
            const entryFields: ContentfulEntryFields = {};

            // Logika untuk menentukan ID entri (berdasarkan field 'slug')
            const slugMapping = mapping['slug'] as string;
            const slugHeader = slugMapping ? slugMapping.replace(/{|}/g, '').trim() : '';
            const entrySlug = slugHeader ? (record[slugHeader] || '') : '';

            if (!entrySlug) {
                console.warn('Baris diabaikan: Tidak ada nilai untuk slug di kolom yang dimapping.');
                continue; // Abaikan baris tanpa slug
            }

            // Gunakan slug yang dinormalisasi sebagai ID unik
            const entryId = entrySlug.toLowerCase().replace(/[^a-z0-9]/g, '-');


            // 3. BANGUN OBJEK FIELD BERDASARKAN MAPPING
            for (const [contentfulFieldId, template] of Object.entries(mapping)) {
                
                // 3a. Abaikan jika mapping kosong
                if (!template || (Array.isArray(template) && template.every(t => !t))) {
                    continue; 
                }
                
                // 3b. Abaikan Field Tipe Kompleks yang TIDAK DIDUKUNG (hanya listOfLocation)
                // SEO tidak lagi diabaikan, tapi listOfLocation tetap diabaikan.
                const fieldNameLower = contentfulFieldId.toLowerCase();
                const isIgnoredType = fieldNameLower === 'listoflocation'; 
                
                if (isIgnoredType) {
                    console.warn(`[SKIP] Field ${contentfulFieldId} diabaikan: Tipe Object/Array tidak didukung.`);
                    continue;
                }
                
                // --------------------------------------------------------------------------
                // KASUS KHUSUS: SEO OBJECT (Diambil dari 2 template Array)
                // --------------------------------------------------------------------------
                if (contentfulFieldId === 'seo' && Array.isArray(template) && template.length >= 2) {
                    
                    const titleTemplate = template[0].replace(/{|}/g, '').trim();
                    const descriptionTemplate = template[1].replace(/{|}/g, '').trim();
                    
                    // Substitusi nilai dari record Sheets
                    const seoTitle = record[titleTemplate] || '';
                    const seoDescription = record[descriptionTemplate] || '';

                    // Hanya set field jika kedua nilai ada
                    if (seoTitle && seoDescription) {
                        entryFields[contentfulFieldId] = { 
                            [LOCALE]: {
                                seoTitle: seoTitle,
                                seoDescription: seoDescription
                            } 
                        };
                    } else {
                        console.warn(`[SKIP] Field SEO diabaikan: Data Title atau Description tidak lengkap.`);
                    }
                    continue;
                }

                // --------------------------------------------------------------------------
                // KASUS KHUSUS: productTag (Array of Links) - Input Manual di Form
                // --------------------------------------------------------------------------
                else if (contentfulFieldId === 'productTag' && typeof template === 'string') {
                    const linkArray = createContentfulLinkArray(template, 'Entry'); 
                    if (linkArray.length > 0) {
                        entryFields[contentfulFieldId] = { [LOCALE]: linkArray };
                    }
                    continue; 
                }
                
                // --------------------------------------------------------------------------
                // KASUS RICH TEXT
                // --------------------------------------------------------------------------
                else if (Array.isArray(template)) {
                    const richTextJson = processRichTextMapping(template, record);
                    entryFields[contentfulFieldId] = { [LOCALE]: richTextJson };
                    
                } 
                
                // --------------------------------------------------------------------------
                // KASUS UMUM: Symbol/Link
                // --------------------------------------------------------------------------
                else if (typeof template === 'string') {
                    
                    const isManualEntryLink = contentfulFieldId === 'categoryProduct'; 
                    
                    let headerValue = '';
                    
                    if (isManualEntryLink) {
                        headerValue = template; 
                    } else {
                        const substitutedHeader = template.replace(/{|}/g, '').trim();
                        headerValue = record[substitutedHeader] || '';
                    }
                    
                    // Abaikan jika nilai (dari Sheets/Manual) kosong
                    if (!headerValue && contentfulFieldId !== 'slug') {
                         continue;
                    }
                    
                    // Cek tipe Link
                    const isAssetLink = fieldNameLower.includes('image') || fieldNameLower.includes('banner') || fieldNameLower.includes('iframe');

                    if (isAssetLink) {
                        entryFields[contentfulFieldId] = { [LOCALE]: createContentfulLink(headerValue, 'Asset') };
                    } 
                    else if (isManualEntryLink) {
                        entryFields[contentfulFieldId] = { [LOCALE]: createContentfulLink(headerValue, 'Entry') };
                    }
                    else {
                        entryFields[contentfulFieldId] = { [LOCALE]: headerValue };
                    }
                }
            }


            // 4. BUAT/UPDATE & PUBLISH
            const entryObject = { // EntryProps dihilangkan untuk menghindari error 2740
                sys: { id: entryId },
                fields: entryFields,
            };

            const entry: Entry = await environment.createEntry(contentTypeId, entryObject);

            await entry.publish();
            importedCount++;
        }

        return res.status(200).json({ importedCount });

    } catch (error: unknown) {
        console.error('Contentful Import Failed:', error);
        
        let errorMessage = 'Gagal memproses impor yang tidak diketahui.';
        
        if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = (error as { message: string }).message; 
        }
        
        return res.status(500).json({ error: errorMessage });
    }
}