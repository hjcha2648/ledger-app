// 합계 칩(수입·지출) 호버 하이라이트 색: 표 행과 캘린더 칸이 같은 값을 쓴다.
// Tailwind 가 클래스를 찾을 수 있도록 전체 문자열로 적는다.
export const TYPE_TINT = { INCOME: 'bg-income/10', EXPENSE: 'bg-expense/10' } // 해당 유형: 옅은 초록/빨강 배경
// 캘린더 칸용: 칸이 칸 사이 구분선 색(slate-100) 위에 놓여 반투명 배경이 회색빛으로 비치므로,
// 흰색을 먼저 깔고 같은 10% 초록/빨강을 그라데이션(단색)으로 얹어 표 행(흰 카드 위)과 똑같이 보이게 한다.
export const CELL_TINT = {
  INCOME: 'bg-white bg-linear-to-b from-income/10 to-income/10',
  EXPENSE: 'bg-white bg-linear-to-b from-expense/10 to-expense/10',
}
export const DIM_SELF = 'opacity-40' // 해당 없음: 요소 자체를 흐리게 (표 행)
export const DIM_CHILDREN = '*:opacity-40' // 해당 없음: 안의 내용만 흐리게 (캘린더 칸: 칸 배경·테두리는 그대로)
