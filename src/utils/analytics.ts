import {
  ChannelBreakdownItem,
  ChartGranularity,
  EarningRecord,
  PeriodBucketPoint,
  SortDirection,
  SortField,
} from '../types/earnings';

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sortRecords(
  records: EarningRecord[],
  field: SortField,
  direction: SortDirection
): EarningRecord[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    if (field === 'rewardAmount') {
      const diff = a.rewardAmount - b.rewardAmount;
      if (diff !== 0) return diff * factor;
      return a.dateTime.localeCompare(b.dateTime) * -1;
    }
    const dtDiff = a.dateTime.localeCompare(b.dateTime);
    if (dtDiff !== 0) return dtDiff * factor;
    return a.createdAt.localeCompare(b.createdAt) * factor;
  });
}

export type BucketGranularity = 'daily' | 'monthly' | 'yearly';

function getBucketKey(dateTime: string, bucketGranularity: BucketGranularity): string {
  const datePart = dateTime.slice(0, 10); // YYYY-MM-DD
  if (bucketGranularity === 'yearly') {
    return datePart.slice(0, 4); // YYYY
  }
  if (bucketGranularity === 'monthly') {
    return datePart.slice(0, 7); // YYYY-MM
  }
  return datePart; // YYYY-MM-DD
}

function formatBucketLabel(key: string, bucketGranularity: BucketGranularity): string {
  if (bucketGranularity === 'yearly') {
    return `${key}年`;
  }
  if (bucketGranularity === 'monthly') {
    const [year, month] = key.split('-');
    return `${year.slice(2)}/${month}`;
  }
  // YYYY-MM-DD -> MM-DD
  return key.slice(5);
}

/**
 * Aggregates records into chronological buckets for Daily / Monthly / Yearly / Cumulative charts.
 * Always computes true chronological cumulative totals from earliest to latest date first,
 * then orders the output array in the user-requested sort direction (asc or desc).
 */
export function buildChartSeries(
  records: EarningRecord[],
  granularity: ChartGranularity,
  direction: SortDirection,
  cumulativeGranularity: BucketGranularity = 'daily'
): PeriodBucketPoint[] {
  if (records.length === 0) return [];

  const effectiveBucket: BucketGranularity =
    granularity === 'cumulative' ? cumulativeGranularity : granularity;

  const bucketMap = new Map<string, { amount: number; count: number }>();

  for (const rec of records) {
    if (!rec.dateTime || rec.dateTime.length < 4) continue;
    const key = getBucketKey(rec.dateTime, effectiveBucket);
    const existing = bucketMap.get(key) || { amount: 0, count: 0 };
    existing.amount = Math.round((existing.amount + rec.rewardAmount) * 100) / 100;
    existing.count += 1;
    bucketMap.set(key, existing);
  }

  // Always compute cumulative running sum strictly in chronological ascending order
  const ascKeys = Array.from(bucketMap.keys()).sort((a, b) => a.localeCompare(b));
  const spansMultipleYears =
    ascKeys.length > 1 && ascKeys[0].slice(0, 4) !== ascKeys[ascKeys.length - 1].slice(0, 4);

  let runningCumulative = 0;
  const chronologicalPoints: PeriodBucketPoint[] = ascKeys.map((key) => {
    const entry = bucketMap.get(key)!;
    runningCumulative = Math.round((runningCumulative + entry.amount) * 100) / 100;
    let label = formatBucketLabel(key, effectiveBucket);
    if (effectiveBucket === 'daily' && spansMultipleYears) {
      label = `${key.slice(2, 4)}/${key.slice(5)}`;
    }
    return {
      key,
      label,
      periodAmount: entry.amount,
      cumulativeAmount: runningCumulative,
      count: entry.count,
    };
  });

  return direction === 'desc' ? [...chronologicalPoints].reverse() : chronologicalPoints;
}

export function buildChannelBreakdown(records: EarningRecord[]): ChannelBreakdownItem[] {
  const total = records.reduce((sum, r) => sum + r.rewardAmount, 0);
  const map = new Map<string, { amount: number; count: number }>();

  for (const rec of records) {
    const channel = rec.platformChannel || '其他渠道';
    const existing = map.get(channel) || { amount: 0, count: 0 };
    existing.amount = Math.round((existing.amount + rec.rewardAmount) * 100) / 100;
    existing.count += 1;
    map.set(channel, existing);
  }

  return Array.from(map.entries())
    .map(([channel, stats]) => ({
      channel,
      amount: stats.amount,
      count: stats.count,
      share: total > 0 ? Math.round((stats.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface ActivityBreakdownItem {
  activity: string;
  amount: number;
  count: number;
  share: number; // 0-100
}

export function buildActivityBreakdown(records: EarningRecord[]): ActivityBreakdownItem[] {
  const total = records.reduce((sum, r) => sum + r.rewardAmount, 0);
  const map = new Map<string, { amount: number; count: number }>();

  for (const rec of records) {
    const activity = rec.activityItem?.trim() || '零星收益';
    const existing = map.get(activity) || { amount: 0, count: 0 };
    existing.amount = Math.round((existing.amount + rec.rewardAmount) * 100) / 100;
    existing.count += 1;
    map.set(activity, existing);
  }

  return Array.from(map.entries())
    .map(([activity, stats]) => ({
      activity,
      amount: stats.amount,
      count: stats.count,
      share: total > 0 ? Math.round((stats.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface KpiMetrics {
  totalCumulative: number;
  currentYearAmount: number;
  currentMonthAmount: number;
  todayAmount: number;
  recordCount: number;
  periodicCount: number;
  adhocCount: number;
  avgReward: number;
  referenceYear: string;
  referenceMonth: string;
  referenceDate: string;
}

export function computeKpiMetrics(records: EarningRecord[], now = new Date()): KpiMetrics {
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const monthStr = todayStr.slice(0, 7);
  const yearStr = todayStr.slice(0, 4);

  let totalCumulative = 0;
  let currentYearAmount = 0;
  let currentMonthAmount = 0;
  let todayAmount = 0;
  let periodicCount = 0;
  let adhocCount = 0;

  for (const r of records) {
    totalCumulative += r.rewardAmount;
    const d = r.dateTime.slice(0, 10);
    if (d.startsWith(yearStr)) currentYearAmount += r.rewardAmount;
    if (d.startsWith(monthStr)) currentMonthAmount += r.rewardAmount;
    if (d === todayStr) todayAmount += r.rewardAmount;
    if (r.sourceType === 'periodic_import') periodicCount += 1;
    else adhocCount += 1;
  }

  const round2 = (v: number) => Math.round(v * 100) / 100;

  return {
    totalCumulative: round2(totalCumulative),
    currentYearAmount: round2(currentYearAmount),
    currentMonthAmount: round2(currentMonthAmount),
    todayAmount: round2(todayAmount),
    recordCount: records.length,
    periodicCount,
    adhocCount,
    avgReward: records.length > 0 ? round2(totalCumulative / records.length) : 0,
    referenceYear: yearStr,
    referenceMonth: monthStr,
    referenceDate: todayStr,
  };
}
