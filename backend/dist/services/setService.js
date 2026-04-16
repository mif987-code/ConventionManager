"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSet = normalizeSet;
exports.searchSets = searchSets;
exports.getAllSets = getAllSets;
exports.getSetByCode = getSetByCode;
exports.getSetByName = getSetByName;
exports.reloadSets = reloadSets;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load sets from JSON file
let sets = [];
const nameToCode = {};
const codeToName = {};
const aliasesToCode = {};
function loadSets() {
    try {
        const dataPath = path_1.default.join(__dirname, '..', '..', 'data', 'paper_sets.json');
        if (fs_1.default.existsSync(dataPath)) {
            const data = fs_1.default.readFileSync(dataPath, 'utf8');
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
        }
        else {
            console.warn('[SetService] paper_sets.json not found, run node scripts/fetchSets.js');
        }
    }
    catch (err) {
        console.error('[SetService] Error loading sets:', err);
    }
}
// Initialize on module load
loadSets();
// Normalize set name or code to { code, name }
function normalizeSet(input) {
    if (!input)
        return null;
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
function searchSets(query) {
    if (!query)
        return sets.slice(0, 50); // Return first 50 if no query
    const q = query.toLowerCase();
    return sets.filter(s => s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.aliases?.some(a => a.toLowerCase().includes(q))).slice(0, 50);
}
// Get all sets
function getAllSets() {
    return sets;
}
// Get set by code
function getSetByCode(code) {
    const normalizedCode = code.toLowerCase();
    return sets.find(s => s.code === normalizedCode) || null;
}
// Get set by name
function getSetByName(name) {
    const normalizedName = name.toLowerCase();
    return sets.find(s => s.name.toLowerCase() === normalizedName) || null;
}
// Reload sets (useful after running fetchSets.js)
function reloadSets() {
    loadSets();
}
//# sourceMappingURL=setService.js.map