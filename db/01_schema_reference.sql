-- 참조 DDL. 운영 테이블은 B의 SQLAlchemy create_all()로 만든다(PRD 4장).
-- 용도: (1) create_all 결과와 비교(SHOW CREATE TABLE), (2) 복원 테스트용 빈 스키마.
-- 운영 DB에 DROP·재생성하지 않는다.

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_id NULL = 시스템 기본 카테고리
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  user_id    BIGINT      NULL,
  name       VARCHAR(30) NOT NULL,
  type       VARCHAR(10) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT UTC_TIMESTAMP(),
  PRIMARY KEY (id),
  KEY ix_categories_user_id (user_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT ck_categories_type CHECK (type IN ('INCOME', 'EXPENSE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id             BIGINT       NOT NULL,
  name                VARCHAR(120) NOT NULL,
  category_id         BIGINT       NOT NULL,
  amount_krw          INT          NOT NULL,
  billing_cycle       VARCHAR(10)  NOT NULL,
  billing_anchor_date DATE         NOT NULL,
  registered_on       DATE         NOT NULL,
  synced_through      DATE         NOT NULL,
  memo                VARCHAR(500) NULL,
  created_at          DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
  PRIMARY KEY (id),
  KEY ix_subscriptions_user_id (user_id),
  KEY ix_subscriptions_category_id (category_id),
  CONSTRAINT fk_subscriptions_user     FOREIGN KEY (user_id)     REFERENCES users (id),
  CONSTRAINT fk_subscriptions_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_subscriptions_amount CHECK (amount_krw >= 1),
  CONSTRAINT ck_subscriptions_cycle  CHECK (billing_cycle IN ('WEEKLY', 'MONTHLY', 'YEARLY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- subscription_id·due_date가 모두 NOT NULL이면 자동 반영 거래.
-- 정기결제가 삭제되면 subscription_id만 NULL이 되고 due_date는 남아 "자동 생성 거래"임을 구분할 수 있다.
CREATE TABLE IF NOT EXISTS transactions (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  type            VARCHAR(10)  NOT NULL,
  amount_krw      INT          NOT NULL,
  occurred_on     DATE         NOT NULL,
  category_id     BIGINT       NOT NULL,
  merchant        VARCHAR(100) NULL,
  memo            VARCHAR(500) NULL,
  subscription_id BIGINT       NULL,
  due_date        DATE         NULL,
  created_at      DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(),
  updated_at      DATETIME     NOT NULL DEFAULT UTC_TIMESTAMP(), -- 수정 시 갱신은 앱(SQLAlchemy onupdate)이 UTC로 처리
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_subscription_due (subscription_id, due_date),
  KEY ix_transactions_user_occurred (user_id, occurred_on),
  KEY ix_transactions_category_id (category_id),
  CONSTRAINT fk_transactions_user         FOREIGN KEY (user_id)         REFERENCES users (id),
  CONSTRAINT fk_transactions_category     FOREIGN KEY (category_id)     REFERENCES categories (id),
  CONSTRAINT fk_transactions_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL,
  CONSTRAINT ck_transactions_type   CHECK (type IN ('INCOME', 'EXPENSE')),
  CONSTRAINT ck_transactions_amount CHECK (amount_krw >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
