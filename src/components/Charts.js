import React from 'react';
import Chart from 'react-apexcharts';
import { money, moneyShort } from '../lib/format.js';

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const base = (dark) => ({
  chart: {
    fontFamily: FONT,
    background: 'transparent',
    foreColor: dark ? '#94a3b8' : '#64748b',
    toolbar: { show: false },
    animations: { speed: 350 },
  },
  theme: { mode: dark ? 'dark' : 'light' },
  dataLabels: { enabled: false },
  tooltip: { theme: dark ? 'dark' : 'light' },
});

export function CategoryDonut({ categories, total, selected, onSelect, dark }) {
  const shown = categories.filter((c) => c.total > 0);
  const options = {
    ...base(dark),
    chart: {
      ...base(dark).chart,
      events: {
        dataPointSelection: (event, ctx, config) => {
          const cat = shown[config.dataPointIndex];
          if (cat) onSelect(cat.name);
        },
      },
    },
    labels: shown.map((c) => c.name),
    colors: shown.map((c) => (selected && selected !== c.name ? c.color + '40' : c.color)),
    legend: { show: false },
    stroke: { width: 2, colors: [dark ? '#111827' : '#ffffff'] },
    states: { active: { filter: { type: 'none' } }, hover: { filter: { type: 'darken', value: 0.9 } } },
    tooltip: { ...base(dark).tooltip, y: { formatter: (v) => money(v) }, fillSeriesColor: false },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '74%',
          labels: {
            show: true,
            name: { offsetY: 22, fontSize: '13px', color: dark ? '#94a3b8' : '#64748b' },
            value: {
              offsetY: -14,
              fontSize: '24px',
              fontWeight: 700,
              color: dark ? '#f1f5f9' : '#0f172a',
              formatter: (v) => moneyShort(Number(v)),
            },
            total: {
              show: true,
              showAlways: !selected,
              label: selected || 'Total spent',
              fontSize: '13px',
              color: dark ? '#94a3b8' : '#64748b',
              formatter: () => moneyShort(selected ? (shown.find((c) => c.name === selected) || {}).total || 0 : total),
            },
          },
        },
      },
    },
  };

  return (
    <div className="donut">
      <Chart options={options} series={shown.map((c) => Math.round(c.total * 100) / 100)} type="donut" height={280} />
    </div>
  );
}

export function TrendChart({ points, dark, color }) {
  const options = {
    ...base(dark),
    colors: [color],
    xaxis: {
      categories: points.map((p) => p.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: points.length > 16 ? 8 : undefined,
      labels: { rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: { labels: { formatter: (v) => moneyShort(v).replace('.00', '') }, tickAmount: 4 },
    grid: { borderColor: dark ? '#1f2937' : '#eef2f6', strokeDashArray: 4, padding: { left: 4, right: 4 } },
    plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: 'end', columnWidth: points.length > 16 ? '70%' : '48%' } },
    states: { hover: { filter: { type: 'darken', value: 0.9 } } },
    tooltip: { ...base(dark).tooltip, y: { formatter: (v) => money(v) }, x: { formatter: (v, o) => (points[o.dataPointIndex] || {}).tooltip || v } },
  };
  return (
    <div className="trend">
      <Chart options={options} series={[{ name: 'Spent', data: points.map((p) => Math.round(p.value * 100) / 100) }]} type="bar" height={260} />
    </div>
  );
}
