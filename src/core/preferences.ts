import Database from 'better-sqlite3';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types.js';
import { getPreferences, savePreferences } from '../db/storage.js';

export function loadPreferences(db: Database.Database): UserPreferences {
  return getPreferences(db) ?? DEFAULT_PREFERENCES;
}

export function updatePreferences(
  db: Database.Database,
  partial: Partial<UserPreferences>,
): UserPreferences {
  const current = loadPreferences(db);
  const merged = { ...current, ...partial };
  savePreferences(db, merged);
  return merged;
}
