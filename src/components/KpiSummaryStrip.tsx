import React from 'react';
import { formatCurrency, KpiMetrics } from '../utils/analytics';

interface KpiSummaryStripProps {
  metrics: KpiMetrics;
  latestDateTime: string | null;
}

export const KpiSummaryStrip: React.FC<KpiSummaryStripProps> = ({
  metrics,
  latestDateTime,
}) => {
  return (
    <section
      id="overview"
      aria-label="收益核心指标"
      className="scroll-mt-16 bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Cumulative Total */}
        <div className="p-3.5 sm:p-6 border-b lg:border-b-0 border-r border-slate-200">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">
            累计总收益
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num truncate">
            {formatCurrency(metrics.totalCumulative)}
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 font-mono-num">
            <span>{metrics.recordCount} 笔</span>
            <span aria-hidden="true">·</span>
            <span>均 {formatCurrency(metrics.avgReward)}</span>
          </div>
        </div>

        {/* Metric 2: Yearly Total */}
        <div className="p-3.5 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">
            {metrics.referenceYear} 年度收益
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num truncate">
            {formatCurrency(metrics.currentYearAmount)}
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 font-mono-num">
            <span>周期 {metrics.periodicCount}</span>
            <span aria-hidden="true">·</span>
            <span>零星 {metrics.adhocCount}</span>
          </div>
        </div>

        {/* Metric 3: Monthly Total */}
        <div className="p-3.5 sm:p-6 border-r border-slate-200">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
            本月（{metrics.referenceMonth}）
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-emerald-700 font-mono-num truncate">
            {formatCurrency(metrics.currentMonthAmount)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-slate-500">
            占比{' '}
            <span className="font-mono-num text-slate-700 font-medium">
              {metrics.totalCumulative > 0
                ? `${((metrics.currentMonthAmount / metrics.totalCumulative) * 100).toFixed(1)}%`
                : '0.0%'}
            </span>
          </div>
        </div>

        {/* Metric 4: Today Total */}
        <div className="p-3.5 sm:p-6">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
            今日（{metrics.referenceDate.slice(5)}）
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num truncate">
            {formatCurrency(metrics.todayAmount)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-slate-500 truncate">
            最近：
            <span className="font-mono-num text-slate-700">
              {latestDateTime ? latestDateTime.slice(5) : '暂无'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
