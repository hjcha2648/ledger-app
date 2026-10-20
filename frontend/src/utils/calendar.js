// 월 거래 배열을 날짜('YYYY-MM-DD')별로 묶는다. 날짜 문자열을 그대로 키로 쓴다.
// → Map<date, { income, expense: 합계, incomeCount, expenseCount: 유형별 건수, count: 전체 건수, items: 거래[] }>
export function groupByDate(transactions) {
  const map = new Map()
  transactions.forEach((t) => {
    const g = map.get(t.occurred_on) ?? { income: 0, expense: 0, incomeCount: 0, expenseCount: 0, count: 0, items: [] }
    if (t.type === 'INCOME') {
      g.income += t.amount_krw
      g.incomeCount += 1
    } else {
      g.expense += t.amount_krw
      g.expenseCount += 1
    }
    g.count += 1
    g.items.push(t)
    map.set(t.occurred_on, g)
  })
  return map
}
