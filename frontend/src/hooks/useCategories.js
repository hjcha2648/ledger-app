import { useCallback, useEffect, useState } from 'react'
import { createCategory, listCategories } from '../api/categories'

// 기본 + 내 카테고리를 불러오고, 개인 카테고리 추가를 지원한다.
export default function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listCategories()
      .then((data) => !cancelled && setCategories(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((k) => k + 1)
  }, [])

  const addCategory = useCallback(async (data) => {
    const created = await createCategory(data)
    setCategories((prev) => [...prev, created])
    return created
  }, [])

  return { categories, loading, error, reload, addCategory }
}
