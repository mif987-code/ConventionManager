import { useState, useEffect } from 'react';
import { Check, X, ChevronDown, Upload } from 'lucide-react';

interface ImportItem {
  id: string;
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
  needsCorrection: boolean;
  errors?: string[];
}

interface ScryfallSet {
  code: string;
  name: string;
  set_type: string;
  card_count: number;
  aliases?: string[];
}

interface CardInSet {
  name: string;
  collector_number: string;
  foil: boolean;
}

interface BulkImportVerificationProps {
  items: ImportItem[];
  onUpload: (items: ImportItem[]) => Promise<void>;
  onCancel: () => void;
}

export default function BulkImportVerification({ items, onUpload, onCancel }: BulkImportVerificationProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set<string>());
  const [sets, setSets] = useState<ScryfallSet[]>([]);
  const [cardSets, setCardSets] = useState<Record<string, ScryfallSet[]>>({});
  const [setDropdownOpen, setSetDropdownOpen] = useState<string | null>(null);
  const [setSearchQuery, setSetSearchQuery] = useState<Record<string, string>>({});
  const [cardsInSet, setCardsInSet] = useState<Record<string, CardInSet[]>>({});
  const [cnDropdownOpen, setCnDropdownOpen] = useState<string | null>(null);
  const [cnSearchQuery, setCnSearchQuery] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Separate items into needs correction and ready
  const needsCorrection = items.filter(item => item.needsCorrection);
  const readyToImport = items.filter(item => !item.needsCorrection);

  useEffect(() => {
    loadSets();
  }, []);

  async function loadSets() {
    try {
      const res = await fetch('/api/sets');
      const data = await res.json();
      setSets(data.sets || []);
    } catch (err) {
      console.error('Failed to load sets:', err);
    }
  }

  async function loadCardSets(cardName: string, itemId: string) {
    if (cardSets[itemId]) return; // Already loaded
    
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(cardName)}/sets`);
      const data = await res.json();
      setCardSets(prev => ({ ...prev, [itemId]: data.sets || [] }));
    } catch (err) {
      console.error('Failed to load card sets:', err);
    }
  }

  async function loadCardsInSet(setCode: string, itemId: string) {
    if (cardsInSet[itemId]) return; // Already loaded

    try {
      const res = await fetch(`/api/cards/set/${setCode}`);
      const data = await res.json();
      setCardsInSet(prev => ({ ...prev, [itemId]: data.cards || [] }));
    } catch (err) {
      console.error('Failed to load cards in set:', err);
    }
  }

  function handleSetSelect(itemId: string, setCode: string, setName: string) {
    // Update the item's set
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex !== -1) {
      items[itemIndex].set_name = setName;
      items[itemIndex].set_code = setCode;
      // Clear errors related to set
      items[itemIndex].errors = items[itemIndex].errors?.filter(e => !e.toLowerCase().includes('set'));
      if (items[itemIndex].errors?.length === 0) {
        items[itemIndex].needsCorrection = false;
      }
    }
    setSetDropdownOpen(null);
    setSetSearchQuery(prev => ({ ...prev, [itemId]: '' })); // Clear search query
    // Load cards in this set for CN autocomplete
    loadCardsInSet(setCode, itemId);
  }

  function handleCnSelect(itemId: string, cn: string) {
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex !== -1) {
      items[itemIndex].card_number = cn;
      // Clear errors related to CN
      items[itemIndex].errors = items[itemIndex].errors?.filter(e => !e.toLowerCase().includes('card number'));
      if (items[itemIndex].errors?.length === 0) {
        items[itemIndex].needsCorrection = false;
      }
    }
    setCnDropdownOpen(null);
    setCnSearchQuery(prev => ({ ...prev, [itemId]: '' })); // Clear search query
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItems((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }

  function toggleSelectAll(readyOnly: boolean = false) {
    const targetItems = readyOnly ? readyToImport : items;
    const targetIds = targetItems.map(i => i.id);
    
    if (targetIds.every(id => selectedItems.has(id))) {
      // Deselect all
      setSelectedItems((prev: Set<string>) => {
        const newSet = new Set(prev);
        targetIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all
      setSelectedItems((prev: Set<string>) => {
        const newSet = new Set(prev);
        targetIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  }

  async function handleUpload() {
    const itemsToUpload = items.filter(i => selectedItems.has(i.id));
    if (itemsToUpload.length === 0) {
      alert('Please select at least one item to upload');
      return;
    }

    setUploading(true);
    try {
      await onUpload(itemsToUpload);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Bulk Import Verification</h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      {/* Needs Correction Table */}
      {needsCorrection.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-red-50">
            <h3 className="font-semibold text-red-800 flex items-center gap-2">
              <X size={20} />
              Rows Need Correction ({needsCorrection.length} items)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={needsCorrection.every(i => selectedItems.has(i.id))}
                      onChange={() => toggleSelectAll(false)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Card Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Set Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Set Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">CN</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Foil</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Errors</th>
                </tr>
              </thead>
              <tbody>
                {needsCorrection.map((item) => (
                  <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">{item.name}</td>
                    <td className="px-4 py-3 text-sm relative">
                      <div className="relative">
                        <button
                          onClick={() => {
                            const isOpening = setDropdownOpen !== item.id;
                            setSetDropdownOpen(setDropdownOpen === item.id ? null : item.id);
                            if (isOpening && item.name) {
                              loadCardSets(item.name, item.id);
                            }
                          }}
                          className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50"
                        >
                          {item.set_name}
                          <ChevronDown size={16} />
                        </button>
                        {setDropdownOpen === item.id && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <input
                              type="text"
                              placeholder="Search sets..."
                              value={setSearchQuery[item.id] || ''}
                              onChange={(e) => setSetSearchQuery(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-full px-3 py-2 border-b border-gray-200 sticky top-0 bg-white"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            {(cardSets[item.id] || sets).filter((set: ScryfallSet) => 
                              !setSearchQuery[item.id] || 
                              set.name.toLowerCase().includes(setSearchQuery[item.id].toLowerCase()) || 
                              set.code.toLowerCase().includes(setSearchQuery[item.id].toLowerCase())
                            ).map((set: ScryfallSet) => (
                              <button
                                key={set.code}
                                onClick={() => handleSetSelect(item.id, set.code, set.name)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex justify-between"
                              >
                                <span>{set.name}</span>
                                <span className="text-gray-500 text-xs">{set.code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.set_code || '—'}</td>
                    <td className="px-4 py-3 text-sm relative">
                      <div className="relative">
                        <button
                          onClick={() => setCnDropdownOpen(cnDropdownOpen === item.id ? null : item.id)}
                          className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50"
                          disabled={!item.set_code}
                        >
                          {item.card_number}
                          <ChevronDown size={16} />
                        </button>
                        {cnDropdownOpen === item.id && item.set_code && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <input
                              type="text"
                              placeholder="Search CN..."
                              value={cnSearchQuery[item.id] || ''}
                              onChange={(e) => setCnSearchQuery(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-full px-3 py-2 border-b border-gray-200 sticky top-0 bg-white"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            {(cardsInSet[item.id] || [])
                              .filter(card => 
                                !cnSearchQuery[item.id] || 
                                card.name.toLowerCase().includes(cnSearchQuery[item.id].toLowerCase()) ||
                                card.collector_number.toLowerCase().includes(cnSearchQuery[item.id].toLowerCase())
                              )
                              .map((card) => (
                              <button
                                key={card.collector_number}
                                onClick={() => handleCnSelect(item.id, card.collector_number)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex justify-between"
                              >
                                <span>{card.name}</span>
                                <span className="text-gray-500 text-xs">{card.collector_number}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.foil}</td>
                    <td className="px-4 py-3 text-sm">${item.cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{item.errors?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ready to Import Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-green-50">
          <h3 className="font-semibold text-green-800 flex items-center gap-2">
            <Check size={20} />
            Ready to Import ({readyToImport.length} items)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={readyToImport.every(i => selectedItems.has(i.id))}
                    onChange={() => toggleSelectAll(true)}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Card Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Set Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Set Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">CN</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Foil</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cost</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tix Price</th>
              </tr>
            </thead>
            <tbody>
              {readyToImport.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No items ready to import
                  </td>
                </tr>
              ) : (
                readyToImport.map((item) => (
                  <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">{item.name}</td>
                    <td className="px-4 py-3 text-sm">{item.set_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.set_code || '—'}</td>
                    <td className="px-4 py-3 text-sm">{item.card_number}</td>
                    <td className="px-4 py-3 text-sm">{item.foil}</td>
                    <td className="px-4 py-3 text-sm">${item.cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">{item.price_tix} Tix</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {selectedItems.size} of {items.length} items selected
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Clear Selection
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedItems.size === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={18} />
            {uploading ? 'Uploading...' : 'Upload Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
