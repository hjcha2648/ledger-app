-- 관리자 권한(sudo mariadb, 소켓 인증)으로 실행한다. 앱 계정으로 실행하지 않는다.
-- 앱 계정은 이 파일 실행 전에 직접 만든다(비밀번호가 파일·쉘 기록에 남지 않게 대화형으로 입력):
--   CREATE USER 'app_user'@'127.0.0.1' IDENTIFIED BY '<password>';
-- DB 이름·계정 이름은 PLAN.md 2.2 확정값으로 바꾼다.

CREATE DATABASE IF NOT EXISTS ledger_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 해당 DB에만, DROP·GRANT·FILE 등은 주지 않는다. 스키마 변경(ALTER)은 관리자가 수행한다.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON ledger_db.* TO 'app_user'@'127.0.0.1';

FLUSH PRIVILEGES;
