import { describe, expect, it } from 'vitest';
import { mergeTables, type TableOrder } from './tableMerge';

const item = { id: 'a', name: 'Tea', price: 10 } as any;
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
  it('takes the newer remote table but keeps unfired local items', () => {
    const local = { 'T-1': table({ updatedAt: 1, items: { a: { item, quantity: 2, firedCount: 0 } } }) };
    const remote = { 'T-1': table({ updatedAt: 9, items: {} }) };
    expect(mergeTables(local, remote)['T-1'].items.a.quantity).toBe(2);
  });
  it('does not resurrect fully fired local items', () => {
    const local = { 'T-1': table({ updatedAt: 1, items: { a: { item, quantity: 2, firedCount: 2 } } }) };
    const remote = { 'T-1': table({ updatedAt: 9, items: {} }) };
    expect(mergeTables(local, remote)['T-1'].items.a).toBeUndefined();
  });
  it('merges equal-timestamp tables using max quantities', () => {
    const local = { 'T-1': table({ updatedAt: 4, items: { a: { item, quantity: 1, firedCount: 0 } } }) };
    const remote = { 'T-1': table({ updatedAt: 4, items: { a: { item, quantity: 3, firedCount: 1 } } }) };
    const out = mergeTables(local, remote)['T-1'].items.a;
    expect(out.quantity).toBe(3);
    expect(out.firedCount).toBe(1);
  });
  it('ignores invalid remote payloads', () => {
    const local = { 'T-1': table() };
    expect(mergeTables(local, null as any)).toBe(local);
  });
});
