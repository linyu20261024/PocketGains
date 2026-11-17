import React from 'react';
import { Plus } from 'lucide-react';

interface HeaderBarProps {
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenAddModal,
  onOpenImportModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#overview"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 rounded"
        >
          拾零账本
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <a
            href="#overview"
            className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            收益总览
          </a>
          <a
            href="#charts"
            className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            统计图表
          </a>
          <a
            href="#ledger"
            className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            收益明细
          </a>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            周期任务导入
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>新增零星收益</span>
          </button>
        </div>
      </div>
    </header>
  );
};
