const API_BASE = '/api';

let apiKey = localStorage.getItem('cm_api_key') || '';

export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem('cm_api_key', key);
}

export function getApiKey(): string {
  return apiKey;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const conventionId = localStorage.getItem('cm_convention_id');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(conventionId && { 'x-convention-id': conventionId }),
      ...options.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Users
export const users = {
  list: () => request<any>('/users'),
  search: (query: string) => request<any>(`/users/search?q=${encodeURIComponent(query)}`),
  register: (name: string, nfcUid?: string, email?: string, attendanceDates?: string[], packageId?: number) =>
    request<any>('/users/register', { method: 'POST', body: JSON.stringify({ name, nfc_uid: nfcUid, email, attendance_dates: attendanceDates, package_id: packageId }) }),
  get: (id: number) => request<any>(`/users/${id}`),
  update: (id: number, fields: any) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  regenerateQR: (id: number) =>
    request<any>(`/users/${id}/regenerate-qr`, { method: 'POST' }),
  getQRToken: (id: number) =>
    request<any>(`/users/${id}/qr-token`),
  activate: (id: number) =>
    request<any>(`/users/${id}/activate`, { method: 'POST' }),
  deactivate: (id: number) =>
    request<any>(`/users/${id}/deactivate`, { method: 'POST' }),
};

// Vouchers
export const vouchers = {
  balance: (userId: number) => request<any>(`/vouchers/balance/${userId}`),
  history: (userId: number) => request<any>(`/vouchers/history/${userId}`),
  topup: (user_id: number, amount: number) =>
    request<any>('/vouchers/topup', { method: 'POST', body: JSON.stringify({ user_id, amount }) }),
  adjust: (user_id: number, amount: number) =>
    request<any>('/vouchers/adjust', { method: 'POST', body: JSON.stringify({ user_id, amount }) }),
};

// Tix
export const tix = {
  balance: (userId: number) => request<any>(`/tix/balance/${userId}`),
  history: (userId: number) => request<any>(`/tix/history/${userId}`),
  adjust: (user_id: number, amount: number) =>
    request<any>('/tix/adjust', { method: 'POST', body: JSON.stringify({ user_id, amount }) }),
};

// Events
export const events = {
  list: (status?: string) => request<any>(`/events${status ? `?status=${status}` : ''}`),
  get: (id: number) => request<any>(`/events/${id}`),
  create: (name: string, event_type_id: number, preregistration_enabled?: boolean) =>
    request<any>('/events', { method: 'POST', body: JSON.stringify({ name, event_type_id, preregistration_enabled }) }),
  register: (eventId: number, user_id: number) =>
    request<any>(`/events/${eventId}/register`, { method: 'POST', body: JSON.stringify({ user_id }) }),
  registerNfc: (eventId: number, nfc_uid: string) =>
    request<any>(`/events/${eventId}/register-nfc`, { method: 'POST', body: JSON.stringify({ nfc_uid }) }),
  start: (eventId: number) =>
    request<any>(`/events/${eventId}/start`, { method: 'POST' }),
  nextRound: (eventId: number) =>
    request<any>(`/events/${eventId}/next-round`, { method: 'POST' }),
  reportMatch: (matchId: number, player1_wins: number, player2_wins: number, draws: number = 0) =>
    request<any>(`/events/matches/${matchId}/report`, { method: 'POST', body: JSON.stringify({ player1_wins, player2_wins, draws }) }),
  getRoundMatches: (eventId: number, round: number) =>
    request<any>(`/events/${eventId}/rounds/${round}`),
  setResults: (eventId: number, results: Array<{ user_id: number; position: number }>) =>
    request<any>(`/events/${eventId}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
  finish: (eventId: number) =>
    request<any>(`/events/${eventId}/finish`, { method: 'POST' }),
  cancel: (eventId: number) =>
    request<any>(`/events/${eventId}/cancel`, { method: 'POST' }),
};

// Event Types
export const eventTypes = {
  list: () => request<any>('/events/types'),
  create: (data: { name: string; category: string; format?: string | null; tournament_structure?: string; entry_cost_vouchers: number; max_players: number; prize_structure: Record<string, number>; prize_structure_ties?: Record<string, number> }) =>
    request<any>('/events/types', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, fields: any) =>
    request<any>(`/events/types/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  delete: (id: number) =>
    request<any>(`/events/types/${id}`, { method: 'DELETE' }),
  duplicate: (id: number) =>
    request<any>(`/events/types/${id}/duplicate`, { method: 'POST' }),
};

// Prize Templates
export const prizeTemplates = {
  list: (rounds?: number) => request<any>(`/prize-templates${rounds ? `?rounds=${rounds}` : ''}`),
  get: (id: number) => request<any>(`/prize-templates/${id}`),
  create: (data: { name: string; rounds: number; prize_structure: Record<string, number>; prize_structure_ties: Record<string, number> }) =>
    request<any>('/prize-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, fields: any) =>
    request<any>(`/prize-templates/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  delete: (id: number) =>
    request<any>(`/prize-templates/${id}`, { method: 'DELETE' }),
};

// NFC Scan
export const scan = {
  lookup: (nfc_uid: string) =>
    request<any>('/scan', { method: 'POST', body: JSON.stringify({ nfc_uid }) }),
  balance: (nfc_uid: string) =>
    request<any>('/scan/balance', { method: 'POST', body: JSON.stringify({ nfc_uid }) }),
  lookupQr: (qr_code: string) =>
    request<any>('/scan/qr', { method: 'POST', body: JSON.stringify({ qr_code }) }),
  balanceQr: (qr_code: string) =>
    request<any>('/scan/qr/balance', { method: 'POST', body: JSON.stringify({ qr_code }) }),
};

// Store
export const store = {
  listItems: () => request<any>('/store/items'),
  createItem: (data: { name: string; description?: string; price_tix: number; stock: number; set_name?: string; card_number?: string; language?: string; condition?: string; foil?: boolean; cost?: number }) =>
    request<any>('/store/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: number, fields: any) =>
    request<any>(`/store/items/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  deleteItem: (id: number) =>
    request<any>(`/store/items/${id}`, { method: 'DELETE' }),
  listOrders: (status?: string) =>
    request<any>(`/store/orders${status ? `?status=${status}` : ''}`),
  fulfillOrder: (id: number) =>
    request<any>(`/store/orders/${id}/fulfill`, { method: 'POST' }),
  cancelOrder: (id: number) =>
    request<any>(`/store/orders/${id}/cancel`, { method: 'POST' }),
};

// Stats
export const stats = {
  get: () => request<any>('/stats'),
};

// Permissions
export const permissions = {
  categories: () => request<any>('/permissions/categories'),
  admins: () => request<any>('/permissions/admins'),
  get: (userId: number) => request<any>(`/permissions/${userId}`),
  set: (userId: number, perms: string[], is_admin?: boolean) =>
    request<any>(`/permissions/${userId}`, { method: 'PUT', body: JSON.stringify({ permissions: perms, is_admin }) }),
  promote: (userId: number, perms: string[]) =>
    request<any>(`/permissions/${userId}/promote`, { method: 'POST', body: JSON.stringify({ permissions: perms }) }),
  demote: (userId: number) =>
    request<any>(`/permissions/${userId}/demote`, { method: 'POST' }),
};

// Conventions
export const conventions = {
  list: () => request<any>('/conventions'),
  create: (name: string, startDate?: string, endDate?: string) => 
    request<any>('/conventions', { method: 'POST', body: JSON.stringify({ name, start_date: startDate, end_date: endDate }) }),
  get: (id: number) => request<any>(`/conventions/${id}`),
  update: (id: number, fields: any) => request<any>(`/conventions/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  end: (id: number) => request<any>(`/conventions/${id}/end`, { method: 'POST' }),
  getStats: (id: number) => request<any>(`/conventions/${id}/stats`),
  export: (id: number) => request<any>(`/conventions/${id}/export`),
  delete: (id: number) => request<any>(`/conventions/${id}`, { method: 'DELETE' }),
};

// Special Vouchers
export const specialVouchers = {
  list: (conventionId: number) => request<any>(`/special-vouchers?convention_id=${conventionId}`),
  create: (data: { event_id: number; name: string; amount: number; description?: string; icon?: string; color?: string; max_awards?: number }) =>
    request<any>('/special-vouchers', { method: 'POST', body: JSON.stringify(data) }),
  getByEvent: (eventId: number) => request<any>(`/special-vouchers/event/${eventId}`),
  get: (id: number) => request<any>(`/special-vouchers/${id}`),
  update: (id: number, fields: any) => request<any>(`/special-vouchers/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  delete: (id: number) => request<any>(`/special-vouchers/${id}`, { method: 'DELETE' }),
  award: (id: number, data: { user_id: number; event_id: number; awarded_by?: string }) =>
    request<any>(`/special-vouchers/${id}/award`, { method: 'POST', body: JSON.stringify(data) }),
  getAwards: (id: number) => request<any>(`/special-vouchers/${id}/awards`),
  getUserAwards: (userId: number, eventId: number) => request<any>(`/special-vouchers/user/${userId}/event/${eventId}`),
  deleteAward: (awardId: number) => request<any>(`/special-vouchers/awards/${awardId}`, { method: 'DELETE' }),
};

// Packages
export const packages = {
  list: () => request<any>('/packages'),
  create: (name: string, description: string | null, days: number, cost: number, preregCost: number | null, regularVoucherAmount: number) =>
    request<any>('/packages', { method: 'POST', body: JSON.stringify({ name, description, days, cost, prereg_cost: preregCost, regular_voucher_amount: regularVoucherAmount }) }),
  update: (id: number, name: string, description: string | null, days: number, cost: number, preregCost: number | null, regularVoucherAmount: number, is_active: boolean) =>
    request<any>(`/packages/${id}`, { method: 'PUT', body: JSON.stringify({ name, description, days, cost, prereg_cost: preregCost, regular_voucher_amount: regularVoucherAmount, is_active }) }),
  delete: (id: number) => request<any>(`/packages/${id}`, { method: 'DELETE' }),
  getSpecialVouchers: (id: number) => request<any>(`/packages/${id}/special-vouchers`),
  addSpecialVoucher: (id: number, voucherId: number) =>
    request<any>(`/packages/${id}/special-vouchers/${voucherId}`, { method: 'POST' }),
  removeSpecialVoucher: (id: number, voucherId: number) =>
    request<any>(`/packages/${id}/special-vouchers/${voucherId}`, { method: 'DELETE' }),
};

// Axios-compatible api object used by FloorPlan components
export const api = {
  get: async (path: string) => {
    const data = await request<any>(path);
    return { data };
  },
  post: async (path: string, body?: any) => {
    const data = await request<any>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    return { data };
  },
};

// Floor Plan
export const floorPlan = {
  get: () => request<any>('/floor-plan'),
  save: (data: any) => request<any>('/floor-plan', { method: 'POST', body: JSON.stringify(data) }),
  getTables: () => request<any>('/floor-plan/tables'),
  reserve: (tableId: number, eventId: number) =>
    request<any>(`/floor-plan/tables/${tableId}/reserve`, { method: 'POST', body: JSON.stringify({ eventId }) }),
  release: (eventId: number) =>
    request<any>(`/floor-plan/tables/release/${eventId}`, { method: 'POST' }),
};
