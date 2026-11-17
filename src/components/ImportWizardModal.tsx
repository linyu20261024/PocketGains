import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import {
  ColumnMapping,
  EarningInput,
  EarningRecord,
  EntrySourceType,
  ParsedImportPreview,
} from '../types/earnings';
import { formatCurrency } from '../utils/analytics';
import {
  downloadPeriodicTemplate,
  evaluateImportCandidates,
  inferColumnMapping,
  parseImportFile,
} from '../utils/excel';

interface ImportWizardModalProps {
  isOpen: boolean;
  existingRecords: EarningRecord[];
  onClose: () => void;
  onConfirmImport: (newItems: { input: EarningInput; dedupeKey: string }[]) => void;
}

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'dateTime', label: '日期时间', required: true },
  { key: 'rewardAmount', label: '收益金额', required: true },
  { key: 'platformChannel', label: '支付平台渠道' },
  { key: 'activityItem', label: '活动事项 / 任务名称' },
  { key: 'expenseItem', label: '消费事项' },
  { key: 'threshold', label: '门槛' },
  { key: 'notes', label: '其他备注' },
  { key: 'externalTaskKey', label: '任务ID / 唯一流水号' },
  { key: 'taskStatus', label: '任务状态（过滤未完成）' },
];

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  existingRecords,
  onClose,
  onConfirmImport,
}) => {
  const [importMode, setImportMode] = useState<EntrySourceType>('periodic_import');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedImportPreview | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  if (!isOpen) return null;

  const resetModal = () => {
    setSelectedFile(null);
    setPreview(null);
    setShowMapping(false);
    setParseError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const processFile = async (
    file: File,
    mode: EntrySourceType,
    sheetName?: string
  ) => {
    setIsParsing(true);
    setParseError('');
    try {
      const parsed = await parseImportFile(file, existingRecords, mode, sheetName);
      setSelectedFile(file);
      setPreview(parsed);
      if (!parsed.mapping.dateTime || !parsed.mapping.rewardAmount) {
        setShowMapping(true);
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? `文件解析失败：${err.message}` : '文件格式不受支持或内容损坏'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file, importMode);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file, importMode);
    }
  };

  const handleModeSwitch = (mode: EntrySourceType) => {
    setImportMode(mode);
    if (preview) {
      const { candidates, stats } = evaluateImportCandidates(
        preview.rawRows,
        preview.mapping,
        existingRecords,
        mode,
        preview.fileName
      );
      setPreview({ ...preview, candidates, stats });
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, colName: string) => {
    if (!preview) return;
    const nextMapping = { ...preview.mapping, [field]: colName };
    const { candidates, stats } = evaluateImportCandidates(
      preview.rawRows,
      nextMapping,
      existingRecords,
      importMode,
      preview.fileName
    );
    setPreview({
      ...preview,
      mapping: nextMapping,
      candidates,
      stats,
    });
  };

  const handleLoadSamplePeriodicBatch = () => {
    const sampleRaw: Record<string, unknown>[] = [
      {
        任务ID: 'CMB-W47-01',
        日期时间: '2026-11-16 18:30',
        支付平台渠道: '招商银行',
        消费事项: '山姆会员店采购',
        活动事项: '周末刷卡满额返现周期任务',
        收益金额: 30.0,
        门槛: '满300元达标',
        任务状态: '已完成',
        其他备注: '周期任务第47周示例导出，重复导入将被拦截',
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
        其他备注: '周期任务提取收益示例',
      },
      {
        任务ID: 'CMB-W46-01',
        日期时间: '2026-11-15 19:45',
        支付平台渠道: '招商银行',
        消费事项: '盒马鲜生生鲜采购',
        活动事项: '周六招行饭票满减返现',
        收益金额: 18.0,
        门槛: '消费满100元返现',
        任务状态: '已完成',
        其他备注: '故意包含一条与账本重合的历史任务以演示自动去重',
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
        其他备注: '未完成任务将自动跳过',
      },
    ];
    const headers = Object.keys(sampleRaw[0]);
    const mapping = inferColumnMapping(headers);
    const fileName = '示例周期任务导出_2026W47.xlsx';
    const { candidates, stats } = evaluateImportCandidates(
      sampleRaw,
      mapping,
      existingRecords,
      'periodic_import',
      fileName
    );
    setImportMode('periodic_import');
    setSelectedFile(null);
    setPreview({
      fileName,
      sheetNames: ['周期任务导出示例'],
      selectedSheet: '周期任务导出示例',
      headers,
      rawRows: sampleRaw,
      mapping,
      candidates,
      stats,
    });
  };

  const handleConfirm = () => {
    if (!preview) return;
    const newItems = preview.candidates
      .filter((c) => c.status === 'new')
      .map((c) => ({ input: c.record, dedupeKey: c.dedupeKey }));

    if (newItems.length > 0) {
      onConfirmImport(newItems);
    }
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3
              id="import-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              导入周期任务与外部收益数据
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              支持 Excel (.xlsx / .xls)、CSV 与 JSON 格式，自动提取有效收益并按指纹拦截重复数据
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭导入弹窗"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 ledger-scroll">
          {/* Import Mode + Template Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="导入数据类型"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => handleModeSwitch('periodic_import')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  importMode === 'periodic_import'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                周期任务数据提取
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('manual_adhoc')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  importMode === 'manual_adhoc'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                批量零星收益导入
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSamplePeriodicBatch}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
              >
                试用示例周期任务数据
              </button>
              <button
                type="button"
                onClick={downloadPeriodicTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>下载 Excel 导入模板</span>
              </button>
            </div>
          </div>

          {/* File Dropzone */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl p-6 text-center transition-colors cursor-pointer"
          >
            <Upload className="w-6 h-6 text-slate-400 mb-2" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-800">
              {isParsing
                ? '正在解析表格并校验去重指纹...'
                : preview
                  ? `已载入：${preview.fileName}（点击或拖拽替换文件）`
                  : '点击选择或拖拽周期任务导出文件至此'}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              兼容 .xlsx / .xls / .csv / .json；多次导入同一周期导出表不会产生重复收益
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="space-y-4">
              {/* Sheet selector + Column mapping toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {preview.sheetNames.length > 1 && selectedFile && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">工作表：</span>
                      <select
                        value={preview.selectedSheet}
                        onChange={(e) =>
                          void processFile(selectedFile, importMode, e.target.value)
                        }
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-800"
                      >
                        {preview.sheetNames.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowMapping((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>{showMapping ? '收起字段映射' : '调整字段映射'}</span>
                  </button>
                </div>

                {/* Dedupe Summary Strip */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono-num">
                  <span className="text-slate-600">
                    解析 {preview.stats.totalRows} 行
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    本次新增 {preview.stats.newCount} 笔 ({formatCurrency(preview.stats.newTotalAmount)})
                  </span>
                  <span className="text-amber-700">
                    重复拦截 {preview.stats.duplicateCount} 笔
                  </span>
                  <span className="text-slate-400">
                    跳过无效/未达标 {preview.stats.skippedCount} 笔
                  </span>
                </div>
              </div>

              {/* Optional Column Mapping Editor */}
              {showMapping && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MAPPING_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {field.label}
                        {field.required && <span className="text-rose-600"> *</span>}
                      </label>
                      <select
                        value={preview.mapping[field.key]}
                        onChange={(e) =>
                          handleMappingChange(field.key, e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800"
                      >
                        <option value="">（未匹配 / 留空）</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Candidate Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[280px] ledger-scroll">
                <table className="w-full text-left border-collapse min-w-[760px] text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 pl-4 pr-2">状态</th>
                      <th className="py-2.5 px-2">日期时间</th>
                      <th className="py-2.5 px-2">支付平台渠道</th>
                      <th className="py-2.5 px-2">活动事项</th>
                      <th className="py-2.5 px-2">消费事项</th>
                      <th className="py-2.5 px-2 text-right">收益金额</th>
                      <th className="py-2.5 pl-2 pr-4">说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.candidates.map((row) => {
                      const statusLabel =
                        row.status === 'new'
                          ? '提取新增'
                          : row.status === 'duplicate_existing' ||
                              row.status === 'duplicate_in_file'
                            ? '重复跳过'
                            : '已跳过';
                      const statusColor =
                        row.status === 'new'
                          ? 'text-emerald-700 font-semibold'
                          : row.status === 'duplicate_existing' ||
                              row.status === 'duplicate_in_file'
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-400';

                      return (
                        <tr
                          key={row.rowIndex}
                          className={row.status === 'new' ? 'bg-white' : 'bg-slate-50/60'}
                        >
                          <td className={`py-2 pl-4 pr-2 whitespace-nowrap ${statusColor}`}>
                            {statusLabel}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap font-mono-num text-slate-700">
                            {row.record.dateTime || '—'}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-800">
                            {row.record.platformChannel}
                          </td>
                          <td className="py-2 px-2 text-slate-800 max-w-[180px] truncate">
                            {row.record.activityItem}
                          </td>
                          <td className="py-2 px-2 text-slate-600 max-w-[140px] truncate">
                            {row.record.expenseItem}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-right font-mono-num font-medium text-slate-900">
                            {formatCurrency(row.record.rewardAmount)}
                          </td>
                          <td className="py-2 pl-2 pr-4 text-slate-500 max-w-[200px] truncate">
                            {row.skipReason || row.record.notes || '有效记录'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              去重机制已启用：基于任务ID/时间/渠道/事项/金额指纹校验，多次导入绝不重复入账
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!preview || preview.stats.newCount === 0}
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {preview
                ? `确认导入 ${preview.stats.newCount} 笔新收益`
                : '请先选择文件'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
