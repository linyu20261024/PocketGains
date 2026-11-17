import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { EarningInput, EarningRecord, EntrySourceType } from '../types/earnings';
import { computeDedupeKey } from '../utils/dedupe';

interface EntryFormModalProps {
  isOpen: boolean;
  editingRecord: EarningRecord | null;
  existingRecords: EarningRecord[];
  onClose: () => void;
  onSave: (input: EarningInput, editId?: string) => void;
}

const CHANNEL_PRESETS = [
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
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (editingRecord) {
      setDateTimeInput(editingRecord.dateTime.replace(' ', 'T').slice(0, 16));
      setPlatformChannel(editingRecord.platformChannel);
      setExpenseItem(editingRecord.expenseItem);
      setActivityItem(editingRecord.activityItem);
      setRewardAmount(String(editingRecord.rewardAmount));
      setThreshold(editingRecord.threshold);
      setNotes(editingRecord.notes);
      setSourceType(editingRecord.sourceType);
      setExternalTaskKey(editingRecord.externalTaskKey || '');
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
    }
  }, [isOpen, editingRecord]);

  if (!isOpen) return null;

  const normalizedDateTime = dateTimeInput.replace('T', ' ').slice(0, 16);
  const numericAmount = Number(rewardAmount);

  const candidateKey =
    normalizedDateTime && Number.isFinite(numericAmount) && numericAmount > 0
      ? computeDedupeKey({
          dateTime: normalizedDateTime,
          platformChannel,
          expenseItem: expenseItem || '无消费事项',
          activityItem: activityItem || '零星收益',
          rewardAmount: numericAmount,
          externalTaskKey: externalTaskKey || undefined,
        })
      : '';

  const isDuplicateWarning =
    Boolean(candidateKey) &&
    existingRecords.some(
      (r) => r.dedupeKey === candidateKey && r.id !== editingRecord?.id
    );

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
    if (!activityItem.trim()) {
      setErrorMsg('请填写活动事项');
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
        expenseItem: expenseItem.trim() || '无消费事项',
        activityItem: activityItem.trim(),
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
              {editingRecord ? '编辑收益记录' : '新增非周期零星收益'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              用于临时立减、红包返现等非周期任务收益的自维护录入
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
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              支付平台渠道 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={platformChannel}
              onChange={(e) => setPlatformChannel(e.target.value)}
              placeholder="输入或选择支付渠道"
              required
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHANNEL_PRESETS.map((preset) => (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                活动事项 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={activityItem}
                onChange={(e) => setActivityItem(e.target.value)}
                placeholder="例如：周五随机立减金 / 签到红包"
                required
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                消费事项
              </label>
              <input
                type="text"
                value={expenseItem}
                onChange={(e) => setExpenseItem(e.target.value)}
                placeholder="例如：瑞幸咖啡 / 无消费纯领奖"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

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
              placeholder="补充卡号尾号、核销说明、叠加优惠情况等"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 resize-none"
            />
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
