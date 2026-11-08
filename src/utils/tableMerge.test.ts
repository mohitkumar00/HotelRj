import { describe, expect, it } from 'vitest';
import { mergeTables, type TableOrder } from './tableMerge';

const item = { id: 'a', name: 'Tea', price: 10 } as any;
const itemB = { id: 'b', name: 'Coffee', price: 20 } as any;
const table = (over: Partial<TableOrder> = {}): TableOrder => ({
  tableId: 'T-1',
  serverName: 'S',
  openedAt: 't',
  status: 'active',
  kotNumber: 1,
  items: {},
  ...over,
});

describe('mergeTables', () => {
  it('adds tables that only exist remotely', () => {
    const out = mergeTables({}, { 'T-1': table() });
    expect(Object.keys(out)).toEqual(['T-1']);
  });

  it('keeps the newer local table', () => {
    const local = { 'T-1': table({ updatedAt: 5, kotNumber: 3 }) };
    const remote = { 'T-1': table({ updatedAt: 2, kotNumber: 1 }) };
    expect(mergeTables(local, remote)['T-1'].kotNumber).toBe(3);
  });

  it('takes the newer remote table and honors unfired item removals', () => {
    // Waiter on mobile deleted unfired item 'a'
    const local = { 'T-1': table({ updatedAt: 1, items: { a: { item, quantity: 2, firedCount: 0 } } }) };
    const remote = { 'T-1': table({ updatedAt: 9, items: {} }) };
    const merged = mergeTables(local, remote)['T-1'];
    expect(merged.items.a).toBeUndefined();
  });

  it('allows quantity decrements on items when remote is newer', () => {
    // Waiter on mobile decremented quantity from 2 to 1
    const local = { 'T-1': table({ updatedAt: 1, items: { a: { item, quantity: 2, firedCount: 0 } } }) };
    const remote = { 'T-1': table({ updatedAt: 9, items: { a: { item, quantity: 1, firedCount: 0 } } }) };
    const merged = mergeTables(local, remote)['T-1'];
    expect(merged.items.a.quantity).toBe(1);
  });

  it('honors remote void / cancellation of fired items without resurrecting them', () => {
    // Manager voided fired item 'a' and added item 'b'
    const local = { 'T-1': table({ updatedAt: 1, items: { a: { item, quantity: 2, firedCount: 2 } } }) };
    const remote = { 'T-1': table({ updatedAt: 9, items: { b: { item: itemB, quantity: 1, firedCount: 0 } } }) };
    const merged = mergeTables(local, remote)['T-1'];
    expect(merged.items.a).toBeUndefined();
    expect(merged.items.b.quantity).toBe(1);
  });

  it('strictly vacates table and clears all items when remote marks table vacant upon settlement', () => {
    // Table had 3 fired items on local. Cashier settled bill on remote (status: 'vacant', items: {})
    const local = {
      'T-1': table({
        status: 'kot_sent',
        updatedAt: 5,
        items: {
          a: { item, quantity: 2, firedCount: 2 },
          b: { item: itemB, quantity: 1, firedCount: 1 },
        },
      }),
    };
    const remote = {
      'T-1': table({
        status: 'vacant',
        updatedAt: 10,
        items: {},
      }),
    };
    const merged = mergeTables(local, remote)['T-1'];
    expect(merged.status).toBe('vacant');
    expect(Object.keys(merged.items)).toHaveLength(0);
  });

  it('keeps local vacant if local is newer than remote', () => {
    const local = { 'T-1': table({ status: 'vacant', updatedAt: 15, items: {} }) };
    const remote = { 'T-1': table({ status: 'active', updatedAt: 10, items: { a: { item, quantity: 1, firedCount: 1 } } }) };
    const merged = mergeTables(local, remote)['T-1'];
    expect(merged.status).toBe('vacant');
    expect(Object.keys(merged.items)).toHaveLength(0);
  });

  it('ignores invalid remote payloads', () => {
    const local = { 'T-1': table() };
    expect(mergeTables(local, null as any)).toBe(local);
  });
});
