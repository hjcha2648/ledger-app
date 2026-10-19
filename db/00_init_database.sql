-- 관리자 권한(sudo mariadb, 소켓 인증)으로 실행한다. 앱 계정으로 실행하지 않는다.
-- 기준: docs/ai-infra.md "EC2 작업 체크리스트" 4번 (DB 이름·계정 이름 ledger_db / app_user)
--
-- 앱 계정은 이 파일 실행 전에 직접 만든다. 비밀번호가 파일·쉘 기록에 남지 않게
-- `sudo mariadb` 대화형 프롬프트에서 같은 비밀번호로 두 계정을 만든다:
--   CREATE USER 'app_user'@'localhost'  IDENTIFIED BY '<DB_PASSWORD>';
--   CREATE USER 'app_user'@'127.0.0.1'  IDENTIFIED BY '<DB_PASSWORD>';
-- (127.0.0.1로 접속해도 서버가 호스트를 localhost로 해석하는 경우가 있어 둘 다 만든다)

CREATE DATABASE IF NOT EXISTS ledger_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 해당 DB에만 부여한다. DROP·GRANT OPTION·FILE·*.* 권한은 주지 않는다.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON ledger_db.* TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON ledger_db.* TO 'app_user'@'127.0.0.1';

FLUSH PRIVILEGES;
