import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { EarningsChartPanel } from './components/EarningsChartPanel';
import { EarningsTable } from './components/EarningsTable';
import { EntryFormModal } from './components/EntryFormModal';
import { HeaderBar } from './components/HeaderBar';
import { ImportWizardModal } from './components/ImportWizardModal';
import { KpiSummaryStrip } from './components/KpiSummaryStrip';
import {
  EarningInput,
  EarningRecord,
  EntrySourceType,
  SortDirection,
  SortField,
} from './types/earnings';
import { computeKpiMetrics, sortRecords } from './utils/analytics';
import { buildEarningRecord, computeDedupeKey } from './utils/dedupe';
import {
  loadStoredRecords,
  restoreSampleRecords,
  saveStoredRecords,
} from './utils/storage';

type DateRangePreset = 'all' | '30d' | '90d' | 'ytd';

export default function App() {
  const [records, setRecords] = useState<EarningRecord[]>(() =>
    loadStoredRecords()
  );

  // Filters & Sorting (default: dateTime descending - newest first)
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | EntrySourceType>('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [sortField, setSortField] = useState<SortField>('dateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EarningRecord | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Feedback banner & clear confirmation
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    saveStoredRecords(records);
  }, [records]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const kpiMetrics = useMemo(() => computeKpiMetrics(records), [records]);

  const latestDateTime = useMemo(() => {
    if (records.length === 0) return null;
    const newest = sortRecords(records, 'dateTime', 'desc')[0];
    return newest?.dateTime ?? null;
  }, [records]);

  const allChannels = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.platformChannel) set.add(r.platformChannel);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [records]);

  const filteredAndSortedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const yearPrefix = `${now.getFullYear()}-`;

    let cutoffDateStr = '';
    if (dateRangePreset === '30d' || dateRangePreset === '90d') {
      const days = dateRangePreset === '30d' ? 30 : 90;
      const d = new Date(now.getTime() - days * 86400000);
      cutoffDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    const filtered = records.filter((rec) => {
      if (sourceFilter !== 'all' && rec.sourceType !== sourceFilter) return false;
      if (channelFilter !== 'all' && rec.platformChannel !== channelFilter) return false;

      const dateOnly = rec.dateTime.slice(0, 10);
      if (dateRangePreset === 'ytd' && !dateOnly.startsWith(yearPrefix)) {
        return false;
      }
      if (cutoffDateStr && dateOnly < cutoffDateStr) {
        return false;
      }

      if (q) {
        const haystack = [
          rec.dateTime,
          rec.platformChannel,
          rec.activityItem,
          rec.expenseItem,
          rec.threshold,
          rec.notes,
          rec.externalTaskKey || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return sortRecords(filtered, sortField, sortDirection);
  }, [
    records,
    searchQuery,
    sourceFilter,
    channelFilter,
    dateRangePreset,
    sortField,
    sortDirection,
  ]);

  const handleSaveEntry = (input: EarningInput, editId?: string) => {
    if (editId) {
      setRecords((prev) =>
        prev.map((item) => {
          if (item.id !== editId) return item;
          const updated: EarningRecord = {
            ...item,
            ...input,
            dedupeKey: computeDedupeKey(input),
          };
          return updated;
        })
      );
      setNotice(`已更新收益记录「${input.activityItem}」`);
    } else {
      const newRec = buildEarningRecord(input);
      setRecords((prev) => [newRec, ...prev]);
      setNotice(`已新增零星收益「${newRec.activityItem}」(+¥${newRec.rewardAmount.toFixed(2)})`);
    }
    setEditingRecord(null);
  };

  const handleDeleteEntry = (id: string) => {
    const target = records.find((r) => r.id === id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (target) {
      setNotice(`已删除记录「${target.activityItem}」`);
    }
  };

  const handleConfirmImport = (
    newItems: { input: EarningInput; dedupeKey: string }[]
  ) => {
    setRecords((prev) => {
      const existingKeys = new Set(prev.map((r) => r.dedupeKey));
      const toInsert: EarningRecord[] = [];
      for (const item of newItems) {
        if (!existingKeys.has(item.dedupeKey)) {
          existingKeys.add(item.dedupeKey);
          toInsert.push(buildEarningRecord(item.input, item.dedupeKey));
        }
      }
      if (toInsert.length > 0) {
        setNotice(`已成功提取并导入 ${toInsert.length} 笔新收益，重复记录已自动跳过`);
      }
      return [...toInsert, ...prev];
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setChannelFilter('all');
    setDateRangePreset('all');
  };

  const hasActiveFilter =
    Boolean(searchQuery) ||
    sourceFilter !== 'all' ||
    channelFilter !== 'all' ||
    dateRangePreset !== 'all';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 md:pb-0">
      <HeaderBar
        onOpenAddModal={() => {
          setEditingRecord(null);
          setIsAddModalOpen(true);
        }}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Workspace Context & Global Period Strip */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
              零散收益统计中心
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
              汇集周期任务提取收益与非周期零星自录流水，本地存储并支持去重导入导出
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Date Range Filter */}
            <div
              role="group"
              aria-label="时间范围筛选"
              className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-lg"
            >
              {[
                { value: 'all', label: '全部' },
                { value: '30d', label: '近30天' },
                { value: '90d', label: '近90天' },
                { value: 'ytd', label: '今年' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDateRangePreset(opt.value as DateRangePreset)
                  }
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dateRangePreset === opt.value
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>导入周期任务</span>
            </button>
          </div>
        </div>

        {/* Transient Action Feedback */}
        {notice && (
          <div
            role="status"
            className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3 text-xs text-emerald-900"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="关闭提示"
              className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Active Filter Indicator */}
        {hasActiveFilter && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
            <div>
              当前图表与明细已启用筛选条件（匹配{' '}
              <span className="font-mono-num font-semibold text-slate-900">
                {filteredAndSortedRecords.length}
              </span>{' '}
              / {records.length} 笔）
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
            >
              重置全部筛选
            </button>
          </div>
        )}

        {/* KPI Summary */}
        <KpiSummaryStrip
          metrics={kpiMetrics}
          latestDateTime={latestDateTime}
        />

        {/* Interactive Charts & Channel Distribution */}
        <EarningsChartPanel
          records={filteredAndSortedRecords}
          selectedChannel={channelFilter}
          onSelectChannel={setChannelFilter}
        />

        {/* Detailed Earnings Ledger Table */}
        <EarningsTable
          records={filteredAndSortedRecords}
          allChannels={allChannels}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, dir) => {
            setSortField(field);
            setSortDirection(dir);
          }}
          onEditRecord={(rec) => {
            setEditingRecord(rec);
            setIsAddModalOpen(true);
          }}
          onDeleteRecord={handleDeleteEntry}
          onOpenAddModal={() => {
            setEditingRecord(null);
            setIsAddModalOpen(true);
          }}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />
      </main>

      {/* Quiet Maintenance Footer */}
      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            拾零账本 · 数据保存于当前浏览器本地存储，支持随时导出 Excel / CSV / JSON 备份
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                const restored = restoreSampleRecords();
                setRecords(restored);
                setNotice(`已重置并载入 ${restored.length} 笔示例收益数据`);
              }}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>恢复示例数据</span>
            </button>

            {confirmClearAll ? (
              <div className="inline-flex items-center gap-2">
                <span className="text-rose-600">确认清空全部本地记录？</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecords([]);
                    setConfirmClearAll(false);
                    setNotice('已清空本地全部收益记录');
                  }}
                  className="text-rose-700 font-semibold hover:underline cursor-pointer"
                >
                  确认清空
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>清空台账</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <EntryFormModal
        isOpen={isAddModalOpen}
        editingRecord={editingRecord}
        existingRecords={records}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveEntry}
      />

      <ImportWizardModal
        isOpen={isImportModalOpen}
        existingRecords={records}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
}
