-- 시스템 기본 카테고리(user_id NULL). 여러 번 실행해도 중복 삽입되지 않는다.
-- B의 시드 코드가 정식 방법이면 이 파일은 비교·복구용 참조로만 쓴다.

INSERT INTO categories (user_id, name, type)
SELECT NULL, v.name, v.type
FROM (
  SELECT '식비' AS name, 'EXPENSE' AS type UNION ALL
  SELECT '교통', 'EXPENSE' UNION ALL
  SELECT '주거·통신', 'EXPENSE' UNION ALL
  SELECT '쇼핑', 'EXPENSE' UNION ALL
  SELECT '여가·문화', 'EXPENSE' UNION ALL
  SELECT '의료·건강', 'EXPENSE' UNION ALL
  SELECT '교육', 'EXPENSE' UNION ALL
  SELECT '구독·정기결제', 'EXPENSE' UNION ALL
  SELECT '기타지출', 'EXPENSE' UNION ALL
  SELECT '급여', 'INCOME' UNION ALL
  SELECT '용돈', 'INCOME' UNION ALL
  SELECT '부수입', 'INCOME' UNION ALL
  SELECT '기타수입', 'INCOME'
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.user_id IS NULL AND c.name = v.name AND c.type = v.type
);
