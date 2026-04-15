import fs from 'fs';
import path from 'path';

interface Set {
  code: string;
  name: string;
  set_type: string;
  card_count: number;
  aliases?: string[];
}

// Load sets from JSON file
let sets: Set[] = [];
const nameToCode: Record<string, string> = {};
const codeToName: Record<string, string> = {};
const aliasesToCode: Record<string, string> = {};

function loadSets() {
  try {
    const dataPath = path.join(__dirname, '..', '..', 'data', 'paper_sets.json');
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      sets = JSON.parse(data);
      
      // Build lookup maps
      sets.forEach(s => {
        nameToCode[s.name.toLowerCase()] = s.code;
        codeToName[s.code] = s.name;
        
        // Add aliases
        if (s.aliases) {
          s.aliases.forEach(alias => {
            aliasesToCode[alias.toLowerCase()] = s.code;
          });
        }
      });
      
      console.log(`[SetService] Loaded ${sets.length} paper sets`);
    } else {
      console.warn('[SetService] paper_sets.json not found, run node scripts/fetchSets.js');
    }
  } catch (err) {
    console.error('[SetService] Error loading sets:', err);
  }
}

// Initialize on module load
loadSets();

// Normalize set name or code to { code, name }
export function normalizeSet(input: string): { code: string; name: string } | null {
  if (!input) return null;
  
  const val = input.toLowerCase().trim();
  
  // Direct code match
  if (codeToName[val]) {
    return { code: val, name: codeToName[val] };
  }
  
  // Direct name match
  if (nameToCode[val]) {
    return { code: nameToCode[val], name: input };
  }
  
  // Alias match
  if (aliasesToCode[val]) {
    const code = aliasesToCode[val];
    return { code, name: codeToName[code] };
  }
  
  return null;
}

// Search sets by name (partial match)
export function searchSets(query: string): Set[] {
  if (!query) return sets.slice(0, 50); // Return first 50 if no query
  
  const q = query.toLowerCase();
  return sets.filter(s => 
    s.name.toLowerCase().includes(q) || 
    s.code.toLowerCase().includes(q) ||
    s.aliases?.some(a => a.toLowerCase().includes(q))
  ).slice(0, 50);
}

// Get all sets
export function getAllSets(): Set[] {
  return sets;
}

// Get set by code
export function getSetByCode(code: string): Set | null {
  const normalizedCode = code.toLowerCase();
  return sets.find(s => s.code === normalizedCode) || null;
}

// Get set by name
export function getSetByName(name: string): Set | null {
  const normalizedName = name.toLowerCase();
  return sets.find(s => s.name.toLowerCase() === normalizedName) || null;
}

// Reload sets (useful after running fetchSets.js)
export function reloadSets() {
  loadSets();
}
