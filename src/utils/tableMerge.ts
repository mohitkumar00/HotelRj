import type { MenuItem } from '../types';

export interface WaiterItemRecord {
  item: MenuItem;
  quantity: number;
  notes?: string;
  firedCount: number;
}

export interface TableOrder {
  tableId: string;
  serverName: string;
  openedAt: string;
  status: 'vacant' | 'active' | 'kot_sent' | 'billed';
  kotNumber: number;
  items: { [itemId: string]: WaiterItemRecord };
  generalNote?: string;
  updatedAt?: number;
}

/**
 * Merges remote table state into local state (authoritative newest timestamp wins).
 * Rules:
 * 1. If remote is explicitly vacant (settled or cancelled) and rTime >= lTime:
 *    - Table is VACANT with items: {}. Never resurrects settled/cancelled items.
 * 2. If local is vacant and strictly newer than remote (lTime > rTime):
 *    - Table remains VACANT with items: {}.
 * 3. If remote is strictly newer (rTime > lTime):
 *    - Remote table is authoritative. If remote is vacant, it stays vacant.
 * 4. If local is strictly newer (lTime > rTime):
 *    - Local table is kept.
 * 5. If timestamps are equal (rTime === lTime):
 *    - If either side is vacant, vacant wins (cleared/settled table).
 *    - Otherwise adopt remote table.
 */
export function mergeTables(
  local: { [key: string]: TableOrder },
  remote: { [key: string]: TableOrder }
): { [key: string]: TableOrder } {
  if (!remote || typeof remote !== 'object') return local;
  const merged: { [key: string]: TableOrder } = { ...local };

  for (const tableId of Object.keys(remote)) {
    const remoteTable = remote[tableId];
    const localTable = merged[tableId];

    if (!localTable) {
      merged[tableId] = remoteTable;
      continue;
    }

    const rTime = remoteTable.updatedAt || 0;
    const lTime = localTable.updatedAt || 0;

    // Rule 1: Remote is explicitly vacant and rTime >= lTime -> table is VACANT
    if (remoteTable.status === 'vacant' && rTime >= lTime) {
      merged[tableId] = {
        ...remoteTable,
        items: {},
      };
      continue;
    }

    // Rule 2: Local is vacant and strictly newer than remote -> local remains VACANT
    if (localTable.status === 'vacant' && lTime > rTime) {
      merged[tableId] = {
        ...localTable,
        items: {},
      };
      continue;
    }

    // Rule 3: Remote is strictly newer -> remote is authoritative
    if (rTime > lTime) {
      merged[tableId] = remoteTable;
      continue;
    }

    // Rule 4: Local is strictly newer -> local is authoritative
    if (lTime > rTime) {
      continue;
    }

    // Rule 5: Timestamps are equal -> vacant wins, or adopt remote
    if (remoteTable.status === 'vacant' || localTable.status === 'vacant') {
      const vacantTbl = remoteTable.status === 'vacant' ? remoteTable : localTable;
      merged[tableId] = {
        ...vacantTbl,
        status: 'vacant',
        items: {},
      };
    } else {
      merged[tableId] = remoteTable;
    }
  }

  return merged;
}
