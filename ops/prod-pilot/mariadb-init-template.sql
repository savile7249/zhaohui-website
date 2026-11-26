-- =============================================================================
-- 兆辉多域名网站监测与管理后台 — 源站 MariaDB 10.11.14 独立隔离库初始化模板
-- -----------------------------------------------------------------------------
-- 严格隔离原则：
--   1. 新建独立库 `zhaohui_admin`（utf8mb4_unicode_ci），绝不触碰既有 `zhaohui_site`；
--   2. 应用账号 `zhaohui_admin_app@127.0.0.1` 仅授予 `zhaohui_admin.*` 权限；
--   3. 备份账号 `zhaohui_backup@localhost` 仅授予 `zhaohui_admin.*` 只读导出权限；
--   4. 执行前请将两个占位密码替换为强随机密码（≥20位），切勿将真实密码写入 Git。
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `zhaohui_admin`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 1. Django 应用专用账号（仅限 127.0.0.1，仅限 zhaohui_admin 库）
CREATE USER IF NOT EXISTS 'zhaohui_admin_app'@'127.0.0.1'
  IDENTIFIED BY '__REPLACE_WITH_STRONG_APP_DB_PASSWORD__';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES
  ON `zhaohui_admin`.*
  TO 'zhaohui_admin_app'@'127.0.0.1';

-- 2. 每日 mariadb-dump 逻辑备份专用只读账号（仅限本机 Unix Socket）
CREATE USER IF NOT EXISTS 'zhaohui_backup'@'localhost'
  IDENTIFIED BY '__REPLACE_WITH_STRONG_BACKUP_DB_PASSWORD__';

GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT
  ON `zhaohui_admin`.*
  TO 'zhaohui_backup'@'localhost';

FLUSH PRIVILEGES;

-- 核对隔离结果（应仅对 zhaohui_admin 授权，绝不包含 zhaohui_site）
SHOW GRANTS FOR 'zhaohui_admin_app'@'127.0.0.1';
SHOW GRANTS FOR 'zhaohui_backup'@'localhost';
