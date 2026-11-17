import { SAMPLE_EARNING_INPUTS } from '../data/sampleData';
import { EarningRecord } from '../types/earnings';
import { buildEarningRecord } from './dedupe';

const STORAGE_KEY = 'shiling_earnings_ledger_v1';
const SEEDED_FLAG_KEY = 'shiling_earnings_seeded_v1';

export function loadStoredRecords(): EarningRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is EarningRecord =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.dedupeKey === 'string' &&
            typeof item.dateTime === 'string' &&
            typeof item.rewardAmount === 'number'
        );
      }
    }

    const alreadySeeded = localStorage.getItem(SEEDED_FLAG_KEY);
    if (!alreadySeeded) {
      const seeded = SAMPLE_EARNING_INPUTS.map((item) => buildEarningRecord(item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(SEEDED_FLAG_KEY, '1');
      return seeded;
    }

    return [];
  } catch {
    return [];
  }
}

export function saveStoredRecords(records: EarningRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(SEEDED_FLAG_KEY, '1');
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function restoreSampleRecords(): EarningRecord[] {
  const seeded = SAMPLE_EARNING_INPUTS.map((item) => buildEarningRecord(item));
  saveStoredRecords(seeded);
  return seeded;
}
