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

/** Merges remote table state into local state (newest wins; unfired local items are preserved). */
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
      const items = { ...remoteTable.items };
      for (const itemId of Object.keys(localTable.items || {})) {
        const localItem = localTable.items[itemId];
        if (!items[itemId] && localItem.quantity > (localItem.firedCount || 0)) {
          items[itemId] = localItem;
        }
      }
      merged[tableId] = {
        ...remoteTable,
        items,
      };
    } else if (lTime > rTime) {
      continue;
    } else {
      const mergedItems = { ...localTable.items };
      for (const itemId of Object.keys(remoteTable.items || {})) {
        const rItem = remoteTable.items[itemId];
        const lItem = mergedItems[itemId];
        if (!lItem) {
          mergedItems[itemId] = rItem;
        } else {
          mergedItems[itemId] = {
            ...lItem,
            quantity: Math.max(lItem.quantity, rItem.quantity),
            firedCount: Math.max(lItem.firedCount, rItem.firedCount),
            notes: rItem.notes || lItem.notes,
          };
        }
      }
      merged[tableId] = {
        ...localTable,
        status: remoteTable.status !== 'vacant' ? remoteTable.status : localTable.status,
        kotNumber: Math.max(localTable.kotNumber || 1, remoteTable.kotNumber || 1),
        openedAt: localTable.openedAt || remoteTable.openedAt,
        items: mergedItems,
      };
    }
  }
  return merged;
}
