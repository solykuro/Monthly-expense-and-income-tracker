import type { ChartData } from 'chart.js'

/** jsdom 沒有 canvas；以表格輸出長條資料供測試檢查 */
export const lastBarProps: { data?: ChartData<'bar'> } = {}

export function Bar(props: { data: ChartData<'bar'> }) {
  lastBarProps.data = props.data
  const ds = props.data.datasets[0]
  return <div data-testid="bar-chart" data-count={ds.data.length} />
}
