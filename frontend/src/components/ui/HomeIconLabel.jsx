// 홈 아이콘 전용 이름 표시: 말풍선 없이 글씨만. 부모(group, relative)의 hover/focus-visible 에서 나타난다.
// absolute 배치라 레이아웃을 밀지 않고, 호버가 없는 터치 기기에서는 hover 변형이 적용되지 않아 보이지 않는다.
export default function HomeIconLabel({ label }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2 translate-y-1 text-base font-semibold tracking-tight whitespace-nowrap text-slate-700 opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none sm:text-lg"
    >
      {label}
    </span>
  )
}
