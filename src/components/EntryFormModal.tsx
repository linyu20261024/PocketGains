import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, History, X } from 'lucide-react';
import { EarningInput, EarningRecord, EntrySourceType } from '../types/earnings';
import { computeDedupeKey } from '../utils/dedupe';

interface EntryFormModalProps {
  isOpen: boolean;
  editingRecord: EarningRecord | null;
  existingRecords: EarningRecord[];
  onClose: () => void;
  onSave: (input: EarningInput, editId?: string) => void;
}

interface HistorySuggestion {
  value: string;
  count: number;
  lastDateTime: string;
  topChannel: string;
  topCompanion: string;
  topThreshold: string;
  channels: Set<string>;
  companions: Set<string>;
}

const DEFAULT_CHANNEL_PRESETS = [
  '支付宝',
  '微信支付',
  '云闪付',
  '招商银行',
  '工商银行',
  '建设银行',
  '京东支付',
  '美团',
  '淘宝/天猫',
];

function getNowLocalFormatted(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function pickTopKey(freqMap: Map<string, number>, fallback = ''): string {
  let bestKey = fallback;
  let bestCount = -1;
  for (const [k, c] of freqMap.entries()) {
    if (c > bestCount) {
      bestKey = k;
      bestCount = c;
    }
  }
  return bestKey;
}

function buildFieldSuggestions(
  records: EarningRecord[],
  field: 'activityItem' | 'expenseItem'
): HistorySuggestion[] {
  const grouped = new Map<
    string,
    {
      value: string;
      count: number;
      lastDateTime: string;
      channelFreq: Map<string, number>;
      companionFreq: Map<string, number>;
      thresholdFreq: Map<string, number>;
    }
  >();

  for (const rec of records) {
    const rawVal = (rec[field] || '').trim();
    if (!rawVal) continue;
    if (field === 'expenseItem' && rawVal === '无消费事项') continue;

    const companionVal =
      field === 'activityItem'
        ? (rec.expenseItem || '').trim()
        : (rec.activityItem || '').trim();
    const channelVal = (rec.platformChannel || '').trim();
    const thresholdVal = (rec.threshold || '').trim();

    let bucket = grouped.get(rawVal);
    if (!bucket) {
      bucket = {
        value: rawVal,
        count: 0,
        lastDateTime: rec.dateTime,
        channelFreq: new Map(),
        companionFreq: new Map(),
        thresholdFreq: new Map(),
      };
      grouped.set(rawVal, bucket);
    }

    bucket.count += 1;
    if (rec.dateTime > bucket.lastDateTime) {
      bucket.lastDateTime = rec.dateTime;
    }
    if (channelVal) {
      bucket.channelFreq.set(channelVal, (bucket.channelFreq.get(channelVal) || 0) + 1);
    }
    if (companionVal && companionVal !== '无消费事项') {
      bucket.companionFreq.set(
        companionVal,
        (bucket.companionFreq.get(companionVal) || 0) + 1
      );
    }
    if (thresholdVal && thresholdVal !== '无门槛') {
      bucket.thresholdFreq.set(
        thresholdVal,
        (bucket.thresholdFreq.get(thresholdVal) || 0) + 1
      );
    }
  }

  return Array.from(grouped.values())
    .map((b) => ({
      value: b.value,
      count: b.count,
      lastDateTime: b.lastDateTime,
      topChannel: pickTopKey(b.channelFreq),
      topCompanion: pickTopKey(b.companionFreq),
      topThreshold: pickTopKey(b.thresholdFreq, '无门槛'),
      channels: new Set(b.channelFreq.keys()),
      companions: new Set(b.companionFreq.keys()),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastDateTime.localeCompare(a.lastDateTime);
    });
}

function filterAndRankSuggestions(
  items: HistorySuggestion[],
  query: string,
  preferredChannel: string,
  preferredCompanion: string
): HistorySuggestion[] {
  const trimmed = query.trim().toLowerCase();
  const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const normChannel = preferredChannel.trim();
  const normCompanion = preferredCompanion.trim();

  const scored: { item: HistorySuggestion; score: number }[] = [];

  for (const item of items) {
    const lower = item.value.toLowerCase();
    if (tokens.length > 0 && !tokens.every((t) => lower.includes(t))) {
      continue;
    }

    let score = item.count * 2;
    if (trimmed) {
      if (lower === trimmed) score += 1000;
      else if (lower.startsWith(trimmed)) score += 300;
      else score += 100;
    }
    if (normCompanion && item.companions.has(normCompanion)) {
      score += 80;
    }
    if (normChannel && item.channels.has(normChannel)) {
      score += 40;
    }

    scored.push({ item, score });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.lastDateTime.localeCompare(a.item.lastDateTime);
    })
    .slice(0, 8)
    .map((s) => s.item);
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const tokens = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return text;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'ig');
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    const isMatch = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
    return isMatch ? (
      <span key={idx} className="text-emerald-700 font-semibold">
        {part}
      </span>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    );
  });
}

export const EntryFormModal: React.FC<EntryFormModalProps> = ({
  isOpen,
  editingRecord,
  existingRecords,
  onClose,
  onSave,
}) => {
  const [dateTimeInput, setDateTimeInput] = useState(getNowLocalFormatted());
  const [platformChannel, setPlatformChannel] = useState('支付宝');
  const [expenseItem, setExpenseItem] = useState('');
  const [activityItem, setActivityItem] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [threshold, setThreshold] = useState('无门槛');
  const [notes, setNotes] = useState('');
  const [sourceType, setSourceType] = useState<EntrySourceType>('manual_adhoc');
  const [externalTaskKey, setExternalTaskKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Autocomplete dropdown state
  const [openDropdown, setOpenDropdown] = useState<'activity' | 'expense' | null>(
    null
  );
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const activityBoxRef = useRef<HTMLDivElement>(null);
  const expenseBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setOpenDropdown(null);
    setHighlightedIdx(-1);
    if (editingRecord) {
      setDateTimeInput(editingRecord.dateTime.replace(' ', 'T').slice(0, 16));
      setPlatformChannel(editingRecord.platformChannel);
      setExpenseItem(
        editingRecord.expenseItem === '无消费事项' ? '' : editingRecord.expenseItem
      );
      setActivityItem(editingRecord.activityItem);
      setRewardAmount(String(editingRecord.rewardAmount));
      setThreshold(editingRecord.threshold);
      setNotes(editingRecord.notes);
      setSourceType(editingRecord.sourceType);
      setExternalTaskKey(editingRecord.externalTaskKey || '');
      setShowAdvanced(
        Boolean(
          editingRecord.notes.trim() ||
            (editingRecord.threshold.trim() &&
              editingRecord.threshold.trim() !== '无门槛') ||
            editingRecord.sourceType !== 'manual_adhoc'
        )
      );
    } else {
      setDateTimeInput(getNowLocalFormatted());
      setPlatformChannel('支付宝');
      setExpenseItem('');
      setActivityItem('');
      setRewardAmount('');
      setThreshold('无门槛');
      setNotes('');
      setSourceType('manual_adhoc');
      setExternalTaskKey('');
      setShowAdvanced(false);
    }
  }, [isOpen, editingRecord]);

  // Close suggestion dropdown when tapping outside
  useEffect(() => {
    if (!openDropdown) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inActivity = activityBoxRef.current?.contains(target);
      const inExpense = expenseBoxRef.current?.contains(target);
      if (!inActivity && !inExpense) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openDropdown]);

  // Merge frequently used user channels with defaults for 1-tap selection
  const channelPresets = useMemo(() => {
    const freq = new Map<string, number>();
    for (const r of existingRecords) {
      const ch = r.platformChannel?.trim();
      if (ch) freq.set(ch, (freq.get(ch) || 0) + 1);
    }
    const usedSorted = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ch]) => ch);

    const merged: string[] = [];
    for (const ch of [...usedSorted, ...DEFAULT_CHANNEL_PRESETS]) {
      if (!merged.includes(ch)) merged.push(ch);
      if (merged.length >= 9) break;
    }
    return merged;
  }, [existingRecords]);

  const allActivitySuggestions = useMemo(
    () => buildFieldSuggestions(existingRecords, 'activityItem'),
    [existingRecords]
  );

  const allExpenseSuggestions = useMemo(
    () => buildFieldSuggestions(existingRecords, 'expenseItem'),
    [existingRecords]
  );

  const matchedActivitySuggestions = useMemo(
    () =>
      filterAndRankSuggestions(
        allActivitySuggestions,
        activityItem,
        platformChannel,
        expenseItem
      ),
    [allActivitySuggestions, activityItem, platformChannel, expenseItem]
  );

  const matchedExpenseSuggestions = useMemo(
    () =>
      filterAndRankSuggestions(
        allExpenseSuggestions,
        expenseItem,
        platformChannel,
        activityItem
      ),
    [allExpenseSuggestions, expenseItem, platformChannel, activityItem]
  );

  if (!isOpen) return null;

  const normalizedDateTime = dateTimeInput.replace('T', ' ').slice(0, 16);
  const numericAmount = Number(rewardAmount);
  const resolvedActivity = activityItem.trim() || '零星收益';
  const resolvedExpense = expenseItem.trim() || '无消费事项';

  const candidateKey =
    normalizedDateTime && Number.isFinite(numericAmount) && numericAmount > 0
      ? computeDedupeKey({
          dateTime: normalizedDateTime,
          platformChannel,
          expenseItem: resolvedExpense,
          activityItem: resolvedActivity,
          rewardAmount: numericAmount,
          externalTaskKey: externalTaskKey || undefined,
        })
      : '';

  const isDuplicateWarning =
    Boolean(candidateKey) &&
    existingRecords.some(
      (r) => r.dedupeKey === candidateKey && r.id !== editingRecord?.id
    );

  const selectActivitySuggestion = (s: HistorySuggestion) => {
    setActivityItem(s.value);
    if (threshold.trim() === '' || threshold.trim() === '无门槛') {
      if (s.topThreshold && s.topThreshold !== '无门槛') {
        setThreshold(s.topThreshold);
      }
    }
    setOpenDropdown(null);
    setHighlightedIdx(-1);
  };

  const selectExpenseSuggestion = (s: HistorySuggestion) => {
    setExpenseItem(s.value);
    setOpenDropdown(null);
    setHighlightedIdx(-1);
  };

  const handleFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    kind: 'activity' | 'expense',
    list: HistorySuggestion[]
  ) => {
    if (e.key === 'Escape') {
      setOpenDropdown(null);
      setHighlightedIdx(-1);
      return;
    }
    if (openDropdown !== kind || list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % list.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev <= 0 ? list.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightedIdx >= 0 && list[highlightedIdx]) {
      e.preventDefault();
      if (kind === 'activity') {
        selectActivitySuggestion(list[highlightedIdx]);
      } else {
        selectExpenseSuggestion(list[highlightedIdx]);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedDateTime) {
      setErrorMsg('请选择有效的日期时间');
      return;
    }
    if (!platformChannel.trim()) {
      setErrorMsg('请填写支付平台渠道');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('请输入大于 0 的收益金额');
      return;
    }

    onSave(
      {
        dateTime: normalizedDateTime,
        platformChannel: platformChannel.trim(),
        expenseItem: resolvedExpense,
        activityItem: resolvedActivity,
        rewardAmount: Math.round(numericAmount * 100) / 100,
        threshold: threshold.trim() || '无门槛',
        notes: notes.trim(),
        sourceType,
        externalTaskKey: externalTaskKey.trim() || undefined,
      },
      editingRecord?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 shrink-0" />

        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3
              id="entry-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {editingRecord ? '编辑收益记录' : '新增零星收益'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              只需填写金额并点选渠道/既往事项即可快速记账，其余字段可选填
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto ledger-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                收益金额 (元) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                placeholder="例如 12.50"
                required
                className="w-full px-3 py-2.5 text-sm font-mono-num bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                日期时间 <span className="text-rose-600">*</span>
              </label>
              <input
                type="datetime-local"
                value={dateTimeInput}
                onChange={(e) => setDateTimeInput(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm font-mono-num bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              支付平台渠道 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={platformChannel}
              onChange={(e) => setPlatformChannel(e.target.value)}
              placeholder="输入或点击下方常用渠道"
              required
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {channelPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPlatformChannel(preset)}
                  className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                    platformChannel === preset
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Item with Partial-Word History Autocomplete */}
          <div ref={activityBoxRef} className="relative">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                活动事项
              </label>
              <span className="text-[11px] text-slate-400">
                支持既往匹配 · 留空记为“零星收益”
              </span>
            </div>
            <input
              type="text"
              value={activityItem}
              onFocus={() => {
                setOpenDropdown('activity');
                setHighlightedIdx(-1);
              }}
              onChange={(e) => {
                setActivityItem(e.target.value);
                setOpenDropdown('activity');
                setHighlightedIdx(-1);
              }}
              onKeyDown={(e) =>
                handleFieldKeyDown(e, 'activity', matchedActivitySuggestions)
              }
              placeholder="输入词语检索既往活动，或直接点选推荐"
              autoComplete="off"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />

            {openDropdown === 'activity' && matchedActivitySuggestions.length > 0 && (
              <div
                role="listbox"
                aria-label="既往活动事项可选项"
                className="mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 ledger-scroll z-20"
              >
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <History className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    <span>
                      {activityItem.trim()
                        ? '匹配既往活动事项（点击补全一致命名）'
                        : '常用既往活动事项（点击直接选用）'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpenDropdown(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    收起
                  </button>
                </div>
                {matchedActivitySuggestions.map((s, idx) => (
                  <button
                    key={s.value}
                    type="button"
                    role="option"
                    aria-selected={highlightedIdx === idx}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectActivitySuggestion(s)}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] transition-colors cursor-pointer ${
                      highlightedIdx === idx
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm text-slate-900">
                      <span className="truncate font-medium">
                        {renderHighlightedText(s.value, activityItem)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono-num shrink-0">
                        已记 {s.count} 次
                      </span>
                    </div>
                    {(s.topChannel || s.topCompanion || s.topThreshold !== '无门槛') && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {[
                          s.topChannel,
                          s.topCompanion,
                          s.topThreshold !== '无门槛' ? s.topThreshold : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expense Item with Partial-Word History Autocomplete */}
          <div ref={expenseBoxRef} className="relative">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                消费事项（选填）
              </label>
              <span className="text-[11px] text-slate-400">
                支持既往匹配 · 留空记为“无消费事项”
              </span>
            </div>
            <input
              type="text"
              value={expenseItem}
              onFocus={() => {
                setOpenDropdown('expense');
                setHighlightedIdx(-1);
              }}
              onChange={(e) => {
                setExpenseItem(e.target.value);
                setOpenDropdown('expense');
                setHighlightedIdx(-1);
              }}
              onKeyDown={(e) =>
                handleFieldKeyDown(e, 'expense', matchedExpenseSuggestions)
              }
              placeholder="输入词语匹配既往消费事项（如：咖啡、加油、外卖）"
              autoComplete="off"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />

            {openDropdown === 'expense' && matchedExpenseSuggestions.length > 0 && (
              <div
                role="listbox"
                aria-label="既往消费事项可选项"
                className="mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100 ledger-scroll z-20"
              >
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <History className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    <span>
                      {expenseItem.trim()
                        ? '匹配既往消费事项（点击补全一致命名）'
                        : '常用既往消费事项（点击直接选用）'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpenDropdown(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    收起
                  </button>
                </div>
                {matchedExpenseSuggestions.map((s, idx) => (
                  <button
                    key={s.value}
                    type="button"
                    role="option"
                    aria-selected={highlightedIdx === idx}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectExpenseSuggestion(s)}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] transition-colors cursor-pointer ${
                      highlightedIdx === idx
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm text-slate-900">
                      <span className="truncate font-medium">
                        {renderHighlightedText(s.value, expenseItem)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono-num shrink-0">
                        已记 {s.count} 次
                      </span>
                    </div>
                    {(s.topChannel || s.topCompanion) && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {[s.topChannel, s.topCompanion].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Optional Fields (Lazy Mode keeps extra clutter hidden by default) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 py-1 cursor-pointer"
            >
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {showAdvanced
                  ? '收起可选项（门槛 / 来源 / 备注）'
                  : '展开可选项（门槛条件、来源分类、其他备注）'}
              </span>
              {!showAdvanced && (threshold !== '无门槛' || notes.trim()) && (
                <span className="text-emerald-700 font-normal">· 已填</span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      门槛条件
                    </label>
                    <input
                      type="text"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      placeholder="例如：满20元可用 / 无门槛"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      来源分类
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as EntrySourceType)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    >
                      <option value="manual_adhoc">非周期零星自录</option>
                      <option value="periodic_import">周期任务补充</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    其他备注
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="补充卡号尾号、核销说明、叠加优惠情况等（选填）"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {isDuplicateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              提示：账本中已存在时间、渠道、事项与金额完全一致的记录，保存后可能产生相似流水，请确认是否为同一笔。
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <div className="pt-3 pb-[env(safe-area-inset-bottom)] flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              {editingRecord ? '保存修改' : '确认录入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
