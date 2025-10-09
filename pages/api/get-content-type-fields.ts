// pages/api/get-content-type-fields.ts

import { createClient } from 'contentful-management';
import { NextApiRequest, NextApiResponse } from 'next';

// Inisialisasi Klien CMA secara global (lebih efisien untuk serverless)
// Ambil variabel dari .env.local
const client = createClient({ accessToken: process.env.CONTENTFUL_CMA_TOKEN! });
const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';

/**
 * Endpoint API untuk mengambil daftar field dari Content Type tertentu di Contentful.
 * Contoh Panggilan: /api/get-content-type-fields?contentTypeId=landingPage
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed. Gunakan GET.' });
    }

    const contentTypeId = req.query.contentTypeId as string;

    if (!contentTypeId) {
        return res.status(400).json({ error: 'Content Type ID required.' });
    }

    try {
        const space = await client.getSpace(SPACE_ID!);
        const environment = await space.getEnvironment(ENVIRONMENT_ID);

        // 1. Ambil definisi Content Type dari Contentful
        const contentType = await environment.getContentType(contentTypeId);

        // 2. Format dan kirimkan data field yang dibutuhkan
        const fields = contentType.fields.map(field => ({
            id: field.id, 
            name: field.name,
            type: field.type, 
            // Tambahkan flag untuk membantu frontend menentukan tipe input mapping
            isText: field.type === 'Symbol' || field.type === 'Text',
            isRichText: field.type === 'RichText',
            isLink: field.type === 'Link',
            // Kita tidak menyertakan validasi di sini, tapi bisa ditambahkan
        }));

        return res.status(200).json({ fields });

    } catch (error: any) {
        console.error('Error fetching Content Type:', error.message);
        // Berikan pesan error yang jelas jika Content Type tidak ditemukan atau Token salah
        return res.status(500).json({ error: 'Failed to fetch Content Type schema. Check ID or CMA Token.', details: error.message });
    }
}