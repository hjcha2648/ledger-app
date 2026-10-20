import { useEffect, useState } from 'react'

// CSS 미디어 쿼리 일치 여부 (예: '(min-width: 640px)'). 화면 크기가 바뀌면 갱신된다.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
