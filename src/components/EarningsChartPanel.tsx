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
  BucketGranularity,
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

const CUMULATIVE_BUCKET_OPTIONS: { value: BucketGranularity; label: string }[] = [
  { value: 'daily', label: '按日累计' },
  { value: 'monthly', label: '按月累计' },
  { value: 'yearly', label: '按年累计' },
];

function computeNiceYAxis(rawMax: number): { yMax: number; ticks: number[] } {
  const safeMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10;
  const rawStep = safeMax / 4;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const frac = rawStep / base;

  const niceFactors = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const factor = niceFactors.find((f) => f >= frac - 1e-9) ?? 10;
  const step = Math.round(factor * base * 10000) / 10000;
  const yMax = Math.round(step * 4 * 10000) / 10000;
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round(step * i * 10000) / 10000);
  return { yMax, ticks };
}

function formatAxisTick(val: number): string {
  if (val === 0) return '¥0';
  if (val >= 100000) {
    const wan = val / 10000;
    return `¥${Number.isInteger(wan) ? wan.toFixed(0) : wan.toFixed(1)}万`;
  }
  if (Number.isInteger(val)) return `¥${val}`;
  return `¥${Number(val.toFixed(1))}`;
}

function formatBarTopValue(val: number): string {
  if (val <= 0) return '';
  if (val >= 10000) return `¥${(val / 10000).toFixed(1)}万`;
  if (Number.isInteger(val)) return `¥${val}`;
  return `¥${Number(val.toFixed(1))}`;
}

export const EarningsChartPanel: React.FC<EarningsChartPanelProps> = ({
  records,
  selectedChannel,
  onSelectChannel,
  selectedActivity,
  onSelectActivity,
}) => {
  const [granularity, setGranularity] = useState<ChartGranularity>('monthly');
  const [cumulativeGranularity, setCumulativeGranularity] =
    useState<BucketGranularity>('monthly');
  // Default chart time axis is ascending (left -> right chronologically increasing)
  const [chartSort, setChartSort] = useState<SortDirection>('asc');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [plotViewportWidth, setPlotViewportWidth] = useState<number>(620);
  const chartScrollRef = useRef<HTMLDivElement>(null);

  const series = useMemo(
    () => buildChartSeries(records, granularity, chartSort, cumulativeGranularity),
    [records, granularity, chartSort, cumulativeGranularity]
  );

  // Measure live plot viewport width so SVG coordinates render at crisp 1:1 CSS pixels
  // and the pinned left Y-axis aligns pixel-perfectly with the horizontal gridlines.
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.floor(el.clientWidth);
      if (next > 0) setPlotViewportWidth(next);
    };

    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [series.length]);

  const height = 250;
  const padTop = 26;
  const padBottom = 36;
  const plotPadLeft = 14;
  const plotPadRight = 18;
  const plotH = height - padTop - padBottom;

  const minColStep = granularity === 'yearly' ? 68 : 48;
  const plotWidth = Math.max(
    plotViewportWidth,
    plotPadLeft + plotPadRight + series.length * minColStep
  );
  const plotInnerW = plotWidth - plotPadLeft - plotPadRight;

  // Compute single unambiguous Y-axis from actual plotted values for the active view
  const rawMaxValue = useMemo(() => {
    if (series.length === 0) return 10;
    return Math.max(
      0,
      ...series.map((p) =>
        granularity === 'cumulative' ? p.cumulativeAmount : p.periodAmount
      )
    );
  }, [series, granularity]);

  const { yMax, ticks: yTickValues } = useMemo(
    () => computeNiceYAxis(rawMaxValue),
    [rawMaxValue]
  );

  const yAxisWidth = useMemo(() => {
    const longestLabel = formatAxisTick(yMax);
    return Math.max(54, longestLabel.length * 8 + 16);
  }, [yMax]);

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
  }, [granularity, cumulativeGranularity, chartSort, plotWidth, series.length]);

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

  const getX = (idx: number) => {
    if (series.length <= 1) return plotPadLeft + plotInnerW / 2;
    const step = plotInnerW / series.length;
    return plotPadLeft + step * idx + step / 2;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, yMax));
    return padTop + plotH - (clamped / yMax) * plotH;
  };

  const colWidth = series.length > 0 ? plotInnerW / series.length : plotInnerW;
  const barWidth =
    series.length > 0
      ? Math.max(12, Math.min(44, colWidth * 0.54))
      : 24;

  const cumulativeLinePath = useMemo(() => {
    if (series.length === 0) return '';
    return series
      .map((pt, idx) => {
        const x = getX(idx);
        const y = getY(pt.cumulativeAmount);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series, plotInnerW, plotH, yMax]);

  const cumulativeAreaPath = useMemo(() => {
    if (series.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(series.length - 1);
    const baseY = padTop + plotH;
    return `${cumulativeLinePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
  }, [cumulativeLinePath, series.length, plotH]);

  const labelStep = colWidth >= 44 ? 1 : Math.max(1, Math.ceil(44 / Math.max(1, colWidth)));
  const selectedPoint =
    activeIndex !== null && series[activeIndex]
      ? series[activeIndex]
      : chartSort === 'asc'
        ? series[series.length - 1] ?? null
        : series[0] ?? null;

  const activeGranularityDesc =
    granularity === 'daily'
      ? '按自然日统计当期收益（纵轴为单日收益金额）'
      : granularity === 'monthly'
        ? '按自然月统计当期收益（纵轴为单月收益金额）'
        : granularity === 'yearly'
          ? '按自然年统计当期收益（纵轴为年度收益金额）'
          : `按${
              cumulativeGranularity === 'daily'
                ? '日'
                : cumulativeGranularity === 'monthly'
                  ? '月'
                  : '年'
            }节点累加历史总收益（纵轴为累计总金额）`;

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
              <span>{activeGranularityDesc}</span>
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

            {/* Explicit Cumulative Bucket Granularity Selector */}
            {granularity === 'cumulative' && (
              <div
                role="group"
                aria-label="累计收入统计粒度"
                className="inline-flex items-center p-1 bg-emerald-50 border border-emerald-200 rounded-lg"
              >
                {CUMULATIVE_BUCKET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCumulativeGranularity(opt.value);
                      setActiveIndex(null);
                    }}
                    className={`px-2.5 py-1 min-h-[30px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      cumulativeGranularity === opt.value
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-800 hover:bg-emerald-100/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

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
                {granularity !== 'cumulative' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" aria-hidden="true" />
                    <span>
                      {granularity === 'daily'
                        ? '单日收益（元）'
                        : granularity === 'monthly'
                          ? '单月收益（元）'
                          : '年度收益（元）'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-700 inline-block" aria-hidden="true" />
                    <span>
                      累计总收益（
                      {cumulativeGranularity === 'daily'
                        ? '按日'
                        : cumulativeGranularity === 'monthly'
                          ? '按月'
                          : '按年'}
                      ，元）
                    </span>
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

            {/* Pinned Left Y-Axis + Scrollable Plot Area */}
            <div className="flex items-stretch">
              {/* Fixed Left Y-Axis (stays visible regardless of horizontal scroll) */}
              <div className="shrink-0" style={{ width: `${yAxisWidth}px` }}>
                <svg
                  width={yAxisWidth}
                  height={height}
                  className="block select-none"
                  aria-hidden="true"
                >
                  {yTickValues.map((val) => {
                    const y = getY(val);
                    return (
                      <g key={val}>
                        <text
                          x={yAxisWidth - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-500 text-[11px]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {formatAxisTick(val)}
                        </text>
                        <line
                          x1={yAxisWidth - 4}
                          y1={y}
                          x2={yAxisWidth}
                          y2={y}
                          stroke={val === 0 ? '#CBD5E1' : '#E2E8F0'}
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })}
                  <line
                    x1={yAxisWidth - 0.5}
                    y1={padTop}
                    x2={yAxisWidth - 0.5}
                    y2={padTop + plotH}
                    stroke="#E2E8F0"
                    strokeWidth={1}
                  />
                </svg>
              </div>

              {/* Scrollable Plot Area */}
              <div
                ref={chartScrollRef}
                className="flex-1 min-w-0 overflow-x-auto ledger-scroll"
              >
                <svg
                  width={plotWidth}
                  height={height}
                  className="block select-none"
                  role="img"
                  aria-label="收益统计可视化图表"
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <defs>
                    <linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.20" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines aligned 1:1 with Left Y-Axis ticks */}
                  {yTickValues.map((val) => {
                    const y = getY(val);
                    return (
                      <line
                        key={val}
                        x1={0}
                        y1={y}
                        x2={plotWidth}
                        y2={y}
                        stroke={val === 0 ? '#CBD5E1' : '#F1F5F9'}
                        strokeWidth={1}
                      />
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

                  {/* Period Bars (Daily / Monthly / Yearly) */}
                  {granularity !== 'cumulative' &&
                    series.map((pt, idx) => {
                      const cx = getX(idx);
                      const y = getY(pt.periodAmount);
                      const rawBarH = padTop + plotH - y;
                      const barH = pt.periodAmount > 0 ? Math.max(2, rawBarH) : 0;
                      const isFocused =
                        activeIndex === idx ||
                        (activeIndex === null &&
                          ((chartSort === 'asc' && idx === series.length - 1) ||
                            (chartSort === 'desc' && idx === 0)));
                      const showBarValue = colWidth >= 44 || isFocused;
                      return (
                        <g key={pt.key}>
                          {barH > 0 && (
                            <rect
                              x={cx - barWidth / 2}
                              y={padTop + plotH - barH}
                              width={barWidth}
                              height={barH}
                              rx={3}
                              className="transition-opacity duration-150"
                              fill={isFocused ? '#047857' : '#10B981'}
                              opacity={
                                activeIndex !== null && activeIndex !== idx
                                  ? 0.5
                                  : 0.92
                              }
                            />
                          )}
                          {showBarValue && pt.periodAmount > 0 && (
                            <text
                              x={cx}
                              y={Math.max(12, padTop + plotH - barH - 6)}
                              textAnchor="middle"
                              className={`text-[10px] ${
                                isFocused
                                  ? 'fill-emerald-800 font-semibold'
                                  : 'fill-slate-500'
                              }`}
                              style={{ fontFamily: 'var(--font-mono)' }}
                            >
                              {formatBarTopValue(pt.periodAmount)}
                            </text>
                          )}
                        </g>
                      );
                    })}

                  {/* Cumulative Line & Dots (Cumulative Mode) */}
                  {granularity === 'cumulative' && series.length > 0 && (
                    <>
                      {series.length > 1 && (
                        <path
                          d={cumulativeLinePath}
                          fill="none"
                          stroke="#047857"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {series.map((pt, idx) => {
                        const cx = getX(idx);
                        const cy = getY(pt.cumulativeAmount);
                        const isFocused =
                          activeIndex === idx ||
                          (activeIndex === null &&
                            ((chartSort === 'asc' && idx === series.length - 1) ||
                              (chartSort === 'desc' && idx === 0)));
                        const showDotValue =
                          (colWidth >= 56 && idx % labelStep === 0) || isFocused;
                        return (
                          <g key={`dot-${pt.key}`}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isFocused ? 5 : series.length <= 18 ? 3.5 : 3}
                              fill="#047857"
                              stroke="#FFFFFF"
                              strokeWidth={1.5}
                            />
                            {showDotValue && (
                              <text
                                x={cx}
                                y={Math.max(12, cy - 9)}
                                textAnchor="middle"
                                className={`text-[10px] ${
                                  isFocused
                                    ? 'fill-emerald-800 font-semibold'
                                    : 'fill-slate-500'
                                }`}
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {formatBarTopValue(pt.cumulativeAmount)}
                              </text>
                            )}
                          </g>
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
                      labelStep > 1 &&
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
                        y={height - 10}
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
                    const x = plotPadLeft + colWidth * idx;
                    return (
                      <rect
                        key={`hit-${pt.key}`}
                        x={x}
                        y={padTop}
                        width={colWidth}
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
