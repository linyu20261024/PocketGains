import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  EarningRecord,
  EntrySourceType,
  SortDirection,
  SortField,
} from '../types/earnings';
import { formatCurrency } from '../utils/analytics';
import {
  downloadPeriodicTemplate,
  exportToCsv,
  exportToExcel,
  exportToJson,
} from '../utils/excel';

interface EarningsTableProps {
  records: EarningRecord[];
  allChannels: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sourceFilter: 'all' | EntrySourceType;
  onSourceFilterChange: (s: 'all' | EntrySourceType) => void;
  channelFilter: string;
  onChannelFilterChange: (ch: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onEditRecord: (record: EarningRecord) => void;
  onDeleteRecord: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
}

export const EarningsTable: React.FC<EarningsTableProps> = ({
  records,
  allChannels,
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  channelFilter,
  onChannelFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  onEditRecord,
  onDeleteRecord,
  onOpenAddModal,
  onOpenImportModal,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredTotal = records.reduce((sum, r) => sum + r.rewardAmount, 0);
  const displayedRecords = records.slice(0, visibleLimit);

  const toggleTimeSort = () => {
    if (sortField === 'dateTime') {
      onSortChange('dateTime', sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange('dateTime', 'desc');
    }
  };

  const toggleAmountSort = () => {
    if (sortField === 'rewardAmount') {
      onSortChange('rewardAmount', sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange('rewardAmount', 'desc');
    }
  };

  return (
    <section
      id="ledger"
      aria-label="收益明细台账"
      className="scroll-mt-16 bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              零散收益明细台账
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              默认按时间倒序排列（最新时间优先），支持周期导入与非周期零星筛选
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>导入周期任务</span>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                aria-expanded={exportMenuOpen}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>导出</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      exportToExcel(records);
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    <span>导出 Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportToCsv(records);
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>导出 CSV (UTF-8)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportToJson(records);
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>导出 JSON 完整备份</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      downloadPeriodicTemplate();
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>下载周期任务导入模板</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>手工录入</span>
            </button>
          </div>
        </div>

        {/* Filter & Sort Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="搜索活动、消费、渠道或备注..."
                aria-label="搜索收益记录"
                className="w-full pl-8 pr-3 py-2 min-h-[38px] text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Source Type Segmented Filter */}
              <div
                role="group"
                aria-label="来源类型筛选"
                className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              >
                {[
                  { value: 'all', label: '全部' },
                  { value: 'periodic_import', label: '周期导入' },
                  { value: 'manual_adhoc', label: '零星自录' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onSourceFilterChange(opt.value as 'all' | EntrySourceType)
                    }
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      sourceFilter === opt.value
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Channel Select */}
              <select
                value={channelFilter}
                onChange={(e) => onChannelFilterChange(e.target.value)}
                aria-label="按支付平台渠道筛选"
                className="px-2.5 py-1.5 min-h-[36px] text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="all">全部渠道</option>
                {allChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTimeSort}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sortField === 'dateTime'
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sortField === 'dateTime' && sortDirection === 'asc' ? (
                <ArrowUpNarrowWide className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                时间{sortField === 'dateTime' ? (sortDirection === 'desc' ? '倒序' : '升序') : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleAmountSort}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sortField === 'rewardAmount'
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sortField === 'rewardAmount' && sortDirection === 'asc' ? (
                <ArrowUpNarrowWide className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                金额{sortField === 'rewardAmount' ? (sortDirection === 'desc' ? '从高到低' : '从低到高') : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {records.length === 0 ? (
        <div className="py-14 px-5 text-center">
          <p className="text-sm font-medium text-slate-800">暂无匹配的收益明细</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            您可以导入周期任务导出的 JSON / Excel 文件自动提取收益，或手动录入非周期零星收益。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-4 py-2.5 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              导入周期任务文件
            </button>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2.5 min-h-[40px] text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              新增零星收益
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card List (< md) - Zero horizontal table dragging */}
          <div className="md:hidden divide-y divide-slate-100">
            {displayedRecords.map((rec) => {
              const isDeleting = confirmDeleteId === rec.id;
              return (
                <article key={rec.id} className="p-4 space-y-2 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug break-words">
                        {rec.activityItem}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {rec.platformChannel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {rec.sourceType === 'periodic_import'
                            ? '周期任务'
                            : '零星自录'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{rec.dateTime}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono-num text-base font-semibold text-emerald-700">
                      +{formatCurrency(rec.rewardAmount)}
                    </div>
                  </div>

                  {/* Secondary Fields */}
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>消费：{rec.expenseItem}</span>
                      <span className="text-slate-400">·</span>
                      <span>门槛：{rec.threshold}</span>
                    </div>
                    {rec.notes && (
                      <div className="text-slate-500 leading-relaxed break-words">
                        备注：{rec.notes}
                      </div>
                    )}
                  </div>

                  {/* Mobile Action Row */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 font-mono-num truncate">
                      {rec.externalTaskKey ? `ID: ${rec.externalTaskKey}` : ''}
                    </div>

                    {isDeleting ? (
                      <div className="inline-flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRecord(rec.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 min-h-[36px] text-xs text-slate-600 hover:text-slate-900 rounded-md border border-slate-200 cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditRecord(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>编辑</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rec.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>删除</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop Dense Ledger Table (>= md) */}
          <div className="hidden md:block overflow-x-auto ledger-scroll">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">日期时间</th>
                  <th className="py-3 px-3 whitespace-nowrap">支付平台渠道</th>
                  <th className="py-3 px-3 whitespace-nowrap">活动事项</th>
                  <th className="py-3 px-3 whitespace-nowrap">消费事项</th>
                  <th className="py-3 px-3 whitespace-nowrap">门槛</th>
                  <th className="py-3 px-3 whitespace-nowrap text-right">收益金额</th>
                  <th className="py-3 px-3 whitespace-nowrap">其他备注</th>
                  <th className="py-3 pl-3 pr-5 whitespace-nowrap text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedRecords.map((rec) => {
                  const isDeleting = confirmDeleteId === rec.id;
                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 pl-5 pr-3 whitespace-nowrap font-mono-num text-xs text-slate-700 align-top">
                        {rec.dateTime}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        <div className="text-xs font-medium text-slate-900">
                          {rec.platformChannel}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {rec.sourceType === 'periodic_import'
                            ? '周期任务导入'
                            : '非周期零星'}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top max-w-[230px]">
                        <div className="text-xs font-medium text-slate-900 leading-snug">
                          {rec.activityItem}
                        </div>
                        {rec.externalTaskKey && (
                          <div className="text-[11px] text-slate-400 font-mono-num mt-0.5 truncate">
                            ID: {rec.externalTaskKey}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top max-w-[180px] text-xs text-slate-700 leading-snug">
                        {rec.expenseItem}
                      </td>
                      <td className="py-3 px-3 align-top max-w-[160px] text-xs text-slate-600 leading-snug">
                        {rec.threshold}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right align-top font-mono-num text-sm font-semibold text-emerald-700">
                        +{formatCurrency(rec.rewardAmount)}
                      </td>
                      <td
                        className="py-3 px-3 align-top max-w-[200px] text-xs text-slate-500 leading-snug truncate"
                        title={rec.notes || undefined}
                      >
                        {rec.notes || '—'}
                      </td>
                      <td className="py-3 pl-3 pr-5 whitespace-nowrap text-right align-top">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteRecord(rec.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                            >
                              确认
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditRecord(rec)}
                              aria-label={`编辑 ${rec.activityItem}`}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              aria-label={`删除 ${rec.activityItem}`}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-mono-num">
              <span>当前筛选共 {records.length} 笔</span>
              <span aria-hidden="true">·</span>
              <span>
                小计{' '}
                <strong className="text-emerald-700 font-semibold">
                  {formatCurrency(filteredTotal)}
                </strong>
              </span>
            </div>

            {records.length > visibleLimit && (
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 50)}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 min-h-[36px] px-2 cursor-pointer"
              >
                加载更多（剩余 {records.length - visibleLimit} 笔）
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
};
