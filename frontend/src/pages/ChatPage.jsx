import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import MonthPicker from '../components/MonthPicker'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import ErrorMessage from '../components/ui/ErrorMessage'
import Icon from '../components/ui/Icon'
import ParrotLogo from '../components/ui/ParrotLogo'
import useReducedMotion from '../hooks/useReducedMotion'
import { currentMonth, formatMonthLabel } from '../utils/month'

const MAX_SEND = 10 // 서버에는 최근 10개만 보낸다 (API 계약: messages 1~10개)
const MAX_LEN = 1000 // content 최대 길이 (공백 제거 후 1~1000자)
const EXAMPLES = ['이번 달 가장 많이 쓴 카테고리는?', '지난달보다 지출이 늘었어?', '정기결제 뭐뭐 있어?']

// 답변은 일반 텍스트(마크다운 없음)이고 줄바꿈과 "- " 목록이 올 수 있어 whitespace-pre-line 으로 그대로 보여준다.
function Bubble({ role, children }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gem-ink px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line text-white sm:max-w-[75%]">
          {children}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <ParrotLogo className="h-5 w-5" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-white px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line text-gem-ink shadow-soft sm:max-w-[75%]">
        {children}
      </div>
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
  const epochRef = useRef(0) // "새 대화"를 누르면 올라가서, 늦게 도착한 이전 응답을 버린다

  // 새 메시지·전송 중 표시·오류가 생기면 맨 아래로 (동작 줄이기면 즉시)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [messages, sending, error, reduced])

  // 입력창 높이를 내용에 맞춘다 (최대 8rem)
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
  }, [input])

  const run = async (history) => {
    const epoch = epochRef.current
    setSending(true)
    setError('')
    try {
      const reply = await sendChat({ month, messages: history.slice(-MAX_SEND) })
      if (epoch !== epochRef.current) return
      setMessages([...history, { role: 'assistant', content: reply }])
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
  }

  const onKeyDown = (e) => {
    // Enter 전송, Shift+Enter 줄바꿈. 한글 조합 중 Enter 는 글자 확정이므로 전송하지 않는다.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit(input)
    }
  }

  const canRetry = error && messages.at(-1)?.role === 'user'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <PageHeader icon="chat" title="AI 챗봇" subtitle="내 가계부에 대해 물어보세요" />
        <div className="flex items-center gap-2">
          <MonthPicker month={month} onChange={setMonth} />
          <Button variant="soft" onClick={reset} disabled={messages.length === 0 && !sending}>
            새 대화
          </Button>
        </div>
      </div>

      <p className="type-caption flex items-start gap-1.5">
        <Icon name="info" className="mt-px h-4 w-4 shrink-0" />
        <span>
          {formatMonthLabel(month)} 데이터 기준으로 답해요. 가상 데이터 기반이며 금융 조언이 아닙니다.
        </span>
      </p>

      <section className="card flex flex-col overflow-hidden" aria-label="AI 챗봇 대화">
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="h-[min(58vh,30rem)] space-y-3 overflow-y-auto p-4 sm:p-5"
        >
          {messages.length === 0 && !sending && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Icon name="chat" className="h-6 w-6" />
              </span>
              <p className="type-body">무엇이 궁금하세요? 예시를 눌러 바로 물어볼 수 있어요.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    className="focus-ring chip transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>
              {m.content}
            </Bubble>
          ))}

          {sending && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <ParrotLogo className="h-5 w-5" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3.5 shadow-soft">
                <span className="sr-only">답변을 작성하는 중입니다</span>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    aria-hidden="true"
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
                    style={{ animationDelay: `${d * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <ErrorMessage message={error} onRetry={canRetry ? () => run(messages) : undefined} />}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="flex items-end gap-2 border-t border-line p-3 sm:p-4"
        >
          <div className="min-w-0 flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_LEN}
              placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
              aria-label="질문 입력"
              className="field h-auto min-h-11 resize-none rounded-2xl py-2.5"
            />
            {input.length >= MAX_LEN - 100 && (
              <p className="num type-caption mt-1 text-right">
                {input.length}/{MAX_LEN}
              </p>
            )}
          </div>
          <Button
            type="submit"
            aria-label="전송"
            title="전송"
            className="h-11 w-11 shrink-0 px-0"
            disabled={!input.trim()}
            loading={sending}
          >
            {!sending && <Icon name="send" className="h-[18px] w-[18px]" />}
          </Button>
        </form>
      </section>
    </div>
  )
}
