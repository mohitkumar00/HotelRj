import { beforeEach, describe, expect, it } from 'vitest';
import { checkPinAgainst, getLockRemainingMs, hashPin, isValidPinFormat, verifyManagerPin, changeManagerPin, setManagerPin } from './pin';
import { normalizeEmail } from './deviceAuth';
import { STORAGE_KEYS } from '../config';

beforeEach(() => localStorage.clear());

describe('PIN hashing', () => {
  it('verifies the right PIN and rejects the wrong one', async () => {
    const rec = await hashPin('4821');
    expect(await checkPinAgainst('4821', rec)).toBe(true);
    expect(await checkPinAgainst('4822', rec)).toBe(false);
  });
  it('uses a unique salt each time', async () => {
    const a = await hashPin('4821');
    const b = await hashPin('4821');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
  it('validates format', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
  });
});

describe('verifyManagerPin', () => {
  it('accepts legacy PINs only while no PIN is configured', async () => {
    expect((await verifyManagerPin('1234')).ok).toBe(true);
    localStorage.setItem(STORAGE_KEYS.pinHash, JSON.stringify(await hashPin('7391')));
    expect((await verifyManagerPin('1234')).ok).toBe(false);
    expect((await verifyManagerPin('7391')).ok).toBe(true);
  });
  it('locks out after repeated failures', async () => {
    localStorage.setItem(STORAGE_KEYS.pinHash, JSON.stringify(await hashPin('7391')));
    for (let i = 0; i < 5; i++) await verifyManagerPin('0000');
    expect(getLockRemainingMs()).toBeGreaterThan(0);
    const r = await verifyManagerPin('7391');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('locked');
  });

  it('changes PIN successfully when current PIN is correct and invalidates previous PIN', async () => {
    // Starts with default 1234
    expect((await verifyManagerPin('1234')).ok).toBe(true);

    // Fails with wrong current PIN
    const failRes = await changeManagerPin('9999', '5678');
    expect(failRes.ok).toBe(false);

    // Changes PIN with correct current PIN 1234 -> 5678
    const successRes = await changeManagerPin('1234', '5678');
    expect(successRes.ok).toBe(true);

    // 1234 no longer works!
    expect((await verifyManagerPin('1234')).ok).toBe(false);

    // 5678 works!
    expect((await verifyManagerPin('5678')).ok).toBe(true);

    // Can change again from 5678 -> 9012
    const nextRes = await changeManagerPin('5678', '9012');
    expect(nextRes.ok).toBe(true);
    expect((await verifyManagerPin('5678')).ok).toBe(false);
    expect((await verifyManagerPin('9012')).ok).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Owner@Hotel.CO.in ')).toBe('owner@hotel.co.in');
  });
  it('rejects invalid addresses', () => {
    expect(normalizeEmail('owner')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('a b@c.com')).toBeNull();
  });
});
