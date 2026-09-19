import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { formatAmount } from '../../domain/format'
import type { MonthRow } from '../../domain/projection'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function barColors(rows: MonthRow[], positive: string, negative: string): string[] {
  return rows.map((r) => (r.investable < 0 ? negative : positive))
}

export function InvestableChart({ rows }: { rows: MonthRow[] }) {
  const colors = useMemo(() => {
    const positive = cssVar('--brand', '#127d72')
    const negative = cssVar('--deficit', '#c4342e')
    return { positive, negative, grid: cssVar('--line', '#dce3ed'), text: cssVar('--ink-soft', '#55607a') }
  }, [])

  const data = useMemo(
    () => ({
      labels: rows.map((r) => r.month),
      datasets: [
        {
          label: '可投資金額',
          data: rows.map((r) => r.investable),
          backgroundColor: barColors(rows, colors.positive, colors.negative),
          borderRadius: 2,
          categoryPercentage: 0.9,
          barPercentage: 0.9,
        },
      ],
    }),
    [rows, colors],
  )

  const summary = `長條圖，共 ${rows.length} 個月，${rows.filter((r) => r.investable < 0).length} 個月為負數`

  return (
    <div className="chart" role="img" aria-label={summary}>
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => formatAmount(Number(ctx.raw)) } },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: colors.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
            },
            y: {
              grid: { color: colors.grid },
              ticks: {
                color: colors.text,
                maxTicksLimit: 5,
                callback: (v) => {
                  const n = Number(v)
                  return Math.abs(n) >= 10000 ? `${n / 10000} 萬` : formatAmount(n)
                },
              },
            },
          },
        }}
      />
    </div>
  )
}
