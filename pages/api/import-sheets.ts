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
const IMPORTER_PASSWORD = process.env.IMPORTER_PASSWORD;
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
 * Helper: Mengonversi nilai menjadi Link Contentful.
 */
function createContentfulLink(value: string, linkType: 'Entry' | 'Asset'): object | null {
  if (!value) return null;
  return {
    sys: {
      type: 'Link',
      linkType: linkType,
      id: value.trim(),
    },
  };
}

/**
 * Helper: Mengubah string ID yang dipisahkan koma menjadi array Link Contentful.
 */
function createContentfulLinkArray(value: string, linkType: 'Entry' | 'Asset'): object[] {
  if (!value) return [];
  const ids = value.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
  return ids.map((id) => ({
    sys: {
      type: 'Link',
      linkType: linkType,
      id: id,
    },
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
    mapping,
    password: submittedPassword,
  } = req.body as {
    spreadsheetUrl: string;
    sheetName: string;
    range: string;
    contentTypeId: string;
    mapping: FieldMapping;
    password: string;
  };

  // 🔒 Validasi Password
  if (!IMPORTER_PASSWORD) {
    console.error('Variabel IMPORTER_PASSWORD tidak diset di .env');
    return res.status(500).json({ error: 'Konfigurasi server tidak lengkap: Password impor tidak diset.' });
  }

  if (submittedPassword !== IMPORTER_PASSWORD) {
    console.warn('Upaya impor gagal: Password tidak valid.');
    return res.status(401).json({ error: 'Akses Ditolak: Password Impor tidak valid.' });
  }

  if (!spreadsheetUrl || !contentTypeId || !mapping || Object.keys(mapping).length === 0) {
    return res.status(400).json({ error: 'Data input tidak lengkap.' });
  }

  let importedCount = 0;

  try {
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    const records: SheetRecord[] = await getSheetData(spreadsheetId, `${sheetName}!${range}`);

    if (records.length === 0) {
      return res.status(404).json({ error: 'Tidak ada baris data ditemukan di spreadsheet.' });
    }

    const space = await client.getSpace(SPACE_ID);
    const environment: Environment = await space.getEnvironment(ENVIRONMENT_ID);

    // ---------------------------
    //  BATAS IMPORT BESAR
    // ---------------------------
    const BATCH_SIZE = 500;
    const DELAY_MS = 200;
    const PAUSE_BETWEEN_BATCH_MS = 5000;

    const totalRecords = records.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    console.log(`🚀 Memulai impor ${totalRecords} data dalam ${totalBatches} batch...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalRecords);
      const batch = records.slice(start, end);

      console.log(`📦 Memproses batch ${batchIndex + 1}/${totalBatches} (${batch.length} entries)`);

      for (const record of batch) {
        const entryFields: ContentfulEntryFields = {};

        // Gunakan slug sebagai ID unik
        const slugMapping = mapping['slug'] as string;
        const slugHeader = slugMapping ? slugMapping.replace(/{|}/g, '').trim() : '';
        const entrySlug = slugHeader ? (record[slugHeader] || '') : '';

        if (!entrySlug) {
          console.warn('Baris diabaikan: Tidak ada nilai untuk slug di kolom yang dimapping.');
          continue;
        }

        const entryId = entrySlug.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // -------------- MAPPING FIELD ----------------
        for (const [contentfulFieldId, template] of Object.entries(mapping)) {
          if (!template || (Array.isArray(template) && template.every((t) => !t))) continue;

          const fieldNameLower = contentfulFieldId.toLowerCase();
          const isIgnoredType = fieldNameLower === 'listoflocation';
          if (isIgnoredType) continue;

          if (contentfulFieldId === 'seo' && Array.isArray(template) && template.length >= 2) {
            const titleTemplate = template[0].replace(/{|}/g, '').trim();
            const descriptionTemplate = template[1].replace(/{|}/g, '').trim();

            const seoTitle = record[titleTemplate] || '';
            const seoDescription = record[descriptionTemplate] || '';

            if (seoTitle && seoDescription) {
              entryFields[contentfulFieldId] = {
                [LOCALE]: { seoTitle, seoDescription },
              };
            }
            continue;
          }

          if (contentfulFieldId === 'productTag' && typeof template === 'string') {
            const linkArray = createContentfulLinkArray(template, 'Entry');
            if (linkArray.length > 0) {
              entryFields[contentfulFieldId] = { [LOCALE]: linkArray };
            }
            continue;
          }

          if (Array.isArray(template)) {
            const richTextJson = processRichTextMapping(template, record);
            entryFields[contentfulFieldId] = { [LOCALE]: richTextJson };
          } else if (typeof template === 'string') {
            const isManualEntryLink = contentfulFieldId === 'categoryProduct';
            let headerValue = '';

            if (isManualEntryLink) {
              headerValue = template;
            } else {
              const substitutedHeader = template.replace(/{|}/g, '').trim();
              headerValue = record[substitutedHeader] || '';
            }

            if (!headerValue && contentfulFieldId !== 'slug') continue;

            const isAssetLink = fieldNameLower.includes('image') || fieldNameLower.includes('banner') || fieldNameLower.includes('iframe');

            if (isAssetLink) {
              const linkObject = createContentfulLink(headerValue, 'Asset');
              if (linkObject) {
                entryFields[contentfulFieldId] = { [LOCALE]: linkObject };
              }
            } else if (isManualEntryLink) {
              const linkObject = createContentfulLink(headerValue, 'Entry');
              if (linkObject) {
                entryFields[contentfulFieldId] = { [LOCALE]: linkObject };
              }
            } else {
              entryFields[contentfulFieldId] = { [LOCALE]: headerValue };
            }
          }
        }

        // -------------- CREATE / UPDATE ENTRY ----------------
        try {
          const existing = await environment.getEntries({
            content_type: contentTypeId,
            'fields.slug': entrySlug,
            limit: 1,
          });

          let entry: Entry;

          if (existing.items.length > 0) {
            entry = existing.items[0];
            Object.entries(entryFields).forEach(([fieldId, value]) => {
              entry.fields[fieldId] = value;
            });
            entry = await entry.update();
            console.log(`[UPDATED] ${entrySlug}`);
          } else {
            entry = await environment.createEntryWithId(contentTypeId, entryId, { fields: entryFields });
            console.log(`[CREATED] ${entrySlug}`);
          }

          await entry.publish();
          console.log(`[PUBLISHED] ${entrySlug}`);
          importedCount++;
        } catch (err) {
          console.error(`❌ Gagal impor slug "${entrySlug}"`, err);
        }

        // 🕒 Delay antar entry
        await new Promise((res) => setTimeout(res, DELAY_MS));
      }

      // 🕐 Pause antar batch
      if (batchIndex < totalBatches - 1) {
        console.log(`⏸️  Istirahat ${PAUSE_BETWEEN_BATCH_MS / 1000} detik sebelum batch berikutnya...`);
        await new Promise((res) => setTimeout(res, PAUSE_BETWEEN_BATCH_MS));
      }
    }

    console.log(`✅ Impor selesai! Total berhasil: ${importedCount}/${totalRecords}`);
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
