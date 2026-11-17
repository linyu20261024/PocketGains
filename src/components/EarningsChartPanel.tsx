import React, { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import {
  ChannelBreakdownItem,
  ChartGranularity,
  EarningRecord,
  SortDirection,
} from '../types/earnings';
import {
  buildChannelBreakdown,
  buildChartSeries,
  formatCurrency,
} from '../utils/analytics';

interface EarningsChartPanelProps {
  records: EarningRecord[];
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
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
}) => {
  const [granularity, setGranularity] = useState<ChartGranularity>('monthly');
  const [chartSort, setChartSort] = useState<SortDirection>('desc');
  const [showCumulativeOverlay, setShowCumulativeOverlay] = useState<boolean>(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const series = useMemo(
    () => buildChartSeries(records, granularity, chartSort),
    [records, granularity, chartSort]
  );

  const channels: ChannelBreakdownItem[] = useMemo(
    () => buildChannelBreakdown(records),
    [records]
  );

  const totalAmount = useMemo(
    () => records.reduce((sum, r) => sum + r.rewardAmount, 0),
    [records]
  );

  // SVG Layout dimensions
  const width = 820;
  const height = 290;
  const padLeft = 64;
  const padRight = granularity !== 'cumulative' && showCumulativeOverlay ? 68 : 24;
  const padTop = 24;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxPeriod = Math.max(
    10,
    ...series.map((p) => (granularity === 'cumulative' ? p.cumulativeAmount : p.periodAmount))
  );
  const maxCumulative = Math.max(10, ...series.map((p) => p.cumulativeAmount));

  // Nice rounded ceiling for axis
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
      ? Math.max(8, Math.min(42, (plotW / series.length) * 0.54))
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
  const hoveredPoint = hoveredIndex !== null ? series[hoveredIndex] ?? null : null;

  return (
    <section
      id="charts"
      aria-label="收益统计图表"
      className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch"
    >
      {/* Left 8 columns: Multi-granularity Time Series & Cumulative Chart */}
      <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              收益趋势分析
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {granularity === 'cumulative'
                ? '展示各时间节点截至当日的累计总收益走势'
                : '柱状展示周期净收益，折线同步反映累计总收益变化'}
              <span aria-hidden="true"> · </span>
              <span>
                {chartSort === 'desc' ? '当前时间倒序（最新在左）' : '当前时间升序（由早到晚）'}
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
                    setHoveredIndex(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              onClick={() =>
                setChartSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              title="切换图表时间升序或降序展示"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {chartSort === 'desc' ? (
                <>
                  <ArrowDownWideNarrow className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>降序</span>
                </>
              ) : (
                <>
                  <ArrowUpNarrowWide className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>升序</span>
                </>
              )}
            </button>

            {granularity !== 'cumulative' && (
              <button
                type="button"
                onClick={() => setShowCumulativeOverlay((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
          <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center py-12">
            <p className="text-sm font-medium text-slate-700">暂无符合筛选条件的收益数据</p>
            <p className="text-xs text-slate-500 mt-1">
              导入周期任务文件或新增零星收益后，这里将自动绘制多维图表。
            </p>
          </div>
        ) : (
          <div className="relative mt-4 flex-1">
            {/* Hover Info Bar (stable layout, zero jumping) */}
            <div className="mb-2 min-h-[24px] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
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

              {hoveredPoint ? (
                <div className="flex items-center gap-3 font-mono-num text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded">
                  <span className="font-medium">{hoveredPoint.key}</span>
                  <span className="text-emerald-700 font-semibold">
                    当期 {formatCurrency(hoveredPoint.periodAmount)}
                  </span>
                  <span className="text-slate-600">
                    累计 {formatCurrency(hoveredPoint.cumulativeAmount)}
                  </span>
                  <span className="text-slate-500">{hoveredPoint.count} 笔</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  鼠标悬停图表节点查看当期与累计明细
                </div>
              )}
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto min-w-[540px] select-none"
                role="img"
                aria-label="收益统计可视化图表"
                onMouseLeave={() => setHoveredIndex(null)}
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
                        y={y + 3.5}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        ¥{valPrimary >= 1000 ? `${(valPrimary / 1000).toFixed(1)}k` : valPrimary.toFixed(0)}
                      </text>
                      {granularity !== 'cumulative' && showCumulativeOverlay && (
                        <text
                          x={width - padRight + 8}
                          y={y + 3.5}
                          textAnchor="start"
                          className="fill-slate-400 text-[10px]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          ¥{valCum >= 1000 ? `${(valCum / 1000).toFixed(1)}k` : valCum.toFixed(0)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Hover vertical guide line */}
                {hoveredIndex !== null && series[hoveredIndex] && (
                  <line
                    x1={getX(hoveredIndex)}
                    y1={padTop}
                    x2={getX(hoveredIndex)}
                    y2={padTop + plotH}
                    stroke="#CBD5E1"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}

                {/* Cumulative Area (when in cumulative mode) */}
                {granularity === 'cumulative' && series.length > 1 && (
                  <path d={cumulativeAreaPath} fill="url(#cumAreaGrad)" />
                )}

                {/* Period Bars (when in daily/monthly/yearly mode) */}
                {granularity !== 'cumulative' &&
                  series.map((pt, idx) => {
                    const cx = getX(idx);
                    const y = getYPrimary(pt.periodAmount);
                    const barH = Math.max(2, padTop + plotH - y);
                    const isHovered = hoveredIndex === idx;
                    return (
                      <rect
                        key={pt.key}
                        x={cx - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={barH}
                        rx={3}
                        className="transition-opacity duration-150"
                        fill={isHovered ? '#047857' : '#10B981'}
                        opacity={hoveredIndex !== null && !isHovered ? 0.55 : 0.92}
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
                        const isHovered = hoveredIndex === idx;
                        return (
                          <circle
                            key={`dot-${pt.key}`}
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 4.5 : series.length <= 18 ? 3 : 2}
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
                  const showLabel =
                    idx === 0 ||
                    idx === series.length - 1 ||
                    idx % labelStep === 0;
                  if (!showLabel) return null;
                  return (
                    <text
                      key={`lbl-${pt.key}`}
                      x={getX(idx)}
                      y={height - 14}
                      textAnchor="middle"
                      className={`text-[10px] ${
                        hoveredIndex === idx ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                      }`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {pt.label}
                    </text>
                  );
                })}

                {/* Invisible Interactive Columns for Reliable Hover */}
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
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredIndex(idx)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Right 4 columns: Payment Platform / Channel Distribution */}
      <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              支付平台渠道分布
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              点击渠道可快速筛选下方收益明细
            </p>
          </div>
          {selectedChannel !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectChannel('all')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
            >
              查看全部
            </button>
          )}
        </div>

        {channels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-12">
            暂无渠道统计数据
          </div>
        ) : (
          <div className="mt-4 space-y-3.5 flex-1 overflow-y-auto max-h-[290px] pr-1 ledger-scroll">
            {channels.map((item) => {
              const isActive = selectedChannel === item.channel;
              return (
                <button
                  key={item.channel}
                  type="button"
                  onClick={() =>
                    onSelectChannel(isActive ? 'all' : item.channel)
                  }
                  className={`w-full text-left group rounded-lg p-2 -mx-2 transition-colors cursor-pointer ${
                    isActive ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
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
          <span>覆盖渠道数：{channels.length} 个</span>
          <span className="font-mono-num text-slate-700 font-medium">
            合计 {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>
    </section>
  );
};
