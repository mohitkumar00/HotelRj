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
 * Merges remote table state into local state (newest timestamp wins).
 * Rules:
 * 1. If remote is strictly newer (remote.updatedAt > local.updatedAt):
 *    - Remote table's items are the authoritative state (allows item additions, removals, and quantity decreases).
 *    - Only items that were already FIRED to the kitchen on local (localItem.firedCount > 0) are preserved
 *      so fired kitchen orders are never lost.
 * 2. If local is strictly newer (local.updatedAt > remote.updatedAt):
 *    - Local table is kept.
 * 3. If timestamps are equal:
 *    - Adopt remote table, protecting any items already fired on local.
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

    if (rTime > lTime) {
      // Remote is strictly newer. Use remote's items as the base.
      const items = { ...(remoteTable.items || {}) };

      // Preserve only items already fired to kitchen on local (unfired items removed remotely stay removed)
      for (const itemId of Object.keys(localTable.items || {})) {
        const localItem = localTable.items[itemId];
        if (localItem && (localItem.firedCount || 0) > 0) {
          if (!items[itemId]) {
            items[itemId] = localItem;
          } else {
            const rItem = items[itemId];
            const maxFired = Math.max(rItem.firedCount || 0, localItem.firedCount || 0);
            items[itemId] = {
              ...rItem,
              firedCount: maxFired,
              quantity: Math.max(rItem.quantity || 0, maxFired),
            };
          }
        }
      }

      merged[tableId] = {
        ...remoteTable,
        items,
      };
    } else if (lTime > rTime) {
      // Local is strictly newer. Keep local table.
      continue;
    } else {
      // Equal timestamps: adopt remote while protecting any already-fired items
      const items = { ...(remoteTable.items || {}) };
      for (const itemId of Object.keys(localTable.items || {})) {
        const localItem = localTable.items[itemId];
        if (localItem && (localItem.firedCount || 0) > 0) {
          if (!items[itemId]) {
            items[itemId] = localItem;
          } else {
            const rItem = items[itemId];
            const maxFired = Math.max(rItem.firedCount || 0, localItem.firedCount || 0);
            items[itemId] = {
              ...rItem,
              firedCount: maxFired,
              quantity: Math.max(rItem.quantity || 0, maxFired),
            };
          }
        }
      }

      merged[tableId] = {
        ...remoteTable,
        status: remoteTable.status !== 'vacant' ? remoteTable.status : localTable.status,
        kotNumber: Math.max(localTable.kotNumber || 1, remoteTable.kotNumber || 1),
        openedAt: remoteTable.openedAt || localTable.openedAt,
        items,
      };
    }
  }

  return merged;
}
