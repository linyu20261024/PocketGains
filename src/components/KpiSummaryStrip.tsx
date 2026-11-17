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
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* Metric 1: Cumulative Total */}
        <div className="p-5 sm:p-6">
          <div className="text-xs font-medium text-slate-500">累计总收益</div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num">
            {formatCurrency(metrics.totalCumulative)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono-num">
            <span>共 {metrics.recordCount} 笔</span>
            <span aria-hidden="true">·</span>
            <span>均笔 {formatCurrency(metrics.avgReward)}</span>
          </div>
        </div>

        {/* Metric 2: Yearly Total */}
        <div className="p-5 sm:p-6">
          <div className="text-xs font-medium text-slate-500">
            {metrics.referenceYear} 年度收益
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num">
            {formatCurrency(metrics.currentYearAmount)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-mono-num">
            <span>周期导入 {metrics.periodicCount} 笔</span>
            <span aria-hidden="true">·</span>
            <span>零星自录 {metrics.adhocCount} 笔</span>
          </div>
        </div>

        {/* Metric 3: Monthly Total */}
        <div className="p-5 sm:p-6">
          <div className="text-xs font-medium text-slate-500">
            本月收益（{metrics.referenceMonth}）
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-700 font-mono-num">
            {formatCurrency(metrics.currentMonthAmount)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            占总收益{' '}
            <span className="font-mono-num text-slate-700 font-medium">
              {metrics.totalCumulative > 0
                ? `${((metrics.currentMonthAmount / metrics.totalCumulative) * 100).toFixed(1)}%`
                : '0.0%'}
            </span>
          </div>
        </div>

        {/* Metric 4: Today Total */}
        <div className="p-5 sm:p-6">
          <div className="text-xs font-medium text-slate-500">
            今日收益（{metrics.referenceDate}）
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 font-mono-num">
            {formatCurrency(metrics.todayAmount)}
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            最近入账：
            <span className="font-mono-num text-slate-700">
              {latestDateTime || '暂无记录'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
