import { afterEach, describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './syncBase';
import { STORAGE_KEYS } from '../config';

afterEach(() => localStorage.clear());

describe('getApiBaseUrl', () => {
  it('falls back to loopback when nothing is configured (no window)', () => {
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:5050');
  });
  it('adds a scheme and trims trailing slashes on the saved counter address', () => {
    localStorage.setItem(STORAGE_KEYS.syncUrl, ' 192.168.1.15:5050/ ');
    expect(getApiBaseUrl()).toBe('http://192.168.1.15:5050');
  });
  it('keeps an explicit https address', () => {
    localStorage.setItem(STORAGE_KEYS.syncUrl, 'https://counter.example.com//');
    expect(getApiBaseUrl()).toBe('https://counter.example.com');
  });
  it('still honours the legacy key', () => {
    localStorage.setItem(STORAGE_KEYS.legacySyncUrl, '10.0.0.5:5050');
    expect(getApiBaseUrl()).toBe('http://10.0.0.5:5050');
  });
});
