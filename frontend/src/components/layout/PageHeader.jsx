import Icon from '../ui/Icon'

// 페이지 제목: 메뉴 아이콘과 같은 아이콘 배지(accent-soft 단색 + 부드러운 링) + 제목 + 한 줄 설명
export default function PageHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink shadow-soft ring-1 ring-accent/15">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <h1 className="type-title">{title}</h1>
        {subtitle && <p className="type-body mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
