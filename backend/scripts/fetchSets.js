const fs = require('fs');
const path = require('path');
const https = require('https');

const EXCLUDE_TYPES = new Set([
  'token',
  'memorabilia',
  'minigame',
  'planar',
  'archenemy',
  'vanguard',
  'box',
  'funny',
]);

// Set name aliases for common variations
const ALIASES = {
  'mh2': 'mh2',
  'modern horizons 2': 'mh2',
  'modern horizons': 'mh1',
  'mh3': 'mh3',
  'modern horizons 3': 'mh3',
  'dmu': 'dmu',
  'dominaria united': 'dmu',
  '2x2': '2x2',
  'double masters 2022': '2x2',
  'dmr': '2x2',
  'double masters': '2xm',
  'neo': 'neo',
  'kamigawa: neon dynasty': 'neo',
  'one': 'one',
  'phyrexia: all will be one': 'one',
  'mom': 'mom',
  'march of the machine': 'mom',
  'woe': 'woe',
  'wilds of eldraine': 'woe',
  'lci': 'lci',
  'lost caverns of ixalan': 'lci',
  'otj': 'otj',
  'outlaws of thunder junction': 'otj',
  'blc': 'blc',
  'bloomburrow': 'blc',
};

async function fetchPaperSets() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.scryfall.com',
      path: '/sets',
      method: 'GET',
      headers: {
        'User-Agent': 'ConventionManager/1.0',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (!json.data || !Array.isArray(json.data)) {
            console.error('Unexpected API response:', json);
            reject(new Error('Invalid API response'));
            return;
          }
          
          const sets = json.data
            .filter(s => !s.digital) // paper only
            .filter(s => !EXCLUDE_TYPES.has(s.set_type)) // remove junk
            .map(s => ({
              code: s.code.toLowerCase(),
              name: s.name,
              set_type: s.set_type,
              card_count: s.card_count || 0,
            }))
            .sort((a, b) => b.card_count - a.card_count); // Sort by card count instead of date

          // Add aliases to the set data
          const setsWithAliases = sets.map(set => {
            const aliasesForSet = Object.entries(ALIASES)
              .filter(([alias, code]) => code === set.code)
              .map(([alias]) => alias);
            return { ...set, aliases: aliasesForSet };
          });

          const dataDir = path.join(__dirname, '..', 'data');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }

          const outputPath = path.join(dataDir, 'paper_sets.json');
          fs.writeFileSync(outputPath, JSON.stringify(setsWithAliases, null, 2));

          console.log(`✅ Saved ${setsWithAliases.length} paper sets to ${outputPath}`);
          console.log(`   Latest set: ${setsWithAliases[0]?.name || 'N/A'}`);
          resolve(setsWithAliases);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

fetchPaperSets().catch(console.error);
