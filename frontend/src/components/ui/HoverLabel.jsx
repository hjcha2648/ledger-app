// 부모(group, relative)에 마우스를 올리거나 포커스하면 이름이 바로 표시되는 말풍선
export default function HoverLabel({ label }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-full left-1/2 z-40 mt-2 hidden -translate-x-1/2 rounded-lg bg-gem-ink px-2.5 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block"
    >
      {label}
    </span>
  )
}
