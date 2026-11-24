export type EntrySourceType = 'periodic_import' | 'manual_adhoc';

export type SortDirection = 'desc' | 'asc';

export type SortField = 'dateTime' | 'rewardAmount';

export type ChartGranularity = 'daily' | 'monthly' | 'yearly' | 'cumulative';

export interface EarningRecord {
  id: string;
  dedupeKey: string;
  externalTaskKey?: string;
  dateTime: string; // Normalized YYYY-MM-DD HH:mm
  platformChannel: string; // 支付平台渠道
  expenseItem: string; // 消费事项
  activityItem: string; // 活动事项
  rewardAmount: number; // 收益金额 (CNY)
  threshold: string; // 门槛
  notes: string; // 其他备注
  sourceType: EntrySourceType;
  importBatchName?: string;
  createdAt: string;
}

export type EarningInput = Omit<EarningRecord, 'id' | 'dedupeKey' | 'createdAt'>;

export interface ImportCandidateRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  record: EarningInput;
  dedupeKey: string;
  status: 'new' | 'duplicate_existing' | 'duplicate_in_file' | 'skipped_no_reward' | 'invalid';
  skipReason?: string;
}

export interface ColumnMapping {
  dateTime: string;
  platformChannel: string;
  expenseItem: string;
  activityItem: string;
  rewardAmount: string;
  threshold: string;
  notes: string;
  externalTaskKey: string;
  taskStatus: string;
}

export interface ParsedImportPreview {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  mapping: ColumnMapping;
  candidates: ImportCandidateRow[];
  detectedFormat?: 'recurring_backup' | 'card_benefit_backup' | 'tabular';
  recurringSummary?: {
    version: number;
    ruleCount: number;
    recordCount: number;
  };
  cardBenefitSummary?: {
    version: number;
    ruleCount: number;
    feedbackCount: number;
    claimedTierCount: number;
  };
  stats: {
    totalRows: number;
    newCount: number;
    duplicateCount: number;
    skippedCount: number;
    newTotalAmount: number;
  };
}

export interface PeriodBucketPoint {
  key: string; // YYYY-MM-DD, YYYY-MM, or YYYY
  label: string;
  periodAmount: number;
  cumulativeAmount: number;
  count: number;
}

export interface ChannelBreakdownItem {
  channel: string;
  amount: number;
  count: number;
  share: number; // 0-100
}
