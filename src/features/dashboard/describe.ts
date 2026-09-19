import { formatAmount } from '../../domain/format'
import type { CatchUpNotice } from '../../domain/projection'

export function describeCatchUp(n: CatchUpNotice): string {
  const range = n.fromMonth === n.toMonth ? n.fromMonth : `${n.fromMonth} 至 ${n.toMonth}`
  const per = n.fromMonth === n.toMonth ? '需預留' : '每月需預留'
  const amount =
    n.minAmount === n.maxAmount ? formatAmount(n.maxAmount) : `${formatAmount(n.minAmount)}–${formatAmount(n.maxAmount)}`
  return `${n.name}：${range} ${per} ${amount}（平時 ${formatAmount(n.steadyAmount)}）`
}
