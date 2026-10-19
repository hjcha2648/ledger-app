import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import AuthLayout from '../components/layout/AuthLayout'
import { fieldErrorsFrom } from '../utils/formErrors'
import Button from '../components/ui/Button'
import ErrorMessage from '../components/ui/ErrorMessage'
import Input from '../components/ui/Input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const MAX_PASSWORD = 64 // API 계약: password 8~64자

function validate({ email, password, confirm }) {
  const errors = {}
  if (!EMAIL_RE.test(email.trim())) errors.email = '올바른 이메일 형식이 아닙니다.'
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    errors.password = `비밀번호는 ${MIN_PASSWORD}~${MAX_PASSWORD}자여야 합니다.`
  }
  if (confirm !== password) errors.confirm = '비밀번호가 일치하지 않습니다.'
  return errors
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const errors = validate(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      await register({ email: form.email.trim(), password: form.password })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err))
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="회원가입"
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="focus-ring rounded font-semibold text-gem-ink underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-accent">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Input
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          error={fieldErrors.email}
          placeholder="you@example.com"
          autoFocus
        />
        <Input
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={onChange}
          error={fieldErrors.password}
          placeholder={`${MIN_PASSWORD}~${MAX_PASSWORD}자`}
          maxLength={MAX_PASSWORD + 1}
        />
        <Input
          label="비밀번호 확인"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={onChange}
          error={fieldErrors.confirm}
        />
        <ErrorMessage message={error} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '가입 중…' : '회원가입'}
        </Button>
      </form>
    </AuthLayout>
  )
}
