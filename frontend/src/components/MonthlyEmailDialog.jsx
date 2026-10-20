import { useEffect, useState } from 'react'
import { getEmailStatus, requestEmailVerification, sendMonthlyEmail } from '../api/reports'
import Button from './ui/Button'
import ErrorMessage from './ui/ErrorMessage'
import Icon from './ui/Icon'
import Modal from './ui/Modal'
import Spinner from './ui/Spinner'
import { formatMonthLabel } from '../utils/month'

// 단계: loading(상태 확인) → verified(보내기 확인) | unverified(인증 요청) | pending(링크 클릭 대기) → sent(완료)
// 받는 주소는 로그인한 계정 이메일로 고정 (서버가 JWT 사용자 주소만 쓴다). SES 샌드박스라 주소 인증이 한 번 필요할 수 있다.
export default function MonthlyEmailDialog({ month, onClose }) {
  const [step, setStep] = useState('loading')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('') // 상태 확인 실패 (재시도 버튼)
  const [notice, setNotice] = useState('') // 단계 안의 짧은 안내·오류 문구
  const label = formatMonthLabel(month)

  const applyStatus = (res) => {
    setEmail(res.email)
    setStep(res.status)
    return res.status
  }

  // 다시 확인: 로딩 표시는 effect 가 아닌 이벤트 시점에 켠다 (첫 화면은 초기값 'loading')
  const loadStatus = async () => {
    setStep('loading')
    setError('')
    try {
      return applyStatus(await getEmailStatus())
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    getEmailStatus()
      .then((res) => !cancelled && applyStatus(res))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const send = async () => {
    setBusy(true)
    setNotice('')
    try {
      const res = await sendMonthlyEmail(month)
      setEmail(res.sent_to)
      setStep('sent')
    } catch (err) {
      if (err.status === 409) {
        // 서버 기준으로 아직 미인증 → 상태를 다시 보고 인증 단계로 안내
        await loadStatus()
      } else {
        setNotice(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setNotice('')
    try {
      const res = await requestEmailVerification()
      setEmail(res.email)
      setStep(res.status)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  const recheck = async () => {
    setBusy(true)
    setNotice('')
    const status = await loadStatus()
    if (status === 'pending') setNotice('아직 인증되지 않았어요. 메일의 링크를 누른 뒤 다시 확인해 주세요.')
    setBusy(false)
  }

  return (
    <Modal title="명세서 메일로 받기" onClose={onClose}>
      {error ? (
        <ErrorMessage message={error} onRetry={loadStatus} />
      ) : step === 'loading' ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Icon name={step === 'sent' ? 'check' : 'mail'} className="h-5 w-5" />
            </span>
            <div className="type-body space-y-2 pt-1 leading-relaxed">
              {step === 'verified' && (
                <p>
                  <strong className="text-gem-ink">{label}</strong> 명세서를{' '}
                  <strong className="text-gem-ink">{email}</strong>(으)로 보낼게요. 요약, 카테고리별 지출, 거래 내역이
                  담겨 있어요.
                </p>
              )}
              {step === 'unverified' && (
                <>
                  <p>
                    명세서를 받으려면 <strong className="text-gem-ink">{email}</strong> 주소 인증이 한 번 필요해요.
                  </p>
                  <p className="type-caption">
                    인증 메일은 Amazon Web Services 이름의 영어 메일로 가요. 메일 안의 링크를 누르면 인증이 끝나요.
                  </p>
                </>
              )}
              {step === 'pending' && (
                <>
                  <p>
                    <strong className="text-gem-ink">{email}</strong> 메일함에서 인증 메일의 링크를 눌러 주세요.
                  </p>
                  <p className="type-caption">
                    제목: “Amazon Web Services – Email Address Verification Request”. 안 보이면 스팸함·프로모션 탭을
                    확인하세요. 링크는 24시간 동안 유효해요.
                  </p>
                </>
              )}
              {step === 'sent' && (
                <>
                  <p>
                    <strong className="text-gem-ink">{email}</strong>(으)로 {label} 명세서를 보냈어요.
                  </p>
                  <p className="type-caption">보통 몇 분 안에 도착해요. 받은편지함에 없으면 스팸함도 확인해 주세요.</p>
                </>
              )}
            </div>
          </div>

          {notice && (
            <p role="alert" className="type-caption flex items-start gap-1.5 text-expense-ink">
              <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {step === 'sent' ? (
              <Button onClick={onClose}>닫기</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  취소
                </Button>
                {step === 'verified' && (
                  <Button onClick={send} loading={busy}>
                    보내기
                  </Button>
                )}
                {step === 'unverified' && (
                  <Button onClick={verify} loading={busy}>
                    인증 메일 보내기
                  </Button>
                )}
                {step === 'pending' && (
                  <Button onClick={recheck} loading={busy}>
                    인증했어요
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
