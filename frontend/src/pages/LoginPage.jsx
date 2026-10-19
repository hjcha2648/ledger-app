import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login as loginRequest } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import ErrorMessage from '../components/ui/ErrorMessage'
import Input from '../components/ui/Input'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const registered = location.state?.registered
  const redirectTo = location.state?.from?.pathname ?? '/home'

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email.trim() || !form.password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    setLoading(true)
    try {
      const { access_token } = await loginRequest({ email: form.email.trim(), password: form.password })
      login(access_token)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="로그인"
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to="/register" className="focus-ring rounded font-semibold text-gem-ink underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-accent">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {registered && (
          <p role="status" className="rounded-2xl border border-accent/15 bg-accent-soft/60 px-4 py-3 text-sm text-gem-ink">
            회원가입이 완료되었습니다. 로그인해 주세요.
          </p>
        )}
        <Input
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          placeholder="you@example.com"
          autoFocus
        />
        <Input
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
        />
        <ErrorMessage message={error} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </AuthLayout>
  )
}
