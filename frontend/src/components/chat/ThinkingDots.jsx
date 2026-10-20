// 응답 대기: 브랜드색(초록 → 노랑 → 코랄) 점 3개가 순서대로 튀고 "생각하는 중…". 챗봇 대화와 절약 팁 화면이 함께 쓴다.
const DOT_COLORS = ['#12b76a', '#f2b83d', '#f4a3a8']

export default function ThinkingDots({ srText = '답변을 작성하는 중입니다' }) {
  return (
    <div role="status" className="flex items-center gap-2.5 pt-0.5">
      <span className="flex items-center gap-1" aria-hidden="true">
        {DOT_COLORS.map((c, d) => (
          <span
            key={c}
            className="h-2 w-2 animate-bounce rounded-full motion-reduce:animate-none"
            style={{ backgroundColor: c, animationDelay: `${d * 120}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-ink-subtle">생각하는 중…</span>
      <span className="sr-only">{srText}</span>
    </div>
  )
}
