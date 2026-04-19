import type { CardEntry, CardCondition, CardFinish, CardLanguage, ExcelRow } from '../types';

// ─── Column name aliases (flexible header matching) ───────────────────────────

const COL_ALIASES: Record<keyof ExcelRow, string[]> = {
  name:            ['name', 'card name', 'card', 'title'],
  setCode:         ['set code', 'set', 'edition code', 'setcode', 'set_code'],
  setName:         ['set name', 'edition', 'set_name'],
  collectorNumber: ['collector number', 'collector #', 'number', 'no', 'collector_number', '#'],
  foil:            ['foil', 'is foil', 'foil?'],
  finish:          ['finish', 'printing', 'treatment'],
  condition:       ['condition', 'cond', 'grade'],
  language:        ['language', 'lang'],
  quantity:        ['quantity', 'qty', 'count', 'amount'],
  price:           ['price', 'tcg price', 'market price', 'value'],
};

function findColumn(headers: string[], field: keyof ExcelRow): number {
  const aliases = COL_ALIASES[field];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (aliases.some((a) => h === a || h.includes(a))) return i;
  }
  return -1;
}

function normalizeCondition(raw: string): CardCondition {
  const v = raw.toUpperCase().trim();
  const map: Record<string, CardCondition> = {
    'M': 'M', 'MINT': 'M',
    'NM': 'NM', 'NEAR MINT': 'NM', 'NEAR-MINT': 'NM',
    'LP': 'LP', 'LIGHTLY PLAYED': 'LP', 'LIGHT PLAY': 'LP', 'EX': 'LP', 'EXCELLENT': 'LP',
    'MP': 'MP', 'MODERATELY PLAYED': 'MP', 'MOD PLAY': 'MP', 'VG': 'MP', 'GOOD': 'MP',
    'HP': 'HP', 'HEAVILY PLAYED': 'HP', 'HEAVY PLAY': 'HP', 'PL': 'HP', 'PLAYED': 'HP',
    'D': 'D', 'DMG': 'D', 'DAMAGED': 'D', 'POOR': 'D',
  };
  return map[v] ?? 'NM';
}

function normalizeFinish(raw: string | boolean | undefined, foilCol: string | boolean | undefined): CardFinish {
  if (typeof raw === 'string') {
    const v = raw.toLowerCase().trim();
    if (v === 'etched') return 'etched';
    if (v === 'foil' || v === 'yes' || v === 'true') return 'foil';
  }
  if (typeof foilCol === 'boolean') return foilCol ? 'foil' : 'nonfoil';
  if (typeof foilCol === 'string') {
    const v = foilCol.toLowerCase().trim();
    if (v === 'yes' || v === 'true' || v === '1' || v === 'foil') return 'foil';
  }
  return 'nonfoil';
}

function normalizeLanguage(raw: string | undefined): CardLanguage {
  if (!raw) return 'en';
  const v = raw.toLowerCase().trim();
  const map: Record<string, CardLanguage> = {
    'en': 'en', 'english': 'en',
    'es': 'es', 'spanish': 'es', 'sp': 'es',
    'fr': 'fr', 'french': 'fr',
    'de': 'de', 'german': 'de',
    'it': 'it', 'italian': 'it',
    'pt': 'pt', 'portuguese': 'pt',
    'ja': 'ja', 'jp': 'ja', 'japanese': 'ja',
    'ko': 'ko', 'korean': 'ko',
    'ru': 'ru', 'russian': 'ru',
    'zhs': 'zhs', 'chinese simplified': 'zhs', 'cs': 'zhs',
    'zht': 'zht', 'chinese traditional': 'zht', 'ct': 'zht',
    'ph': 'ph', 'phyrexian': 'ph',
  };
  return map[v] ?? 'en';
}

// ─── Main parse function ──────────────────────────────────────────────────────

export async function parseExcelFile(file: File): Promise<{
  entries: Omit<CardEntry, 'scryfallId' | 'tcgPrice' | 'imageUrl'>[];
  warnings: string[];
}> {
  // Dynamic import of xlsx so it's only loaded when needed
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (raw.length < 2) throw new Error('Excel file appears empty or has only headers.');

  const headers = raw[0].map((h) => String(h ?? ''));
  const colIdx: Record<keyof ExcelRow, number> = {} as any;
  for (const field of Object.keys(COL_ALIASES) as (keyof ExcelRow)[]) {
    colIdx[field] = findColumn(headers, field);
  }

  if (colIdx.name === -1) {
    throw new Error(
      'Could not find a "Name" column. Please ensure your Excel file has a card name column.'
    );
  }

  const warnings: string[] = [];
  const entries: Omit<CardEntry, 'scryfallId' | 'tcgPrice' | 'imageUrl'>[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const name = String(row[colIdx.name] ?? '').trim();
    if (!name) continue;

    const qty = colIdx.quantity !== -1 ? parseInt(String(row[colIdx.quantity] ?? '1')) : 1;

    entries.push({
      id: crypto.randomUUID(),
      name,
      setCode: colIdx.setCode !== -1 ? String(row[colIdx.setCode] ?? '').toLowerCase().trim() : '',
      setName: colIdx.setName !== -1 ? String(row[colIdx.setName] ?? '').trim() : '',
      collectorNumber: colIdx.collectorNumber !== -1 ? String(row[colIdx.collectorNumber] ?? '').trim() : '',
      finish: normalizeFinish(
        colIdx.finish !== -1 ? row[colIdx.finish] as string : undefined,
        colIdx.foil !== -1 ? row[colIdx.foil] as string : undefined
      ),
      condition: normalizeCondition(
        colIdx.condition !== -1 ? String(row[colIdx.condition] ?? 'NM') : 'NM'
      ),
      language: normalizeLanguage(
        colIdx.language !== -1 ? String(row[colIdx.language] ?? 'en') : 'en'
      ),
      quantity: isNaN(qty) ? 1 : Math.max(1, qty),
      needsConfirmation: false,
      source: 'excel',
    });
  }

  return { entries, warnings };
}
