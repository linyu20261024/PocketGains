import * as XLSX from 'xlsx';
import {
  ColumnMapping,
  EarningInput,
  EarningRecord,
  EntrySourceType,
  ImportCandidateRow,
  ParsedImportPreview,
} from '../types/earnings';
import { buildChannelBreakdown, buildChartSeries } from './analytics';
import { computeDedupeKey } from './dedupe';

const HEADER_SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  dateTime: ['日期时间', '时间', '日期', '完成时间', '收益日期', '到账时间', '发生时间', 'datetime', 'date', 'time', 'completedat'],
  platformChannel: ['支付平台渠道', '支付平台', '平台渠道', '渠道', '平台', '银行', '支付方式', 'platformchannel', 'platform', 'channel'],
  expenseItem: ['消费事项', '消费内容', '消费项目', '商户', '消费场景', 'expenseitem', 'expense', 'merchant'],
  activityItem: ['活动事项', '活动名称', '周期任务', '任务名称', '任务内容', '活动', '项目名称', 'activityitem', 'activity', 'taskname', 'task'],
  rewardAmount: ['收益金额', '返现金额', '奖励金额', '收益', '金额', '返现', '实得金额', 'rewardamount', 'reward', 'amount', 'profit'],
  threshold: ['门槛', '消费门槛', '使用门槛', '达标条件', '条件', 'threshold', 'condition'],
  notes: ['其他备注', '备注', '说明', '详情', 'notes', 'remark', 'memo'],
  externalTaskKey: ['任务id', '周期任务id', '周期编号', '任务编号', '流水号', '订单号', '唯一标识', 'externaltaskkey', 'taskid', 'taskkey'],
  taskStatus: ['任务状态', '状态', '是否达标', '完成状态', '达标状态', 'status', 'completed'],
};

const INCOMPLETE_STATUS_TOKENS = [
  '未完成',
  '未达标',
  '已过期',
  '已失效',
  '已取消',
  '待完成',
  '作废',
  '失败',
  'pending',
  'incomplete',
  'expired',
  'cancelled',
  'failed',
  'false',
  '否',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function normalizeDateTimeValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())} ${pad2(val.getHours())}:${pad2(val.getMinutes())}`;
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    // Excel serial date number
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)} ${pad2(parsed.H || 0)}:${pad2(parsed.M || 0)}`;
    }
  }

  const raw = String(val).trim();
  if (!raw) return '';

  // Handle Chinese formats like 2026年11月16日 14:30
  const cleaned = raw
    .replace(/年|\//g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace('T', ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleaned.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?/
  );
  if (match) {
    const [, y, m, d, hh = '00', mm = '00'] = match;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))} ${pad2(Number(hh))}:${pad2(Number(mm))}`;
  }

  const fallbackDate = new Date(raw);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return `${fallbackDate.getFullYear()}-${pad2(fallbackDate.getMonth() + 1)}-${pad2(fallbackDate.getDate())} ${pad2(fallbackDate.getHours())}:${pad2(fallbackDate.getMinutes())}`;
  }

  return '';
}

export function parseRewardNumber(val: unknown): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.round(val * 100) / 100 : 0;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[¥￥,\s元]/g, '').trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }
  return 0;
}

export function inferColumnMapping(headers: string[]): ColumnMapping {
  const findMatch = (field: keyof ColumnMapping): string => {
    const synonyms = HEADER_SYNONYMS[field];
    // Exact match first (case-insensitive)
    for (const h of headers) {
      const normalized = h.trim().toLowerCase().replace(/\s+/g, '');
      if (synonyms.includes(normalized)) return h;
    }
    // Partial substring match second
    for (const h of headers) {
      const normalized = h.trim().toLowerCase().replace(/\s+/g, '');
      if (synonyms.some((s) => normalized.includes(s) || s.includes(normalized))) {
        return h;
      }
    }
    return '';
  };

  return {
    dateTime: findMatch('dateTime'),
    platformChannel: findMatch('platformChannel'),
    expenseItem: findMatch('expenseItem'),
    activityItem: findMatch('activityItem'),
    rewardAmount: findMatch('rewardAmount'),
    threshold: findMatch('threshold'),
    notes: findMatch('notes'),
    externalTaskKey: findMatch('externalTaskKey'),
    taskStatus: findMatch('taskStatus'),
  };
}

export function evaluateImportCandidates(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingRecords: EarningRecord[],
  importMode: EntrySourceType,
  fileName: string
): {
  candidates: ImportCandidateRow[];
  stats: ParsedImportPreview['stats'];
} {
  const existingKeys = new Set(existingRecords.map((r) => r.dedupeKey));
  const seenInFile = new Set<string>();

  const candidates: ImportCandidateRow[] = rawRows.map((raw, idx) => {
    const getCell = (col: string) => (col ? raw[col] : undefined);

    const rawStatus = String(getCell(mapping.taskStatus) ?? '').trim().toLowerCase();
    const rewardAmount = parseRewardNumber(getCell(mapping.rewardAmount));
    const dateTime = normalizeDateTimeValue(getCell(mapping.dateTime));
    const platformChannel = String(getCell(mapping.platformChannel) ?? '').trim() || '其他渠道';
    const expenseItem = String(getCell(mapping.expenseItem) ?? '').trim() || '无消费事项';
    const activityItem = String(getCell(mapping.activityItem) ?? '').trim() || '周期任务收益';
    const threshold = String(getCell(mapping.threshold) ?? '').trim() || '无门槛';
    const notes = String(getCell(mapping.notes) ?? '').trim();
    const externalTaskKey = String(getCell(mapping.externalTaskKey) ?? '').trim() || undefined;

    // Respect explicit sourceType or dedupeKey if re-importing an exported JSON/Excel backup
    const rawSource = String(raw['来源类型'] ?? raw['sourceType'] ?? '').trim();
    const resolvedSource: EntrySourceType =
      rawSource === '手工零星录入' || rawSource === 'manual_adhoc'
        ? 'manual_adhoc'
        : rawSource === '周期任务导入' || rawSource === 'periodic_import'
          ? 'periodic_import'
          : importMode;

    const record: EarningInput = {
      dateTime,
      platformChannel,
      expenseItem,
      activityItem,
      rewardAmount,
      threshold,
      notes,
      externalTaskKey,
      sourceType: resolvedSource,
      importBatchName: fileName,
    };

    const explicitKey = String(raw['唯一指纹'] ?? raw['dedupeKey'] ?? '').trim();
    const dedupeKey = explicitKey || computeDedupeKey(record);

    if (
      rawStatus &&
      INCOMPLETE_STATUS_TOKENS.some((token) => rawStatus === token || rawStatus.includes(token))
    ) {
      return {
        rowIndex: idx + 1,
        raw,
        record,
        dedupeKey,
        status: 'skipped_no_reward',
        skipReason: `任务状态为“${String(getCell(mapping.taskStatus))}”`,
      };
    }

    if (!dateTime) {
      return {
        rowIndex: idx + 1,
        raw,
        record,
        dedupeKey,
        status: 'invalid',
        skipReason: '缺少有效的日期时间',
      };
    }

    if (rewardAmount <= 0) {
      return {
        rowIndex: idx + 1,
        raw,
        record,
        dedupeKey,
        status: 'skipped_no_reward',
        skipReason: '收益金额为 0 或无效',
      };
    }

    if (existingKeys.has(dedupeKey)) {
      return {
        rowIndex: idx + 1,
        raw,
        record,
        dedupeKey,
        status: 'duplicate_existing',
        skipReason: '账本中已存在相同收益记录',
      };
    }

    if (seenInFile.has(dedupeKey)) {
      return {
        rowIndex: idx + 1,
        raw,
        record,
        dedupeKey,
        status: 'duplicate_in_file',
        skipReason: '导入文件内部存在重复记录',
      };
    }

    seenInFile.add(dedupeKey);

    return {
      rowIndex: idx + 1,
      raw,
      record,
      dedupeKey,
      status: 'new',
    };
  });

  let newCount = 0;
  let duplicateCount = 0;
  let skippedCount = 0;
  let newTotalAmount = 0;

  for (const c of candidates) {
    if (c.status === 'new') {
      newCount += 1;
      newTotalAmount = Math.round((newTotalAmount + c.record.rewardAmount) * 100) / 100;
    } else if (c.status === 'duplicate_existing' || c.status === 'duplicate_in_file') {
      duplicateCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    candidates,
    stats: {
      totalRows: candidates.length,
      newCount,
      duplicateCount,
      skippedCount,
      newTotalAmount,
    },
  };
}

export async function parseImportFile(
  file: File,
  existingRecords: EarningRecord[],
  importMode: EntrySourceType,
  preferredSheet?: string
): Promise<ParsedImportPreview> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const arr: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : [];
    const headers = arr.length > 0 ? Array.from(new Set(arr.flatMap((r) => Object.keys(r)))) : [];
    const mapping = inferColumnMapping(headers);
    const { candidates, stats } = evaluateImportCandidates(
      arr,
      mapping,
      existingRecords,
      importMode,
      file.name
    );

    return {
      fileName: file.name,
      sheetNames: ['JSON 数据'],
      selectedSheet: 'JSON 数据',
      headers,
      rawRows: arr,
      mapping,
      candidates,
      stats,
    };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const selectedSheet =
    preferredSheet && sheetNames.includes(preferredSheet) ? preferredSheet : sheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const headers =
    rawRows.length > 0 ? Array.from(new Set(rawRows.flatMap((row) => Object.keys(row)))) : [];
  const mapping = inferColumnMapping(headers);
  const { candidates, stats } = evaluateImportCandidates(
    rawRows,
    mapping,
    existingRecords,
    importMode,
    file.name
  );

  return {
    fileName: file.name,
    sheetNames,
    selectedSheet,
    headers,
    rawRows,
    mapping,
    candidates,
    stats,
  };
}

export function exportToExcel(records: EarningRecord[]): void {
  const wb = XLSX.utils.book_new();

  const detailRows = records.map((r) => ({
    日期时间: r.dateTime,
    支付平台渠道: r.platformChannel,
    消费事项: r.expenseItem,
    活动事项: r.activityItem,
    收益金额: r.rewardAmount,
    门槛: r.threshold,
    来源类型: r.sourceType === 'periodic_import' ? '周期任务导入' : '手工零星录入',
    任务ID: r.externalTaskKey || '',
    其他备注: r.notes,
    导入批次: r.importBatchName || '',
    唯一指纹: r.dedupeKey,
  }));

  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, '收益明细');

  const monthlySeries = buildChartSeries(records, 'monthly', 'desc');
  const monthlyRows = monthlySeries.map((m) => ({
    月份: m.key,
    当月收益金额: m.periodAmount,
    截至当月累计收益: m.cumulativeAmount,
    笔数: m.count,
  }));
  const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
  wsMonthly['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsMonthly, '月度统计');

  const channelBreakdown = buildChannelBreakdown(records);
  const channelRows = channelBreakdown.map((c) => ({
    支付平台渠道: c.channel,
    累计收益金额: c.amount,
    笔数: c.count,
    金额占比百分比: `${c.share}%`,
  }));
  const wsChannel = XLSX.utils.json_to_sheet(channelRows);
  wsChannel['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsChannel, '渠道汇总');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `零散收益统计_${dateTag}.xlsx`);
}

export function exportToCsv(records: EarningRecord[]): void {
  const headers = [
    '日期时间',
    '支付平台渠道',
    '消费事项',
    '活动事项',
    '收益金额',
    '门槛',
    '来源类型',
    '任务ID',
    '其他备注',
    '唯一指纹',
  ];

  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(','),
    ...records.map((r) =>
      [
        r.dateTime,
        r.platformChannel,
        r.expenseItem,
        r.activityItem,
        r.rewardAmount.toFixed(2),
        r.threshold,
        r.sourceType === 'periodic_import' ? '周期任务导入' : '手工零星录入',
        r.externalTaskKey || '',
        r.notes,
        r.dedupeKey,
      ]
        .map(escapeCell)
        .join(',')
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `零散收益统计_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportToJson(records: EarningRecord[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: records.length,
    records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerBlobDownload(blob, `零散收益备份_${new Date().toISOString().slice(0, 10)}.json`);
}

export function downloadPeriodicTemplate(): void {
  const sampleRows = [
    {
      任务ID: 'CMB-W47-01',
      日期时间: '2026-11-16 18:30',
      支付平台渠道: '招商银行',
      消费事项: '山姆会员店采购',
      活动事项: '周末刷卡满额返现周期任务',
      收益金额: 30.0,
      门槛: '满300元达标',
      任务状态: '已完成',
      其他备注: '周期任务第47周导出示例，重复导入将自动去重',
    },
    {
      任务ID: 'ALI-W47-02',
      日期时间: '2026-11-15 12:15',
      支付平台渠道: '支付宝',
      消费事项: '便利店午餐',
      活动事项: '每周五消费笔笔返红包',
      收益金额: 2.88,
      门槛: '满15元可用',
      任务状态: '已完成',
      其他备注: '自动提取有效收益记录',
    },
    {
      任务ID: 'UP-W47-03',
      日期时间: '2026-11-14 09:00',
      支付平台渠道: '云闪付',
      消费事项: '无消费',
      活动事项: '银联月度签约待完成任务',
      收益金额: 0,
      门槛: '需消费3笔',
      任务状态: '未完成',
      其他备注: '未完成或收益为0的任务会在提取时自动跳过',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 26 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '周期任务导出示例');
  XLSX.writeFile(wb, '周期任务收益导入模板.xlsx');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
