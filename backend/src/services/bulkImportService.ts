import { pool } from '../config/db';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import { normalizeSet } from './setService';

export interface BulkImportItem {
  quantity: number;
  name: string;
  set_name: string;
  set_code?: string;
  card_number: string;
  language: string;
  condition: string;
  foil: string;
  cost: number;
  price_tix: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  items: (BulkImportItem & { id: string; needsCorrection: boolean; errors?: string[]; set_code?: string })[];
  total: number;
  needsCorrection: number;
  ready: number;
}

const SCRYFALL_API = 'https://api.scryfall.com/cards';

// Validate card against Scryfall API
async function validateCardWithScryfall(name: string, setCode: string, collectorNumber: string): Promise<{ valid: boolean; scryfallData?: any }> {
  try {
    // Search by name + set + collector number for exact match
    const url = `${SCRYFALL_API}/search?q=!${encodeURIComponent(name)}+set:${encodeURIComponent(setCode)}+cn:${encodeURIComponent(collectorNumber)}`;
    const response = await axios.get(url);
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      return { valid: true, scryfallData: response.data.data[0] };
    }
    
    // Fallback: search by name + set
    const fallbackUrl = `${SCRYFALL_API}/search?q=!${encodeURIComponent(name)}+set:${encodeURIComponent(setCode)}`;
    const fallbackResponse = await axios.get(fallbackUrl);
    
    if (fallbackResponse.data && fallbackResponse.data.data && fallbackResponse.data.data.length > 0) {
      return { valid: true, scryfallData: fallbackResponse.data.data[0] };
    }
    
    return { valid: false };
  } catch (err) {
    console.error('Scryfall validation error:', err);
    return { valid: false }; // Don't fail import if Scryfall is down
  }
}

// Parse uploaded file (Excel or CSV)
export function parseImportFile(buffer: Buffer, filename: string): BulkImportItem[] {
  const items: BulkImportItem[] = [];
  
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    // Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 7) continue;
      
      items.push({
        quantity: parseInt(row[0]) || 1,
        name: row[1] || '',
        set_name: row[2] || '',
        card_number: row[3] || '',
        language: row[4] || 'English',
        condition: row[5] || 'NM',
        foil: row[6] || 'No',
        cost: parseFloat(row[7]) || 0,
        price_tix: parseFloat(row[8]) || 0,
      });
    }
  } else if (filename.endsWith('.csv')) {
    // CSV file
    const csvText = buffer.toString('utf-8');
    console.log('[Bulk Import] CSV content preview:', csvText.substring(0, 500));
    
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];
    
    console.log('[Bulk Import] Parsed records:', records.length);
    
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      console.log(`[Bulk Import] Row ${i}:`, JSON.stringify(row));
      
      // Skip header row if name column contains "Card Name" (case-insensitive)
      const nameValue = row.name || row['Card Name'] || row['card name'];
      if (nameValue && nameValue.toLowerCase().includes('card name')) {
        console.log('[Bulk Import] Skipping header row');
        continue;
      }
      
      const extractedItem = {
        quantity: parseInt(row.quantity || row.Quantity) || 1,
        name: row.name || row['card name'] || row['Card Name'] || '',
        set_name: row.set_name || row['set name'] || row['Set Name'] || row.set || row.Set || '',
        card_number: row.card_number || row['card number'] || row['Card Number'] || row.collector_number || row.cn || '',
        language: row.language || row.Language || 'English',
        condition: row.condition || row.Condition || 'NM',
        foil: row.foil || row.Foil || 'No',
        cost: parseFloat(row.cost || row.Cost) || 0,
        price_tix: parseFloat(row.price_tix || row['tix price'] || row['Tix Price'] || row.tix) || 0,
      };
      console.log(`[Bulk Import] Extracted item ${i}:`, JSON.stringify(extractedItem));
      items.push(extractedItem);
    }
  }
  
  return items;
}

// Validate items without importing (for verification UI)
export async function validateItems(items: BulkImportItem[], validateWithScryfall: boolean = true): Promise<ValidationResult> {
  const validatedItems = items.map((item, index) => ({
    ...item,
    id: `item-${index}`,
    needsCorrection: false,
    errors: [] as string[],
  }));

  let needsCorrectionCount = 0;

  for (const item of validatedItems) {
    const errors: string[] = [];

    // Validate required fields
    if (!item.name) {
      errors.push('Missing card name');
      item.needsCorrection = true;
    }
    if (!item.set_name) {
      errors.push('Missing set name');
      item.needsCorrection = true;
    }
    if (!item.card_number) {
      errors.push('Missing card number');
      item.needsCorrection = true;
    }

    // Validate set name using set service
    const normalizedSet = normalizeSet(item.set_name);
    if (normalizedSet) {
      item.set_code = normalizedSet.code;
    } else {
      errors.push('Set name not recognized');
      item.needsCorrection = true;
    }

    // Validate with Scryfall if enabled
    if (validateWithScryfall && normalizedSet) {
      const setCode = normalizedSet.code;
      const validation = await validateCardWithScryfall(item.name, setCode, item.card_number);
      
      if (!validation.valid) {
        errors.push('Could not validate with Scryfall');
        item.needsCorrection = true;
      }
    }

    item.errors = errors;
    if (item.needsCorrection) {
      needsCorrectionCount++;
    }
  }

  return {
    items: validatedItems,
    total: validatedItems.length,
    needsCorrection: needsCorrectionCount,
    ready: validatedItems.length - needsCorrectionCount,
  };
}

// Bulk import items into database
export async function bulkImportItems(items: BulkImportItem[], validateWithScryfall: boolean = true, conventionId?: number): Promise<ImportResult> {
  console.log('[Bulk Import] Received items for import:', JSON.stringify(items));
  console.log('[Bulk Import] conventionId parameter:', conventionId);
  
  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: [],
    warnings: [],
  };
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const item of items) {
      // Validate required fields
      if (!item.name) {
        result.errors.push(`Row ${result.imported + 1}: Missing card name`);
        continue;
      }
      if (!item.set_name) {
        result.errors.push(`Row ${result.imported + 1} (${item.name}): Missing set name`);
        continue;
      }
      if (!item.card_number) {
        result.errors.push(`Row ${result.imported + 1} (${item.name}): Missing card number`);
        continue;
      }
      
      // Normalize foil value
      const isFoil = ['yes', 'y', 'true', '1', 'foil'].includes(item.foil.toLowerCase());

      // Normalize set name to code using set service
      const normalizedSet = normalizeSet(item.set_name);
      let setCode = item.set_name.toLowerCase().replace(/[^a-z0-9]/g, ''); // fallback
      
      if (normalizedSet) {
        setCode = normalizedSet.code;
        console.log(`[Bulk Import] Normalized set "${item.set_name}" to code "${setCode}"`);
      } else {
        console.log(`[Bulk Import] Could not normalize set "${item.set_name}"`);
      }
      
      // Validate with Scryfall if enabled
      if (validateWithScryfall) {
        const validation = await validateCardWithScryfall(item.name, setCode, item.card_number);
        
        if (!validation.valid) {
          result.warnings.push(`Row ${result.imported + 1} (${item.name}): Could not validate with Scryfall, importing anyway`);
        }
      }
      
      // Check if item already exists (same name + set + card number + condition + foil + convention)
      const existingCheck = await client.query(
        `SELECT id FROM store_items 
         WHERE name = $1 AND set_name = $2 AND card_number = $3 AND condition = $4 AND foil = $5 
         ${conventionId ? 'AND convention_id = $6' : ''}`,
        conventionId 
          ? [item.name, item.set_name, item.card_number, item.condition, isFoil, conventionId]
          : [item.name, item.set_name, item.card_number, item.condition, isFoil]
      );
      
      if (existingCheck.rows.length > 0) {
        // Update existing item
        const existingId = existingCheck.rows[0].id;
        await client.query(
          `UPDATE store_items 
           SET stock = stock + $1, cost = $2, price_tix = $3, updated_at = NOW()
           WHERE id = $4`,
          [item.quantity, item.cost, item.price_tix, existingId]
        );
        result.warnings.push(`Row ${result.imported + 1} (${item.name}): Updated existing item (added ${item.quantity} to stock)`);
      } else {
        // Insert new item
        await client.query(
          `INSERT INTO store_items 
           (name, description, set_name, card_number, language, condition, foil, cost, price_tix, stock, active, convention_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, ${conventionId ? '$11' : 'NULL'})`,
          conventionId
            ? [
                item.name,
                `${item.set_name} - ${item.card_number}`,
                item.set_name,
                item.card_number,
                item.language,
                item.condition,
                isFoil,
                item.cost,
                item.price_tix,
                item.quantity,
                conventionId,
              ]
            : [
                item.name,
                `${item.set_name} - ${item.card_number}`,
                item.set_name,
                item.card_number,
                item.language,
                item.condition,
                isFoil,
                item.cost,
                item.price_tix,
                item.quantity,
              ]
        );
      }
      
      result.imported++;
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    result.success = false;
    result.errors.push(`Database error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    client.release();
  }
  
  return result;
}
