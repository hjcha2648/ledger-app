import { Fragment, useEffect, useState } from 'react'
import { sendChat } from '../../api/chat'
import ThinkingDots from './ThinkingDots'
import ErrorMessage from '../ui/ErrorMessage'
import Icon from '../ui/Icon'
import { copyText } from '../../utils/copyText'
import { formatMonthLabel } from '../../utils/month'

// 절약 팁: 대화가 아니라 글(아티클)로 보여준다. 데이터·API 는 챗봇과 같은 POST /api/chat 을 그대로 쓴다.
// 형식 지시(소제목 "■ ", 목록 "- ")는 질문 문구에 담고, 모델이 따르지 않아도 parseBlocks 가 줄 모양으로 최대한 나눈다.
const SAVING_TIP_PROMPT =
  '선택한 달 기준 최근 3개월의 수입·지출 흐름과 카테고리별 지출 변화를 보고, 늘어난 항목을 짚어서 줄일 수 있는 절약 팁이나 대안을 알려줘. 대화체 말고 짧은 글로 정리해줘. 소제목 줄은 "■ "로 시작하고, 먼저 3개월 동향을 한두 문장으로 요약한 뒤 "- "로 시작하는 절약 팁·대안 목록을 써줘.'

// 일반 텍스트를 블록으로 나눈다: 소제목("■ ", "## ", "1. 제목:" 처럼 짧고 콜론으로 끝나는 줄) / 글머리("- ", "• ") / 번호("1. ", "1) ") / 문단 / 빈 줄 간격
function parseBlocks(text) {
  const blocks = []
  for (const raw of text.replace(/\*\*/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) {
      if (blocks.length && blocks.at(-1).type !== 'gap') blocks.push({ type: 'gap' })
      continue
    }
    let m
    if ((m = line.match(/^(?:■|#{1,3})\s*(.+)$/))) blocks.push({ type: 'heading', text: m[1].replace(/[:：]$/, '') })
    else if ((m = line.match(/^[-•·*]\s+(.+)$/))) pushItem(blocks, 'ul', m[1])
    else if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      if (m[1].length <= 30 && /[:：]$/.test(m[1])) blocks.push({ type: 'heading', text: m[1].replace(/[:：]$/, '') })
      else pushItem(blocks, 'ol', m[1])
    } else if (line.length <= 30 && /[:：]$/.test(line)) blocks.push({ type: 'heading', text: line.replace(/[:：]$/, '') })
    else blocks.push({ type: 'p', text: line })
  }
  return blocks.filter((b, i, a) => !(b.type === 'gap' && (i === 0 || i === a.length - 1)))
}
function pushItem(blocks, type, text) {
  const last = blocks.at(-1)
  if (last?.type === type) last.items.push(text)
  else blocks.push({ type, items: [text] })
}

// 금액("12,300원")은 굵게
function Emphasis({ text }) {
  return text.split(/(\d[\d,]*\s?원)/).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-gem-ink">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function Article({ text }) {
  return parseBlocks(text).map((b, i) => {
    if (b.type === 'gap') return <div key={i} className="h-1" />
    if (b.type === 'heading')
      return (
        <h3 key={i} className="pt-3 text-lg font-semibold tracking-tight text-gem-ink">
          {b.text}
        </h3>
      )
    if (b.type === 'ul' || b.type === 'ol') {
      const List = b.type === 'ul' ? 'ul' : 'ol'
      return (
        <List key={i} className={`space-y-2 pl-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-ink-subtle`}>
          {b.items.map((it, j) => (
            <li key={j} className="pl-1">
              <Emphasis text={it} />
            </li>
          ))}
        </List>
      )
    }
    return (
      <p key={i}>
        <Emphasis text={b.text} />
      </p>
    )
  })
}

export default function TipArticle({ month }) {
  const [state, setState] = useState({ month: null, text: '', error: '' }) // month 가 현재 month 와 다르면 로딩 중이다
  const [attempt, setAttempt] = useState(0)
  const [copied, setCopied] = useState(false)

  // 월이 바뀌면(또는 다시 시도하면) 새 월 데이터로 다시 불러온다. 이전 요청의 늦은 응답은 버린다.
  useEffect(() => {
    let live = true
    sendChat({ month, messages: [{ role: 'user', content: SAVING_TIP_PROMPT }] })
      .then((text) => live && setState({ month, text, error: '' }))
      .catch((err) => live && setState({ month, text: '', error: err.message }))
    return () => {
      live = false
    }
  }, [month, attempt])

  useEffect(() => {
    if (!copied) return undefined
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const loading = state.month !== month
  const retry = () => {
    setState({ month: null, text: '', error: '' })
    setAttempt((n) => n + 1)
  }

  return (
    // 바깥: 상단 바·월 선택기 줄을 뺀 남은 영역(챗봇 첫 화면 섹션과 같은 높이)을 채우고, 안쪽 글 덩어리가 my-auto 로 세로 가운데에 온다.
    // 글이 길면 min-h 가 늘어나 위에서부터 시작하고 페이지가 스크롤된다(위가 잘리지 않는다).
    <div className="flex min-h-[calc(100dvh-12.75rem)] flex-col pb-24">
      {/* 글 덩어리: 데스크톱은 w-fit + mx-auto 로 덩어리 자체가 가로 가운데, 모바일은 w-full(좌우 여백은 main 의 16px). 글은 왼쪽 정렬 */}
      <article aria-label="추천 절약 팁" className="mx-auto my-auto w-full max-w-[720px] py-6 sm:w-fit">
      {!loading && (
        <h2 className="animate-fade-up text-3xl font-semibold tracking-tighter break-keep sm:text-4xl">
          추천 <span className="text-gradient-brand">절약 팁</span>
        </h2>
      )}
      <p className={`type-caption ${loading ? '' : 'mt-1.5'}`}>
        {formatMonthLabel(month)} 기준 최근 3개월 기록을 바탕으로 정리했어요. 가상 데이터 기반이며 금융 조언이 아닙니다.
      </p>

      <div className="mt-6 text-[15px] leading-relaxed break-words text-gem-ink tabular-nums">
        {loading && <ThinkingDots srText="절약 팁을 정리하는 중입니다" />}
        {!loading && state.error && <ErrorMessage message={state.error} onRetry={retry} />}
        {!loading && state.text && (
          <div key={state.month} className="animate-fade-up space-y-2.5">
            <Article text={state.text} />
          </div>
        )}
      </div>

      {!loading && state.text && (
        <div className="mt-20 flex justify-center">
          <button
            type="button"
            onClick={async () => setCopied(await copyText(state.text))}
            className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink motion-reduce:transition-none"
          >
            <Icon name={copied ? 'check' : 'copy'} className={`h-4 w-4 ${copied ? 'text-accent' : ''}`} />
            {copied ? '복사됨' : '글 복사'}
          </button>
        </div>
      )}
      </article>
    </div>
  )
}
