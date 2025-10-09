// pages/index.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// =====================================================================
// KONSTANTA STATIK CONTENT TYPE YANG DIKUNCI
// =====================================================================
const LOCKED_CONTENT_TYPE_ID = process.env.NEXT_PUBLIC_LOCKED_CONTENT_TYPE_ID || "landingPage"; 
// =====================================================================

// --- Interface untuk Tipe Data yang Diperlukan ---
interface ContentfulField {
    id: string;
    name: string;
    type: string;
    isText: boolean;
    isRichText: boolean;
    isLink: boolean;
}

interface FieldMapping {
    [contentfulFieldId: string]: string | string[];
}

// --- Komponen Input Mapping Sederhana (Symbol/Link/Array Manual) ---
const SimpleMappingInput: React.FC<{field: ContentfulField, mapping: FieldMapping, setMapping: React.Dispatch<React.SetStateAction<FieldMapping>>}> = ({ field, mapping, setMapping }) => {
    
    // Tentukan apakah field ini diisi manual (productTag dan categoryProduct)
    const isArrayField = field.id === 'productTag';
    const isManualLinkField = field.id === 'categoryProduct';
    
    const isInputManual = isArrayField || isManualLinkField;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMapping(prev => ({
            ...prev,
            [field.id]: e.target.value
        }));
    };

    const getPlaceholder = () => {
        if (field.id === 'slug') return "Contoh: {Product Slug} (Header Sheets)";
        if (isArrayField) return "Masukkan ID Entry yang dipisahkan koma, e.g., ID1, ID2";
        if (isManualLinkField) return "Masukkan satu ID Entry, e.g., LSHVk5Eos1FCinF3VepMA";
        // Default adalah mapping dari Sheets
        return "Masukkan header Sheets dalam kurung kurawal, e.g., {Kolom_A}";
    };

    return (
        <div style={{ marginBottom: '15px', border: `1px solid ${isInputManual ? '#3388ff' : '#ccc'}`, padding: '10px', borderRadius: '4px', background: isInputManual ? '#f7faff' : 'white' }}>
            <label style={{ fontWeight: 'bold' }}>
                {field.name} (`{field.id}`) ({field.type}) 
                {isInputManual && <span style={{ color: '#3388ff', marginLeft: '5px' }}>(INPUT MANUAL)</span>}
            </label>
            <input
                type="text"
                value={(mapping[field.id] as string) || ''}
                onChange={handleChange}
                placeholder={getPlaceholder()}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
        </div>
    );
};

// --- Komponen Input Mapping Kompleks (untuk Rich Text dan SEO Object) ---
const ComplexMappingInput: React.FC<{field: ContentfulField, mapping: FieldMapping, setMapping: React.Dispatch<React.SetStateAction<FieldMapping>>}> = ({ field, mapping, setMapping }) => {
    
    const isSEO = field.id === 'seo';
    const currentTemplates = (mapping[field.id] as string[]) || [];

    // SEO hanya mengizinkan 2 template (Title dan Description)
    const maxTemplates = isSEO ? 2 : undefined; 

    const addTemplate = () => {
        if (isSEO && currentTemplates.length >= 2) return;

        setMapping(prev => ({
            ...prev,
            [field.id]: [...currentTemplates, '']
        }));
    };

    const removeTemplate = (index: number) => {
        setMapping(prev => ({
            ...prev,
            [field.id]: currentTemplates.filter((_, i) => i !== index)
        }));
    };

    const updateTemplate = (index: number, value: string) => {
        const newTemplates = [...currentTemplates];
        newTemplates[index] = value;
        setMapping(prev => ({
            ...prev,
            [field.id]: newTemplates
        }));
    };

    const getPlaceholder = (index: number) => {
        if (isSEO) {
            return index === 0 ? 'e.g., {Meta title}' : 'e.g., {Meta description}';
        }
        return 'e.g., <h2>{H2_Title}</h2> atau <p>{Body_Text}</p>';
    }

    return (
        <div style={{ marginBottom: '15px', border: '2px solid #0070f3', padding: '15px', borderRadius: '4px', background: '#e6f7ff' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0070f3' }}>
                {field.name} (`{field.id}`) - {isSEO ? 'SEO OBJECT BUILDER' : 'RICH TEXT BUILDER'}
            </h4>
            <p style={{ fontSize: '0.9em', color: '#333' }}>
                {isSEO 
                    ? 'Input Pertama: Header Kolom untuk seoTitle. Input Kedua: Header Kolom untuk seoDescription.' 
                    : 'Masukkan template HTML/Teks untuk setiap blok konten.'
                }
            </p>

            {currentTemplates.map((template, index) => (
                <div key={index} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                    <input
                        type="text"
                        value={template}
                        onChange={(e) => updateTemplate(index, e.target.value)}
                        placeholder={getPlaceholder(index)}
                        style={{ flexGrow: 1, padding: '8px', border: '1px solid #0070f3' }}
                    />
                    <button type="button" onClick={() => removeTemplate(index)} style={{ background: 'red', color: 'white', border: 'none', padding: '0 10px' }}>
                        Hapus
                    </button>
                </div>
            ))}
            {(!maxTemplates || currentTemplates.length < maxTemplates) && (
                <button type="button" onClick={addTemplate} style={{ background: '#0070f3', color: 'white', border: 'none', padding: '8px 15px', marginTop: '10px' }}>
                    + Tambah Input {isSEO ? (currentTemplates.length === 0 ? 'Title' : 'Description') : 'Blok Konten'}
                </button>
            )}
        </div>
    );
};

// --- Komponen Utama Halaman Importer ---
export default function ImporterPage() {
    // 1. PANGGIL SEMUA HOOKS DI LEVEL TERATAS KOMPONEN
    const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
    const [sheetName, setSheetName] = useState('Sheet1');
    const [range, setRange] = useState('A1:Z');
    
    // START: BARIS BARU UNTUK PASSWORD
    const [password, setPassword] = useState(''); 
    // END: BARIS BARU UNTUK PASSWORD

    const [contentfulFields, setContentfulFields] = useState<ContentfulField[]>([]);
    const [mapping, setMapping] = useState<FieldMapping>({});
    
    const [statusMessage, setStatusMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- Logika Pengambilan Skema Field ---
    const fetchFields = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(`Mengambil skema untuk Content Type: ${LOCKED_CONTENT_TYPE_ID}...`);
        setContentfulFields([]);
        
        try {
            const response = await fetch(`/api/get-content-type-fields?contentTypeId=${LOCKED_CONTENT_TYPE_ID}`);
            const data = await response.json();
            
            if (response.ok) {
                setContentfulFields(data.fields);
                setStatusMessage(`✅ Skema ${LOCKED_CONTENT_TYPE_ID} berhasil dimuat. Siap untuk mapping.`);
            } else {
                setStatusMessage(`❌ Error: ${data.error || 'Gagal mengambil skema.'}`);
            }
        } catch (error: unknown) {
            let message = 'Terjadi kesalahan yang tidak diketahui.';
            if (error instanceof Error) {
                message = error.message;
            }
            setStatusMessage(`❌ Error koneksi saat mengambil skema. Detail: ${message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Panggil fetchFields saat komponen dimuat
    useEffect(() => {
        if (LOCKED_CONTENT_TYPE_ID) {
            fetchFields();
        }
    }, [fetchFields]);


    // --- Logika Impor Massal ---
    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatusMessage('Memulai impor massal ke Contentful...');

        if (!password) {
             setStatusMessage('❌ Error: Password Impor tidak boleh kosong.');
             setIsLoading(false);
             return;
        }

        if (!spreadsheetUrl || Object.keys(mapping).length === 0) {
            setStatusMessage('❌ Error: Harap isi URL Spreadsheet dan buat minimal satu mapping.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/import-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    spreadsheetUrl,
                    sheetName,
                    range,
                    contentTypeId: LOCKED_CONTENT_TYPE_ID,
                    mapping,
                    password, // BARU: Kirim password ke API
                }),
            });

            const result = await response.json();
            
            if (response.ok) {
                setStatusMessage(`✅ SUKSES! ${result.importedCount} entri berhasil diimpor/diperbarui.`);
            } else {
                // Tampilkan pesan error 401/405/500
                setStatusMessage(`❌ GAGAL: ${result.error || 'Terjadi kesalahan pada server.'}`);
            }

        } catch (error: unknown) {
            let message = 'Terjadi kesalahan yang tidak diketahui.';
            if (error instanceof Error) {
                message = error.message;
            }
            setStatusMessage(`❌ Error koneksi: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. LAKUKAN PEMERIKSAAN KONDISIONAL DAN RETURN DI BODY RENDER
    if (!LOCKED_CONTENT_TYPE_ID) {
        return <div style={{padding: '20px', color: 'red'}}>
            Error Konfigurasi: Variabel lingkungan **NEXT_PUBLIC_LOCKED_CONTENT_TYPE_ID** belum diatur.
        </div>;
    }


    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            <Head>
                <title>Contentful Bulk Importer</title>
            </Head>

            <h1>Contentful Bulk Importer Tool</h1>
            <p>Target Content Type: <strong>{LOCKED_CONTENT_TYPE_ID}</strong></p>

            <form onSubmit={handleImportSubmit}>
                {/* --- Bagian Input Awal --- */}
                <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '5px', marginBottom: '30px' }}>
                    <h2>1. Konfigurasi Akses & Data Sumber</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {/* START: FIELD PASSWORD BARU */}
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="PASSWORD IMPOR (Set di IMPORTER_PASSWORD ENV)" 
                            required
                            style={{ padding: '10px', fontWeight: 'bold', border: '2px solid #ff4500' }} disabled={isLoading} />
                        {/* END: FIELD PASSWORD BARU */}

                        <input type="text" value={spreadsheetUrl} onChange={(e) => setSpreadsheetUrl(e.target.value)}
                            placeholder="URL Google Spreadsheet (Share dengan Service Account!)" style={{ padding: '10px' }} disabled={isLoading} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)}
                                placeholder="Nama Sheet (e.g., Sheet1)" style={{ padding: '10px', flex: 1 }} disabled={isLoading} />
                            <input type="text" value={range} onChange={(e) => setRange(e.target.value)}
                                placeholder="Range Data (e.g., A1:Z)" style={{ padding: '10px', flex: 1 }} disabled={isLoading} />
                        </div>
                        <div style={{ padding: '10px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.9em' }}>
                            Content Type Target **terkunci** pada: <strong>{LOCKED_CONTENT_TYPE_ID}</strong>
                        </div>
                    </div>
                </div>

                {/* --- Bagian Mapping Dinamis --- */}
                {contentfulFields.length > 0 && (
                    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '5px', marginBottom: '30px' }}>
                        <h2>2. Mapping Kolom</h2>
                        <p>Hubungkan Field Contentful dengan header kolom Sheets (gunakan format <code>{`{Header Name}`}</code>). Gunakan **Mapping Kompleks** untuk Rich Text dan SEO.</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                            {contentfulFields.map(field => {
                                // Field Rich Text DAN SEO menggunakan builder Complex
                                if (field.isRichText || field.id === 'seo') {
                                    return <ComplexMappingInput key={field.id} field={field} mapping={mapping} setMapping={setMapping} />;
                                }
                                // Field Symbol, Link, dan Array Manual (productTag) menggunakan Simple Input
                                if (field.isText || field.isLink || field.id === 'productTag') { 
                                    return <SimpleMappingInput key={field.id} field={field} mapping={mapping} setMapping={setMapping} />;
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}
                
                <button type="submit" disabled={isLoading || contentfulFields.length === 0} style={{ padding: '15px 30px', fontSize: '1.2em', background: '#00cc66', color: 'white', border: 'none', width: '100%' }}>
                    {isLoading ? 'Processing...' : '3. MULAI BULK IMPORT SEKARANG'}
                </button>
            </form>

            {/* --- Bagian Status --- */}
            {statusMessage && (
                <div style={{ marginTop: '20px', padding: '15px', background: statusMessage.startsWith('✅') ? '#d4edda' : statusMessage.startsWith('❌') ? '#f8d7da' : '#fff3cd', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }}>
                    {statusMessage}
                </div>
            )}
        </div>
    );
}