import { EarningInput, EarningRecord } from '../types/earnings';

export function normalizeText(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

export function normalizeAmount(amount: number): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Generates a deterministic deduplication key for an earning record.
 * Ensures repeated imports of periodic task exports or re-imports of exported
 * ledger files never insert duplicate entries.
 */
export function computeDedupeKey(input: Pick<
  EarningInput,
  'dateTime' | 'platformChannel' | 'expenseItem' | 'activityItem' | 'rewardAmount' | 'externalTaskKey'
>): string {
  const dt = normalizeText(input.dateTime);
  const amt = normalizeAmount(input.rewardAmount);
  const ext = normalizeText(input.externalTaskKey);

  if (ext) {
    return `ext|${ext}|${dt}|${amt}`;
  }

  return [
    'sig',
    dt,
    normalizeText(input.platformChannel),
    normalizeText(input.activityItem),
    normalizeText(input.expenseItem),
    amt,
  ].join('|');
}

export function createRecordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildEarningRecord(
  input: EarningInput,
  explicitDedupeKey?: string
): EarningRecord {
  const cleanedAmount = Math.round(Number(input.rewardAmount) * 100) / 100;
  const normalizedInput: EarningInput = {
    ...input,
    dateTime: input.dateTime.trim(),
    platformChannel: input.platformChannel.trim() || '其他渠道',
    expenseItem: input.expenseItem.trim() || '无消费事项',
    activityItem: input.activityItem.trim() || '零星收益',
    rewardAmount: cleanedAmount,
    threshold: input.threshold.trim() || '无门槛',
    notes: input.notes.trim(),
    externalTaskKey: input.externalTaskKey?.trim() || undefined,
  };

  return {
    ...normalizedInput,
    id: createRecordId(),
    dedupeKey: explicitDedupeKey?.trim() || computeDedupeKey(normalizedInput),
    createdAt: new Date().toISOString(),
  };
}
