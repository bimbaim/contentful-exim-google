// src/utils/richTextConverter.ts

import { SheetRecord } from './types';

// --- Interface Rich Text yang Didefinisikan Ulang ---

interface Mark {
    type: string;
}

// 1. Tipe Dasar untuk Node Teks Contentful
interface TextNode {
    nodeType: 'text';
    value: string;
    marks: Mark[];
    data: Record<string, unknown>;
}

// 2. Tipe Dasar untuk Node Blok (Paragraph, Heading, List, Document)
// Node Block HARUS memiliki 'content'
interface ContentNode {
    nodeType: string;
    data: Record<string, unknown>;
    content: (ContentNode | TextNode)[]; // Array ini bisa berisi ContentNode (untuk blok bersarang) atau TextNode
}

// --- FUNGSI HELPER (tetap sama) ---

function substituteValue(template: string, record: SheetRecord): string {
    const matches = template.match(/{([^}]+)}/g);
    let result = template;

    if (matches) {
        matches.forEach(match => {
            const header = match.replace(/{|}/g, '').trim();
            const value = record[header] || '';
            
            result = result.replace(match, value);
        });
    }
    return result;
}

/**
 * Mengonversi string HTML/Teks menjadi Node Rich Text Contentful yang valid.
 */
function createRichTextNode(htmlString: string): ContentNode | null {
    const content = substituteValue(htmlString, {});
    const trimmedContent = content.trim();

    if (!trimmedContent) return null;

    // --- 1. HANDLE HEADING ---
    const headingMatch = trimmedContent.match(/<h(\d)>(.*?)<\/h\d>/i); 
    if (headingMatch) {
        const level = headingMatch[1];
        const textValue = headingMatch[2].trim();
        
        // Perbaikan Error 2352/2741: Casting ke ContentNode yang benar
        const textNode: TextNode = {
            nodeType: 'text',
            value: textValue,
            marks: [],
            data: {},
        };

        return {
            nodeType: `heading-${level}`,
            data: {},
            content: [textNode], // Node level tinggi harus memiliki array content
        } as ContentNode;
    }

    // --- 2. HANDLE LIST (UL dan OL) ---
    const listMatch = trimmedContent.match(/<(ul|ol)>([\s\S]*?)<\/(ul|ol)>/i); 
    if (listMatch) {
        const listType = listMatch[1].toLowerCase();
        const listItemsHtml = listMatch[2];
        const listItemRegex = /<li>([\s\S]*?)<\/li>/ig; 

        const listContent: ContentNode[] = [];
        let itemMatch: RegExpExecArray | null;

        while ((itemMatch = listItemRegex.exec(listItemsHtml)) !== null) {
            const itemText = itemMatch[1].trim();

            if (itemText) {
                const paragraphNode: ContentNode = {
                    nodeType: 'paragraph',
                    data: {},
                    content: [
                        { nodeType: 'text', value: itemText, marks: [], data: {} } as TextNode
                    ],
                };
                
                listContent.push({
                    nodeType: 'list-item',
                    data: {},
                    content: [paragraphNode],
                } as ContentNode);
            }
        }

        if (listContent.length > 0) {
            return {
                nodeType: listType === 'ul' ? 'unordered-list' : 'ordered-list',
                data: {},
                content: listContent,
            } as ContentNode;
        }
    }


    // --- 3. HANDLE PARAGRAPH (Default atau <p>) ---
    let textValue = trimmedContent;

    const paragraphMatch = trimmedContent.match(/<p>([\s\S]*?)<\/p>/i);
    if (paragraphMatch) {
        textValue = paragraphMatch[1].trim();
    }
    
    if (!textValue) return null;

    // Perbaikan Error 2352/2741: Casting ke ContentNode yang benar
    const textNode: TextNode = {
        nodeType: 'text',
        value: textValue,
        marks: [],
        data: {},
    };

    return {
        nodeType: 'paragraph',
        data: {},
        content: [textNode],
    } as ContentNode;
}


/**
 * Fungsi utama untuk memproses semua template Rich Text.
 * @param templates Array of string templates dari frontend form.
 * @param record Baris data dari Google Sheets.
 * @returns Struktur JSON Rich Text Document Contentful yang valid.
 */
export function processRichTextMapping(templates: string[], record: SheetRecord): ContentNode {
    // Array ini sekarang bisa berisi ContentNode atau TextNode, sesuai definisi ContentNode
    const contentNodes: (ContentNode | TextNode)[] = []; 

    templates.forEach(template => {
        const substitutedTemplate = substituteValue(template, record);
        const node = createRichTextNode(substitutedTemplate);

        if (node) {
            contentNodes.push(node);
        }
    });

    // Node akar (Root Node) dokumen Rich Text
    return {
        nodeType: 'document',
        data: {},
        content: contentNodes, 
    };
}