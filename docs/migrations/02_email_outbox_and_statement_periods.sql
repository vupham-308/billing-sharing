-- ==============================================================================
-- Migration: 02_email_outbox_and_statement_periods.sql
-- Description: Tạo bảng email_outbox, statement_periods, audit bảng trùng và drop invoice_digest_deliveries
-- Target Database: Microsoft SQL Server 2019+
-- ==============================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

-- 1. Xử lý kiểm toán xung đột dữ liệu trùng lặp trên payment_requests(sharing_member_id)
IF OBJECT_ID('dbo.payment_requests_conflict_audit', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.payment_requests_conflict_audit (
        audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        request_id UNIQUEIDENTIFIER NOT NULL,
        sharing_member_id UNIQUEIDENTIFIER NOT NULL,
        debtor_id UNIQUEIDENTIFIER NOT NULL,
        creditor_id UNIQUEIDENTIFIER NOT NULL,
        amount BIGINT NOT NULL,
        status VARCHAR(32) NOT NULL,
        note NVARCHAR(MAX),
        created_at DATETIME2,
        audited_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'[OK] Đã tạo bảng dbo.payment_requests_conflict_audit';
END

-- Kiểm tra nếu còn trùng lặp sharing_member_id
IF EXISTS (
    SELECT sharing_member_id 
    FROM dbo.payment_requests 
    WHERE sharing_member_id IS NOT NULL 
    GROUP BY sharing_member_id 
    HAVING COUNT(*) > 1
)
BEGIN
    INSERT INTO dbo.payment_requests_conflict_audit (
        request_id, sharing_member_id, debtor_id, creditor_id, amount, status, note, created_at
    )
    SELECT id, sharing_member_id, debtor_id, creditor_id, amount, status, note, created_at
    FROM dbo.payment_requests
    WHERE sharing_member_id IN (
        SELECT sharing_member_id 
        FROM dbo.payment_requests 
        WHERE sharing_member_id IS NOT NULL 
        GROUP BY sharing_member_id 
        HAVING COUNT(*) > 1
    );

    PRINT N'[FAIL-FAST] Phát hiện bản ghi trùng lặp sharing_member_id! Đã sao lưu vào dbo.payment_requests_conflict_audit.';
    ROLLBACK TRANSACTION;
    RAISERROR(N'DỪNG MIGRATION: Phát hiện dữ liệu trùng sharing_member_id. Vui lòng đối soát thủ công!', 16, 1);
    RETURN;
END
ELSE
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_payment_requests_sharing_member' 
          AND object_id = OBJECT_ID('dbo.payment_requests')
    )
    BEGIN
        ALTER TABLE dbo.payment_requests 
        ADD CONSTRAINT UQ_payment_requests_sharing_member UNIQUE (sharing_member_id);
        PRINT N'[OK] Đã thêm UNIQUE CONSTRAINT UQ_payment_requests_sharing_member';
    END
END

-- 2. Thêm cột version, confirmation_count, rejection_count vào payment_requests
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'version')
BEGIN
    ALTER TABLE dbo.payment_requests ADD version BIGINT NOT NULL DEFAULT 0;
    PRINT N'[OK] Đã thêm cột version vào dbo.payment_requests';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'confirmation_count')
BEGIN
    ALTER TABLE dbo.payment_requests ADD confirmation_count INT NOT NULL DEFAULT 0;
    PRINT N'[OK] Đã thêm cột confirmation_count vào dbo.payment_requests';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'rejection_count')
BEGIN
    ALTER TABLE dbo.payment_requests ADD rejection_count INT NOT NULL DEFAULT 0;
    PRINT N'[OK] Đã thêm cột rejection_count vào dbo.payment_requests';
END

-- 3. Thêm cột is_email_bounced vào dbo.users
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'is_email_bounced')
BEGIN
    ALTER TABLE dbo.users ADD is_email_bounced BIT NOT NULL DEFAULT 0;
    PRINT N'[OK] Đã thêm cột is_email_bounced vào dbo.users';
END

-- 4. Tạo bảng email_outbox (Bảng duy nhất quản lý gửi toàn bộ email)
IF OBJECT_ID('dbo.email_outbox', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.email_outbox (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        type VARCHAR(32) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name NVARCHAR(255),
        subject NVARCHAR(500) NOT NULL,
        html_content NVARCHAR(MAX) NOT NULL,
        payload_json NVARCHAR(MAX),
        business_key VARCHAR(190) NOT NULL,
        business_date DATE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        retry_count INT NOT NULL DEFAULT 0,
        max_retries INT NOT NULL DEFAULT 3,
        next_retry_at DATETIME2,
        http_call_initiated BIT NOT NULL DEFAULT 0,
        attempt_started_at DATETIME2,
        last_error NVARCHAR(MAX),
        provider_message_id VARCHAR(255),
        delivery_status VARCHAR(32),
        version BIGINT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        processed_at DATETIME2
    );

    CREATE UNIQUE INDEX UQ_email_outbox_business_key ON dbo.email_outbox (business_key);
    CREATE INDEX IX_email_outbox_status_retry ON dbo.email_outbox (status, next_retry_at);
    CREATE INDEX IX_email_outbox_provider_msg_id ON dbo.email_outbox (provider_message_id);
    CREATE INDEX IX_email_outbox_business_date ON dbo.email_outbox (business_date);

    PRINT N'[OK] Đã tạo bảng dbo.email_outbox và các Index';
END

-- 5. Tạo bảng statement_periods (Quản lý kỳ sao kê nhóm và Snapshot dữ liệu)
IF OBJECT_ID('dbo.statement_periods', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.statement_periods (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        group_id UNIQUEIDENTIFIER NOT NULL,
        period_number INT NOT NULL,
        start_date DATETIME2 NOT NULL,
        end_date DATETIME2 NOT NULL,
        snapshot_json NVARCHAR(MAX) NOT NULL,
        processed_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_statement_periods_group FOREIGN KEY (group_id) REFERENCES dbo.groups(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX UQ_statement_periods_group_range ON dbo.statement_periods (group_id, start_date, end_date);
    CREATE INDEX IX_statement_periods_group_period ON dbo.statement_periods (group_id, period_number DESC);

    PRINT N'[OK] Đã tạo bảng dbo.statement_periods';
END

-- 6. Xóa bỏ bảng cũ invoice_digest_deliveries
IF OBJECT_ID('dbo.invoice_digest_deliveries', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.invoice_digest_deliveries;
    PRINT N'[OK] Đã xóa bảng cũ dbo.invoice_digest_deliveries';
END

COMMIT TRANSACTION;
PRINT N'[SUCCESS] Migration hoàn tất thành công 100%!';
