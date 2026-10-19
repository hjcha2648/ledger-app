-- 참조 DDL. 운영 테이블은 B의 SQLAlchemy create_all()(`python -m app.init_db`)로 만든다.
-- 기준: backend/app/models.py (PRD v3.2 — 정기결제는 목록 관리용, transactions와 관계 없음)
-- 용도: (1) create_all 결과와 비교(SHOW CREATE TABLE), (2) 복원 테스트용 빈 스키마.
-- 운영 DB에 DROP·재생성하지 않는다. 모델이 바뀌면 이 파일도 함께 갱신한다.
-- created_at·updated_at은 DB 기본값 없이 앱이 UTC로 채운다.

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_id NULL = 시스템 기본 카테고리
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  user_id    BIGINT      NULL,
  name       VARCHAR(30) NOT NULL,
  type       VARCHAR(10) NOT NULL,
  created_at DATETIME    NOT NULL,
  PRIMARY KEY (id),
  KEY ix_categories_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT ck_categories_type CHECK (type IN ('INCOME', 'EXPENSE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  type        VARCHAR(10)  NOT NULL,
  amount_krw  INT          NOT NULL,
  occurred_on DATE         NOT NULL,
  category_id BIGINT       NOT NULL,
  merchant    VARCHAR(100) NULL,
  memo        VARCHAR(500) NULL,
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY category_id (category_id),
  KEY ix_transactions_user_occurred (user_id, occurred_on),
  FOREIGN KEY (user_id)     REFERENCES users (id),
  FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_transactions_type   CHECK (type IN ('INCOME', 'EXPENSE')),
  CONSTRAINT ck_transactions_amount CHECK (amount_krw >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 목록 관리용. 결제일 계산·자동 반영 없음(AGENTS.md 반드시 지킬 것 4)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id             BIGINT       NOT NULL,
  name                VARCHAR(120) NOT NULL,
  category_id         BIGINT       NOT NULL,
  amount_krw          INT          NOT NULL,
  billing_cycle       VARCHAR(10)  NOT NULL,
  billing_anchor_date DATE         NOT NULL,
  memo                VARCHAR(500) NULL,
  created_at          DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY category_id (category_id),
  KEY ix_subscriptions_user_id (user_id),
  FOREIGN KEY (user_id)     REFERENCES users (id),
  FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_subscriptions_cycle  CHECK (billing_cycle IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
  CONSTRAINT ck_subscriptions_amount CHECK (amount_krw >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
