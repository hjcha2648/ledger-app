import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import MonthPicker from '../components/MonthPicker'
import LaserBubble from '../components/chat/LaserBubble'
import ErrorMessage from '../components/ui/ErrorMessage'
import Icon from '../components/ui/Icon'
import Logo from '../components/ui/Logo'
import { LIGHT_GRAY_BG } from '../constants/hoverTone'
import useReducedMotion from '../hooks/useReducedMotion'
import { currentMonth, formatMonthLabel } from '../utils/month'

const MAX_SEND = 10 // 서버에는 최근 10개만 보낸다 (API 계약: messages 1~10개)
const MAX_LEN = 1000 // content 최대 길이 (공백 제거 후 1~1000자)
const MAX_INPUT_PX = 144 // 입력창 최대 높이: 줄 높이 24px × 6줄
const EXAMPLES = ['이번 달 가장 많이 쓴 카테고리는?', '지난달보다 지출이 늘었어?', '정기결제 뭐뭐 있어?']
// 복사: 보안 컨텍스트가 아니어서 clipboard API 가 막혀 있으면 임시 textarea 로 대체한다
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
const delay = (ms) => ({ animationDelay: `${ms}ms` }) // 첫 화면 순차 등장 간격
// 첫 전송 때 (hero·예시가 접히고 대화 카드가 생기는) 전환 시간
const TRANSITION = 'duration-[350ms] ease-out motion-reduce:transition-none'

// 메시지 호버 액션(복사·다시 생성): 평소 보조색, hover 시 아이콘 색만 gem-ink 로(배경 칸 없음). 이름은 말풍선 없이 글씨만 뜬다.
// 터치 기기(hover 없음)에서는 액션 줄이 항상 보이므로 이름은 hover·포커스 때만 쓴다.
function IconAction({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring group/act relative flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors duration-150 hover:text-gem-ink motion-reduce:transition-none"
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 z-20 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-slate-700 opacity-0 transition-opacity duration-150 group-hover/act:opacity-100 group-focus-visible/act:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </button>
  )
}

// 복사 버튼: 누르면 1.5초 동안 체크 아이콘 + "복사됨"
function CopyAction({ text }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onCopy = async () => {
    if (!(await copyText(text))) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }
  return (
    <IconAction label={copied ? '복사됨' : '복사'} onClick={onCopy}>
      <Icon name={copied ? 'check' : 'copy'} className={`h-[18px] w-[18px] ${copied ? 'text-accent' : ''}`} />
    </IconAction>
  )
}

// 액션 줄: hover·포커스 때 fade-in, 터치 기기에서는 항상 표시
const ACTIONS_VISIBILITY =
  'opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none'

// 사용자 메시지: 오른쪽 정렬, 흰 말풍선 + 검정 글씨(옅은 테두리·부드러운 그림자, 오른쪽 아래 모서리만 작게), 줄바꿈 보존. hover 시 말풍선 왼쪽에 복사 아이콘
function UserMessage({ children }) {
  return (
    <div className="group/msg animate-msg flex items-center justify-end gap-1">
      <div className={ACTIONS_VISIBILITY}>
        <CopyAction text={children} />
      </div>
      <p className={`max-w-[75%] rounded-3xl rounded-br-md border border-slate-200/70 bg-white px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-line text-gem-ink shadow-soft`}>
        {children}
      </p>
    </div>
  )
}

// AI 아바타: 원형 배경·테두리 없이 로고만 (28~32px)
function Avatar() {
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
      <Logo className="h-7 w-7" />
    </span>
  )
}

// 답변은 일반 텍스트(마크다운 없음)다. 줄 단위로 나눠 문단 사이 빈 줄은 간격으로, "- " 목록은 들여쓴 점 목록으로 읽기 좋게 보여준다.
function TextBlocks({ text }) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item) {
      return (
        <div key={i} className="flex gap-2 pl-1">
          <span aria-hidden="true" className="select-none text-ink-subtle">
            •
          </span>
          <span className="min-w-0">{item[1]}</span>
        </div>
      )
    }
    return <p key={i}>{line}</p>
  })
}

// AI 메시지: 아주 옅은 회색 말풍선(표 행 호버 색 slate-50 70%, 왼쪽 위 모서리만 작게) 안의 텍스트. animate 이면 한 글자씩 나타난다(약 12ms/글자, 길어도 1.5초 안에 끝남).
// 효과 중에는 보이는 글자를 aria-hidden 으로 두고 전체 텍스트를 숨은 텍스트(sr-only)로 제공해 스크린리더는 전체를 읽는다.
function AssistantMessage({ text, animate, onFinish, onGrow, onRegenerate }) {
  const [count, setCount] = useState(0)
  const cb = useRef({ onFinish, onGrow })
  useEffect(() => {
    cb.current = { onFinish, onGrow } // 최신 콜백을 effect 안에서 갱신 (렌더 중 ref 쓰기 금지)
  })

  useEffect(() => {
    if (!animate) return undefined
    const start = performance.now()
    const duration = Math.min(text.length * 12, 1500)
    let raf
    const tick = (now) => {
      const p = duration === 0 ? 1 : Math.min((now - start) / duration, 1)
      setCount(Math.floor(text.length * p))
      cb.current.onGrow?.()
      if (p < 1) raf = requestAnimationFrame(tick)
      else cb.current.onFinish?.()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, text])

  const shown = animate ? text.slice(0, count) : text
  return (
    <div className="group/msg animate-msg flex items-start gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <div
          className={`w-fit max-w-[85%] space-y-1 rounded-3xl rounded-tl-md border border-slate-200/70 ${LIGHT_GRAY_BG} px-4 py-2.5 text-[15px] leading-relaxed break-words text-gem-ink tabular-nums shadow-soft`}
        >
          {animate && <span className="sr-only">{text}</span>}
          <div aria-hidden={animate || undefined} className="space-y-1">
            <TextBlocks text={shown} />
          </div>
        </div>
        {/* 복사 / 다시 생성(마지막 AI 메시지에만): 효과가 끝난 뒤에 보인다 */}
        {!animate && (
          <div className={`-ml-1 mt-1 flex items-center gap-0.5 ${ACTIONS_VISIBILITY}`}>
            <CopyAction text={text} />
            {onRegenerate && (
              <IconAction label="다시 생성" onClick={onRegenerate}>
                <Icon name="refresh" className="h-[18px] w-[18px]" />
              </IconAction>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 응답 대기: 아바타 옆에 브랜드색(초록 → 노랑 → 코랄) 점 3개가 순서대로 튀고 "생각하는 중…"
const DOT_COLORS = ['#12b76a', '#f2b83d', '#f4a3a8']
function Thinking() {
  return (
    <div className="animate-msg flex items-center gap-3">
      <Avatar />
      <div className="flex items-center gap-2.5 pt-0.5">
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
        <span className="sr-only">답변을 작성하는 중입니다</span>
      </div>
    </div>
  )
}

// 예시 질문: 카드 없이 글씨만. 마우스를 올리거나(터치 제외) 키보드로 포커스하면 말풍선 윤곽선이 레이저로 그려지고,
// 다 그려진 뒤에는 나갈 때까지 유지, 나가면 fade-out 한다(그리는 도중이면 그 지점에서 멈추고 fade-out, 다시 올리면 처음부터).
// 클릭·Enter·Space 는 말풍선 상태와 무관하게 즉시 전송하고 오버레이를 바로 제거한다. 말풍선은 같은 transform 안에 있어 함께 확대된다.
const BUBBLE_FADE_MS = 180 // LaserBubble 의 fade-out 시간과 같은 값
function ExampleQuestion({ q, delayMs, reduced, aimRef, onPick }) {
  const labelRef = useRef(null)
  const timer = useRef(0)
  const [bubble, setBubble] = useState({ on: false, leaving: false, n: 0 }) // n: 다시 올렸을 때 처음부터 그리도록 key 로 쓴다
  useEffect(() => () => clearTimeout(timer.current), [])

  const enter = () => {
    clearTimeout(timer.current)
    setBubble((b) => ({ on: true, leaving: false, n: b.on && !b.leaving ? b.n : b.n + 1 }))
  }
  const off = () => setBubble((b) => ({ on: false, leaving: false, n: b.n }))
  const leave = () => {
    clearTimeout(timer.current)
    if (reduced) return off() // 동작 줄이기: 즉시 사라진다
    setBubble((b) => (b.on ? { ...b, leaving: true } : b))
    timer.current = setTimeout(off, BUBBLE_FADE_MS)
  }

  return (
    <div className="animate-fade-up" style={delay(delayMs)}>
      <button
        type="button"
        // 마우스·펜만 호버로 친다. 터치는 호버가 없으므로 말풍선 없이 탭 즉시 전송된다.
        onPointerEnter={(e) => e.pointerType !== 'touch' && enter()}
        onPointerLeave={(e) => e.pointerType !== 'touch' && !e.currentTarget.matches(':focus-visible') && leave()}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && enter()}
        onBlur={leave}
        onClick={() => {
          clearTimeout(timer.current)
          off() // 진행 중이던 그리기(rAF)와 오버레이를 즉시 정리하고
          onPick() // 기다리지 않고 전송한다
        }}
        className="focus-ring inline-block rounded-full px-3 py-1.5 text-center text-[15px] font-medium text-slate-600 transition duration-[180ms] ease-out hover:scale-[1.08] hover:text-gem-ink focus-visible:scale-[1.08] focus-visible:text-gem-ink active:scale-[1.03] motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100 motion-reduce:active:scale-100"
      >
        <span ref={labelRef} className="relative inline-block">
          {q}
          {bubble.on && <LaserBubble key={bubble.n} targetRef={labelRef} aimRef={aimRef} reduced={reduced} leaving={bubble.leaving} />}
        </span>
      </button>
    </div>
  )
}

// 대화는 이 컴포넌트의 상태에만 둔다 (새로고침하면 초기화, 서버에 저장되지 않음).
export default function ChatPage() {
  const [month, setMonth] = useState(currentMonth) // 답변의 근거가 되는 달
  const [messages, setMessages] = useState([]) // [{ role: 'user' | 'assistant', content }]
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const reduced = useReducedMotion()
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const greetingRef = useRef(null) // 예시 질문 말풍선 꼬리가 향하는 인사 문구
  const [animateIndex, setAnimateIndex] = useState(null) // 타이핑 효과 중인 AI 메시지의 인덱스(방금 도착한 답변만)
  const epochRef = useRef(0) // "새 대화"를 누르면 올라가서, 늦게 도착한 이전 응답을 버린다

  // 스크롤: 내가 방금 보낸 질문이면 항상 맨 아래로, 답변·대기·오류가 생겼을 때는 이미 맨 아래 근처(80px 이내)일 때만 따라간다.
  // 위로 올려서 읽는 중이면 강제로 이동하지 않고, 대신 우하단 "아래로" 버튼이 나타난다. (동작 줄이기면 즉시 이동)
  const nearBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    nearBottom.current = near
    setShowJump(!near)
  }
  const scrollToBottom = () => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    if (messages.at(-1)?.role === 'user' || nearBottom.current) scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sending, error, reduced])

  // 입력창 높이를 내용에 맞춘다 (최대 6줄 = 144px, 그 이상은 입력창 안에서 스크롤)
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_INPUT_PX)}px`
  }, [input])

  // 마우스 환경에서는 처음 들어왔을 때 입력창이 첫 포커스를 받는다 (터치 기기는 키보드가 갑자기 올라오지 않게 제외)
  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) inputRef.current?.focus({ preventScroll: true })
  }, [])

  // 대화 중에는 질문을 보낸 직후와 답변이 도착했을 때 입력창에 포커스를 돌려준다
  const started = messages.length > 0 // 대화가 시작됐는지는 메시지 상태에서 파생한다 (별도 상태를 두지 않는다)
  useEffect(() => {
    if (started && !sending) inputRef.current?.focus({ preventScroll: true })
  }, [started, sending])

  // 타이핑 효과 중 늘어나는 높이를 따라 맨 아래로 (즉시)
  const stickToBottom = () => {
    const el = listRef.current
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight
  }

  const run = async (history) => {
    const epoch = epochRef.current
    setSending(true)
    setError('')
    try {
      const reply = await sendChat({ month, messages: history.slice(-MAX_SEND) })
      if (epoch !== epochRef.current) return
      setMessages([...history, { role: 'assistant', content: reply }])
      setAnimateIndex(reduced ? null : history.length) // 방금 도착한 답변만 타이핑 효과 (동작 줄이기면 즉시 표시)
    } catch (err) {
      if (epoch === epochRef.current) setError(err.message)
    } finally {
      if (epoch === epochRef.current) setSending(false)
    }
  }

  const submit = (text) => {
    const content = text.trim()
    if (!content || sending) return
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setInput('')
    run(history)
  }

  const reset = () => {
    epochRef.current += 1
    setMessages([])
    setInput('')
    setError('')
    setSending(false)
    setAnimateIndex(null)
    nearBottom.current = true
    setShowJump(false)
  }

  // 다시 생성: 새 API 없이 마지막 AI 답변을 지우고 같은 질문까지의 대화를 같은 API 로 다시 보낸다
  const regenerate = () => {
    if (sending || messages.at(-1)?.role !== 'assistant') return
    const history = messages.slice(0, -1)
    setMessages(history)
    run(history)
  }

  const onKeyDown = (e) => {
    // Enter 전송, Shift+Enter 줄바꿈. 한글 조합 중 Enter 는 글자 확정이므로 전송하지 않는다.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit(input)
    }
  }

  const canRetry = error && messages.at(-1)?.role === 'user'
  const hasText = input.trim().length > 0

  return (
    <>
      {/* 배경: 뷰포트 전체에 깔리는 fixed 레이어(상단 바 뒤, 클릭 통과). 옅은 브랜드색 블러 원은 뷰포트 크기(vmax)에 비례하고
          레이어 가장자리 밖으로 번져 나가므로 사각형 경계선이 생기지 않는다. 대화가 시작돼도 그대로 남는다. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[12vmax] -left-[10vmax] h-[46vmax] w-[46vmax] rounded-full bg-income/16 blur-[110px]" />
        <div className="absolute top-[28%] -right-[12vmax] h-[40vmax] w-[40vmax] rounded-full bg-[#f2b83d]/20 blur-[110px]" />
        <div className="absolute -bottom-[14vmax] left-[30%] h-[46vmax] w-[46vmax] rounded-full bg-[#f4a3a8]/20 blur-[120px]" />
      </div>

      <div className="relative z-10 space-y-5">
        <h1 className="sr-only">AI 챗봇</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <MonthPicker month={month} onChange={setMonth} compact />
            <button
              type="button"
              onClick={reset}
              disabled={messages.length === 0 && !sending}
              className="focus-ring group inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent-ink disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
            >
              <Icon
                name="newChat"
                className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[10deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100"
              />
              새 대화
            </button>
          </div>
        </div>

        {/* 카드·박스 없이 배경 위에 바로 놓는다. 하나의 레이아웃이 연속해서 움직인다: 첫 화면에서는 인사·입력창·예시 질문이 세로 가운데에 모여 있고,
            첫 전송 시 인사·예시가 접히면서(grid-rows 1fr→0fr + fade) 메시지 영역이 늘어나(flex-grow 0→1) 입력창이 화면 아래로 연속해서 내려간다.
            같은 DOM 노드가 움직이므로 입력창이 순간이동하거나 깜빡이지 않는다. 높이는 100dvh 에서 상단 바·여백·헤더 줄을 뺀 값. */}
        <section aria-label="AI 챗봇 대화" className="h-[calc(100dvh-12.75rem)] min-h-[30rem]">
          <div
            className={`mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col justify-center px-1 transition-[padding] sm:px-3 ${TRANSITION} ${
              started ? 'pb-0' : 'pb-[6.25rem] sm:pb-[8.75rem]'
            }`}
          >
            {/* 인사 (대화가 시작되면 위로 사라지며 접힌다) */}
            <div
              inert={started}
              className={`grid transition-[grid-template-rows,opacity,transform] ${TRANSITION} ${
                started ? 'grid-rows-[0fr] -translate-y-3 opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col items-center pb-10 text-center sm:pb-12">
                  <h2 ref={greetingRef} className="animate-fade-up text-2xl font-semibold tracking-tighter break-keep sm:text-4xl" style={delay(270)}>
                    안녕하세요, <span className="text-gradient">무엇이 궁금하세요?</span>
                  </h2>
                </div>
              </div>
            </div>

            {/* 2) 대화 영역: 시작 전에는 높이 0, 시작되면 남는 공간을 모두 차지하고 이 안에서만 스크롤한다.
                위·아래 가장자리는 옅게 페이드되고, 위로 스크롤해 아래가 가려지면 우하단에 "아래로" 버튼이 나타난다. */}
            <div
              className={`relative min-h-0 basis-0 overflow-hidden transition-[flex-grow] ${TRANSITION} ${started ? 'grow' : 'grow-0'}`}
            >
              <div
                ref={listRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                onScroll={onScroll}
                onClick={() => animateIndex !== null && setAnimateIndex(null)} // 타이핑 효과 중 영역을 누르면 전체 표시
                className="scroll-fade h-full space-y-3 overflow-y-auto py-4"
              >
                {messages.map((m, i) =>
                  m.role === 'user' ? (
                    <UserMessage key={i}>{m.content}</UserMessage>
                  ) : (
                    <AssistantMessage
                      key={i}
                      text={m.content}
                      animate={animateIndex === i}
                      onFinish={() => setAnimateIndex((cur) => (cur === i ? null : cur))}
                      onGrow={stickToBottom}
                      onRegenerate={i === messages.length - 1 && !sending && !error ? regenerate : undefined}
                    />
                  ),
                )}

                {sending && <Thinking />}

                {error && (
                  <div className="animate-msg flex items-start gap-3">
                    <Avatar />
                    <div className="min-w-0 flex-1">
                      <ErrorMessage message={error} onRetry={canRetry ? () => run(messages) : undefined} />
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label="맨 아래로"
                tabIndex={showJump && started ? 0 : -1}
                aria-hidden={!(showJump && started) || undefined}
                className={`focus-ring absolute right-3 bottom-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-muted shadow-pop transition duration-150 hover:text-gem-ink motion-reduce:transition-none ${
                  showJump && started ? 'opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
                }`}
              >
                <Icon name="arrowDown" className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* 3) 입력창: 첫 화면에서는 가운데, 대화 중에는 카드 아래 (같은 노드) */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit(input)
              }}
              className="animate-fade-up relative z-10 mx-auto w-full max-w-[720px] shrink-0 sm:pb-1"
              style={delay(360)}
            >
              <div className="flex items-end gap-2 rounded-[1.75rem] border border-line bg-white p-2 pl-5 shadow-pop transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_4px_#0f9d5833,var(--shadow-pop)] motion-reduce:transition-none">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={MAX_LEN}
                  placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                  aria-label="질문 입력"
                  className="min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[15px] leading-6 text-gem-ink outline-none placeholder:text-slate-400"
                />
                {/* 전송 버튼: 비었을 때는 연한 회색 원, 입력이 생기면 검정 원 + 살짝 커지고 화살표가 위로 올라감, hover 시 accent, 대기 중에는 스피너 */}
                <button
                  type="submit"
                  aria-label="전송"
                  title="전송"
                  disabled={!hasText || sending}
                  className={`focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-200 motion-reduce:transition-none ${
                    hasText && !sending ? 'scale-105 bg-gem-ink text-white hover:bg-accent' : 'cursor-not-allowed bg-slate-100 text-slate-300'
                  }`}
                >
                  {sending ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent motion-reduce:animate-none"
                    />
                  ) : (
                    <Icon
                      name="arrowUp"
                      className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${hasText ? '-translate-y-px' : 'translate-y-0.5'}`}
                    />
                  )}
                </button>
              </div>
              {input.length >= MAX_LEN - 100 && (
                <p className="num type-caption mt-1 px-3 text-right">
                  {input.length}/{MAX_LEN}
                </p>
              )}
            </form>

            {/* 예시 질문: 화면에서는 인사 문구 위(order-first), DOM 에서는 입력창 뒤라 Tab 은 입력창이 먼저 받는다. 카드 없이 배경 위에 떠 있는 글씨 (대화가 시작되면 위로 사라지며 접힌다).
                호버·포커스 시 transform 으로만 1.08배 확대(가운데 기준, 이웃을 밀지 않음)되고 글자색이 진해진다. 굵기는 그대로라 줄바꿈이 바뀌지 않는다. */}
            <div
              inert={started}
              className={`order-first grid transition-[grid-template-rows,opacity,transform] ${TRANSITION} ${
                started ? 'grid-rows-[0fr] -translate-y-3 opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col items-center gap-2 px-5 pt-4 pb-[4.25rem] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-3">
                  {EXAMPLES.map((q, i) => (
                    <ExampleQuestion key={q} q={q} delayMs={i * 90} reduced={reduced} aimRef={greetingRef} onPick={() => submit(q)} />
                  ))}
                </div>
              </div>
            </div>

            {/* 안내 문구: 기준 월과 안내를 한 곳에 작은 글씨로. 첫 화면에서는 질문 아래, 대화 중에는 질문이 접혀 입력창 바로 아래에 남는다 */}
            <p
              className="type-caption animate-fade-up mx-auto flex w-full max-w-[720px] shrink-0 items-start gap-1.5 px-3 pt-2"
              style={delay(450)}
            >
              <Icon name="info" className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {formatMonthLabel(month)} 데이터 기준으로 답해요. 가상 데이터 기반이며 금융 조언이 아닙니다.
              </span>
            </p>

          </div>
        </section>
      </div>
    </>
  )
}
