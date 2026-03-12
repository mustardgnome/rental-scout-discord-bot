import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/schema.js';
import { loadPreferences, updatePreferences } from './preferences.js';
import { DEFAULT_PREFERENCES } from '../types.js';

let db: Database.Database;

beforeEach(() => {
  db = initializeDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('loadPreferences', () => {
  it('returns defaults when no preferences saved', () => {
    const prefs = loadPreferences(db);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns saved preferences', () => {
    const custom = { ...DEFAULT_PREFERENCES, target_budget: 3000 };
    updatePreferences(db, custom);
    expect(loadPreferences(db).target_budget).toBe(3000);
  });
});

describe('updatePreferences', () => {
  it('merges partial updates into existing preferences', () => {
    updatePreferences(db, { target_budget: 2600, max_budget: 2800 });
    const prefs = loadPreferences(db);
    expect(prefs.target_budget).toBe(2600);
    expect(prefs.max_budget).toBe(2800);
    expect(prefs.min_bedrooms).toBe(DEFAULT_PREFERENCES.min_bedrooms);
  });
});
