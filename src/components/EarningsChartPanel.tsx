import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import {
  ChannelBreakdownItem,
  ChartGranularity,
  EarningRecord,
  SortDirection,
} from '../types/earnings';
import {
  ActivityBreakdownItem,
  buildActivityBreakdown,
  buildChannelBreakdown,
  buildChartSeries,
  formatCurrency,
} from '../utils/analytics';

interface EarningsChartPanelProps {
  records: EarningRecord[];
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
  selectedActivity: string;
  onSelectActivity: (activity: string) => void;
}

const GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: 'daily', label: '每日' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
  { value: 'cumulative', label: '累计收入' },
];

export const EarningsChartPanel: React.FC<EarningsChartPanelProps> = ({
  records,
  selectedChannel,
  onSelectChannel,
  selectedActivity,
  onSelectActivity,
}) => {
  const [granularity, setGranularity] = useState<ChartGranularity>('monthly');
  // Default chart time axis is ascending (left -> right chronologically increasing)
  const [chartSort, setChartSort] = useState<SortDirection>('asc');
  const [showCumulativeOverlay, setShowCumulativeOverlay] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);

  const series = useMemo(
    () => buildChartSeries(records, granularity, chartSort),
    [records, granularity, chartSort]
  );

  // Keep the latest/current period immediately visible when switching Daily/Monthly/Yearly/Cumulative
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;
    const alignToLatest = () => {
      if (!chartScrollRef.current) return;
      if (chartSort === 'asc') {
        chartScrollRef.current.scrollLeft = Math.max(
          0,
          chartScrollRef.current.scrollWidth - chartScrollRef.current.clientWidth
        );
      } else {
        chartScrollRef.current.scrollLeft = 0;
      }
    };
    alignToLatest();
    const rafId = requestAnimationFrame(alignToLatest);
    return () => cancelAnimationFrame(rafId);
  }, [granularity, chartSort, series.length]);

  const channels: ChannelBreakdownItem[] = useMemo(
    () => buildChannelBreakdown(records),
    [records]
  );

  const activities: ActivityBreakdownItem[] = useMemo(
    () => buildActivityBreakdown(records),
    [records]
  );

  const totalAmount = useMemo(
    () => records.reduce((sum, r) => sum + r.rewardAmount, 0),
    [records]
  );

  // SVG Layout dimensions: scale naturally on mobile for <= 12 points; scroll to latest end when denser
  const needsHorizontalScroll = series.length > 12;
  const width = needsHorizontalScroll ? Math.max(680, series.length * 42) : 680;
  const height = 265;
  const padLeft = 56;
  const padRight = granularity !== 'cumulative' && showCumulativeOverlay ? 58 : 20;
  const padTop = 20;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxPeriod = Math.max(
    10,
    ...series.map((p) => (granularity === 'cumulative' ? p.cumulativeAmount : p.periodAmount))
  );
  const maxCumulative = Math.max(10, ...series.map((p) => p.cumulativeAmount));

  const ceilAxis = (val: number) => {
    if (val <= 10) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(val)));
    const norm = val / mag;
    if (norm <= 1.2) return 1.2 * mag;
    if (norm <= 1.5) return 1.5 * mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 3) return 3 * mag;
    if (norm <= 5) return 5 * mag;
    if (norm <= 8) return 8 * mag;
    return 10 * mag;
  };

  const yMaxPrimary = ceilAxis(maxPeriod);
  const yMaxCumulative = ceilAxis(maxCumulative);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const getX = (idx: number) => {
    if (series.length <= 1) return padLeft + plotW / 2;
    const step = plotW / series.length;
    return padLeft + step * idx + step / 2;
  };

  const getYPrimary = (val: number) =>
    padTop + plotH - (Math.min(val, yMaxPrimary) / yMaxPrimary) * plotH;

  const getYCumulative = (val: number) =>
    padTop + plotH - (Math.min(val, yMaxCumulative) / yMaxCumulative) * plotH;

  const barWidth =
    series.length > 0
      ? Math.max(10, Math.min(44, (plotW / series.length) * 0.52))
      : 24;

  const cumulativeLinePath = useMemo(() => {
    if (series.length === 0) return '';
    return series
      .map((pt, idx) => {
        const x = getX(idx);
        const y =
          granularity === 'cumulative'
            ? getYPrimary(pt.cumulativeAmount)
            : getYCumulative(pt.cumulativeAmount);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series, granularity, plotW, plotH, yMaxPrimary, yMaxCumulative]);

  const cumulativeAreaPath = useMemo(() => {
    if (series.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(series.length - 1);
    const baseY = padTop + plotH;
    return `${cumulativeLinePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
  }, [cumulativeLinePath, series.length, plotH]);

  const labelStep = Math.max(1, Math.ceil(series.length / 10));
  const selectedPoint =
    activeIndex !== null && series[activeIndex]
      ? series[activeIndex]
      : chartSort === 'asc'
        ? series[series.length - 1] ?? null
        : series[0] ?? null;

  return (
    <section
      id="charts"
      aria-label="收益统计图表"
      className="scroll-mt-16 space-y-4 sm:space-y-6"
    >
      {/* Top Full-Width Card: Time Series & Cumulative Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              收益趋势分析
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {granularity === 'cumulative'
                ? '截至各时间节点的累计总收益走势'
                : '柱状展示周期收益，折线同步反映累计走势'}
              <span aria-hidden="true"> · </span>
              <span>
                {chartSort === 'asc'
                  ? '时间从左往右递增（由早到晚）'
                  : '时间从左往右递减（最新在左）'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Granularity Segmented Control */}
            <div
              role="group"
              aria-label="统计维度"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
            >
              {GRANULARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setGranularity(opt.value);
                    setActiveIndex(null);
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    granularity === opt.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Chart Asc / Desc Toggle */}
            <button
              type="button"
              onClick={() => {
                setChartSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setActiveIndex(null);
              }}
              title="切换图表时间升序或降序展示"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {chartSort === 'asc' ? (
                <>
                  <ArrowUpNarrowWide className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>时间升序</span>
                </>
              ) : (
                <>
                  <ArrowDownWideNarrow className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>时间降序</span>
                </>
              )}
            </button>

            {granularity !== 'cumulative' && (
              <button
                type="button"
                onClick={() => setShowCumulativeOverlay((v) => !v)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showCumulativeOverlay
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                累计线
              </button>
            )}
          </div>
        </div>

        {/* Chart Canvas */}
        {series.length === 0 ? (
          <div className="min-h-[240px] flex flex-col items-center justify-center text-center py-12">
            <p className="text-sm font-medium text-slate-700">暂无符合筛选条件的收益数据</p>
            <p className="text-xs text-slate-500 mt-1">
              导入周期任务文件或新增零星收益后，这里将自动绘制多维图表。
            </p>
          </div>
        ) : (
          <div className="relative mt-3 sm:mt-4">
            {/* Pinned Readout Strip (hover & mobile tap) */}
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3 text-slate-500">
                {granularity !== 'cumulative' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" aria-hidden="true" />
                    <span>周期收益</span>
                  </span>
                )}
                {(granularity === 'cumulative' || showCumulativeOverlay) && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-slate-800 inline-block" aria-hidden="true" />
                    <span>累计总收益</span>
                  </span>
                )}
              </div>

              {selectedPoint && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono-num text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-[11px] sm:text-xs">
                  <span className="font-semibold">{selectedPoint.key}</span>
                  <span className="text-emerald-700 font-semibold">
                    当期 {formatCurrency(selectedPoint.periodAmount)}
                  </span>
                  <span className="text-slate-600">
                    累计 {formatCurrency(selectedPoint.cumulativeAmount)}
                  </span>
                  <span className="text-slate-500">{selectedPoint.count} 笔</span>
                </div>
              )}
            </div>

            <div
              ref={chartScrollRef}
              className="w-full overflow-x-auto ledger-scroll"
            >
              <svg
                viewBox={`0 0 ${width} ${height}`}
                style={
                  needsHorizontalScroll
                    ? { minWidth: `${Math.max(560, series.length * 36)}px` }
                    : undefined
                }
                className="w-full h-auto select-none"
                role="img"
                aria-label="收益统计可视化图表"
                onMouseLeave={() => setActiveIndex(null)}
              >
                <defs>
                  <linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines & Y-Axis Labels */}
                {yTicks.map((t) => {
                  const y = padTop + plotH - t * plotH;
                  const valPrimary = yMaxPrimary * t;
                  const valCum = yMaxCumulative * t;
                  return (
                    <g key={t}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={width - padRight}
                        y2={y}
                        stroke={t === 0 ? '#CBD5E1' : '#F1F5F9'}
                        strokeWidth={1}
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[11px]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        ¥{valPrimary >= 1000 ? `${(valPrimary / 1000).toFixed(1)}k` : valPrimary.toFixed(0)}
                      </text>
                      {granularity !== 'cumulative' && showCumulativeOverlay && (
                        <text
                          x={width - padRight + 8}
                          y={y + 4}
                          textAnchor="start"
                          className="fill-slate-400 text-[11px]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          ¥{valCum >= 1000 ? `${(valCum / 1000).toFixed(1)}k` : valCum.toFixed(0)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Active/Hover vertical guide line */}
                {activeIndex !== null && series[activeIndex] && (
                  <line
                    x1={getX(activeIndex)}
                    y1={padTop}
                    x2={getX(activeIndex)}
                    y2={padTop + plotH}
                    stroke="#CBD5E1"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}

                {/* Cumulative Area */}
                {granularity === 'cumulative' && series.length > 1 && (
                  <path d={cumulativeAreaPath} fill="url(#cumAreaGrad)" />
                )}

                {/* Period Bars */}
                {granularity !== 'cumulative' &&
                  series.map((pt, idx) => {
                    const cx = getX(idx);
                    const y = getYPrimary(pt.periodAmount);
                    const barH = Math.max(3, padTop + plotH - y);
                    const isFocused = activeIndex === idx;
                    return (
                      <rect
                        key={pt.key}
                        x={cx - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={barH}
                        rx={3}
                        className="transition-opacity duration-150"
                        fill={isFocused ? '#047857' : '#10B981'}
                        opacity={activeIndex !== null && !isFocused ? 0.55 : 0.92}
                      />
                    );
                  })}

                {/* Cumulative Line Overlay or Main Line */}
                {(granularity === 'cumulative' || showCumulativeOverlay) &&
                  series.length > 0 && (
                    <>
                      {series.length > 1 && (
                        <path
                          d={cumulativeLinePath}
                          fill="none"
                          stroke={granularity === 'cumulative' ? '#047857' : '#1E293B'}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {series.map((pt, idx) => {
                        const cx = getX(idx);
                        const cy =
                          granularity === 'cumulative'
                            ? getYPrimary(pt.cumulativeAmount)
                            : getYCumulative(pt.cumulativeAmount);
                        const isFocused = activeIndex === idx;
                        return (
                          <circle
                            key={`dot-${pt.key}`}
                            cx={cx}
                            cy={cy}
                            r={isFocused ? 5 : series.length <= 18 ? 3.5 : 2.5}
                            fill={granularity === 'cumulative' ? '#047857' : '#1E293B'}
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                          />
                        );
                      })}
                    </>
                  )}

                {/* X-Axis Labels */}
                {series.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === series.length - 1;
                  const tooCloseToLast =
                    !isLast &&
                    series.length - 1 - idx < Math.max(1, Math.ceil(labelStep * 0.65));
                  const showLabel =
                    isLast || (!tooCloseToLast && (isFirst || idx % labelStep === 0));
                  if (!showLabel) return null;
                  const isCurrentEnd =
                    (chartSort === 'asc' && isLast) || (chartSort === 'desc' && isFirst);
                  return (
                    <text
                      key={`lbl-${pt.key}`}
                      x={getX(idx)}
                      y={height - 12}
                      textAnchor="middle"
                      className={`text-[11px] ${
                        activeIndex === idx || isCurrentEnd
                          ? 'fill-slate-900 font-semibold'
                          : 'fill-slate-500'
                      }`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {pt.label}
                    </text>
                  );
                })}

                {/* Interactive Hit Columns */}
                {series.map((pt, idx) => {
                  const colW = plotW / series.length;
                  const x = padLeft + colW * idx;
                  return (
                    <rect
                      key={`hit-${pt.key}`}
                      x={x}
                      y={padTop}
                      width={colW}
                      height={plotH + 24}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => setActiveIndex(idx)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Two-Column Row: Channel Distribution + Activity Item Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        {/* Card 1: Payment Platform / Channel Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                支付平台渠道分布
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                点击任意渠道可快速筛选图表与收益明细
              </p>
            </div>
            {selectedChannel !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectChannel('all')}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap min-h-[36px] px-2 cursor-pointer"
              >
                查看全部
              </button>
            )}
          </div>

          {channels.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
              暂无渠道统计数据
            </div>
          ) : (
            <div className="mt-3 sm:mt-4 space-y-2.5 flex-1 overflow-y-auto max-h-[290px] pr-1 ledger-scroll">
              {channels.map((item) => {
                const isActive = selectedChannel === item.channel;
                return (
                  <button
                    key={item.channel}
                    type="button"
                    onClick={() =>
                      onSelectChannel(isActive ? 'all' : item.channel)
                    }
                    className={`w-full text-left group rounded-lg p-2.5 transition-colors cursor-pointer min-h-[44px] ${
                      isActive ? 'bg-emerald-50/90' : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-medium truncate ${
                            isActive ? 'text-emerald-800' : 'text-slate-800'
                          }`}
                        >
                          {item.channel}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num shrink-0">
                          {item.count} 笔
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0 font-mono-num">
                        <span className="text-xs text-slate-400">
                          {item.share.toFixed(1)}%
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isActive ? 'bg-emerald-700' : 'bg-emerald-500/80 group-hover:bg-emerald-600'
                        }`}
                        style={{ width: `${Math.max(2, item.share)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>覆盖渠道：{channels.length} 个</span>
            <span className="font-mono-num text-slate-700 font-medium">
              合计 {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        {/* Card 2: Activity Item Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                活动事项分布
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                按活动/任务汇总收益排行，点击可联动筛选明细
              </p>
            </div>
            {selectedActivity !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectActivity('all')}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap min-h-[36px] px-2 cursor-pointer"
              >
                查看全部
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
              暂无活动事项统计数据
            </div>
          ) : (
            <div className="mt-3 sm:mt-4 space-y-2.5 flex-1 overflow-y-auto max-h-[290px] pr-1 ledger-scroll">
              {activities.map((item) => {
                const isActive = selectedActivity === item.activity;
                return (
                  <button
                    key={item.activity}
                    type="button"
                    onClick={() =>
                      onSelectActivity(isActive ? 'all' : item.activity)
                    }
                    className={`w-full text-left group rounded-lg p-2.5 transition-colors cursor-pointer min-h-[44px] ${
                      isActive ? 'bg-emerald-50/90' : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-medium truncate ${
                            isActive ? 'text-emerald-800' : 'text-slate-800'
                          }`}
                          title={item.activity}
                        >
                          {item.activity}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num shrink-0">
                          {item.count} 笔
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0 font-mono-num">
                        <span className="text-xs text-slate-400">
                          {item.share.toFixed(1)}%
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isActive ? 'bg-slate-800' : 'bg-slate-600/80 group-hover:bg-slate-800'
                        }`}
                        style={{ width: `${Math.max(2, item.share)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>覆盖活动：{activities.length} 项</span>
            <span className="font-mono-num text-slate-700 font-medium">
              合计 {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
