-- ==============================================================================
-- Migration: 03_pairwise_debt_netting.sql
-- Description: Hỗ trợ gộp mã QR theo chủ nợ và Cấn trừ nợ chéo 2 chiều (Pairwise Debt Netting)
-- Target Database: Microsoft SQL Server 2019+
-- Lưu ý: Dùng EXEC() cho DDL/DML cột mới để tránh lỗi Deferred Compile (Msg 207: Invalid column name)
-- ==============================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

BEGIN TRY
    -- 1. Xóa bỏ tất cả UNIQUE CONSTRAINT / UNIQUE INDEX trên sharing_member_id trong payment_requests (nếu có)
    DECLARE @CName NVARCHAR(200);
    SELECT TOP 1 @CName = kc.name
    FROM sys.key_constraints kc
    JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE kc.parent_object_id = OBJECT_ID('dbo.payment_requests')
      AND c.name = 'sharing_member_id';

    WHILE @CName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests DROP CONSTRAINT ' + @CName);
        PRINT N'[OK] Đã xóa UNIQUE CONSTRAINT: ' + @CName;
        SET @CName = NULL;

        SELECT TOP 1 @CName = kc.name
        FROM sys.key_constraints kc
        JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE kc.parent_object_id = OBJECT_ID('dbo.payment_requests')
          AND c.name = 'sharing_member_id';
    END

    DECLARE @IName NVARCHAR(200);
    SELECT TOP 1 @IName = i.name
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.payment_requests')
      AND c.name = 'sharing_member_id'
      AND i.is_unique = 1
      AND i.is_primary_key = 0;

    WHILE @IName IS NOT NULL
    BEGIN
        EXEC('DROP INDEX ' + @IName + ' ON dbo.payment_requests');
        PRINT N'[OK] Đã xóa UNIQUE INDEX: ' + @IName;
        SET @IName = NULL;

        SELECT TOP 1 @IName = i.name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID('dbo.payment_requests')
          AND c.name = 'sharing_member_id'
          AND i.is_unique = 1
          AND i.is_primary_key = 0;
    END

    -- 2. Cho phép sharing_member_id và transaction_id nhận giá trị NULL (cho các giao dịch gộp/bù trừ)
    ALTER TABLE dbo.payment_requests ALTER COLUMN sharing_member_id UNIQUEIDENTIFIER NULL;
    PRINT N'[OK] Đã chuyển dbo.payment_requests.sharing_member_id sang NULL';

    ALTER TABLE dbo.payment_requests ALTER COLUMN transaction_id UNIQUEIDENTIFIER NULL;
    PRINT N'[OK] Đã chuyển dbo.payment_requests.transaction_id sang NULL';

    -- 3. Bổ sung các cột mới vào dbo.payment_requests (sử dụng EXEC() để tránh lỗi compile time binding)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'group_id')
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests ADD group_id UNIQUEIDENTIFIER NULL');
        PRINT N'[OK] Đã thêm cột group_id vào dbo.payment_requests';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_payment_requests_group')
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests ADD CONSTRAINT FK_payment_requests_group FOREIGN KEY (group_id) REFERENCES dbo.groups(id)');
        PRINT N'[OK] Đã thêm khóa ngoại FK_payment_requests_group';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_payment_requests_group_id' AND object_id = OBJECT_ID('dbo.payment_requests'))
    BEGIN
        EXEC('CREATE INDEX IX_payment_requests_group_id ON dbo.payment_requests (group_id)');
        PRINT N'[OK] Đã tạo index IX_payment_requests_group_id';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'original_amount')
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests ADD original_amount BIGINT NULL');
        PRINT N'[OK] Đã thêm cột original_amount vào dbo.payment_requests';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'netted_amount')
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests ADD netted_amount BIGINT NULL');
        PRINT N'[OK] Đã thêm cột netted_amount vào dbo.payment_requests';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payment_requests') AND name = 'breakdown_json')
    BEGIN
        EXEC('ALTER TABLE dbo.payment_requests ADD breakdown_json NVARCHAR(MAX) NULL');
        PRINT N'[OK] Đã thêm cột breakdown_json vào dbo.payment_requests';
    END

    -- 4. Tạo bảng liên kết Nhiều - Nhiều: payment_request_shares
    IF OBJECT_ID('dbo.payment_request_shares', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.payment_request_shares (
            payment_request_id UNIQUEIDENTIFIER NOT NULL,
            sharing_member_id UNIQUEIDENTIFIER NOT NULL,
            CONSTRAINT PK_payment_request_shares PRIMARY KEY (payment_request_id, sharing_member_id),
            CONSTRAINT FK_prs_payment_request FOREIGN KEY (payment_request_id) REFERENCES dbo.payment_requests(id) ON DELETE CASCADE,
            CONSTRAINT FK_prs_sharing_member FOREIGN KEY (sharing_member_id) REFERENCES dbo.transaction_sharing_members(id)
        );

        CREATE INDEX IX_prs_sharing_member_id ON dbo.payment_request_shares (sharing_member_id);
        PRINT N'[OK] Đã tạo bảng dbo.payment_request_shares và các Index';
    END

    -- 5. Backfill dữ liệu lịch sử tương thích ngược (sử dụng EXEC() để tránh Msg 207)
    -- A. Đồng bộ group_id từ transaction cho các payment_request cũ
    EXEC('
        UPDATE pr
        SET pr.group_id = t.group_id
        FROM dbo.payment_requests pr
        INNER JOIN dbo.transactions t ON pr.transaction_id = t.id
        WHERE pr.group_id IS NULL;
    ');
    PRINT N'[OK] Đã backfill group_id cho các payment_requests hiện có';

    -- B. Đồng bộ original_amount = amount, netted_amount = 0 nếu chưa có
    EXEC('
        UPDATE dbo.payment_requests
        SET original_amount = amount,
            netted_amount = 0
        WHERE original_amount IS NULL;
    ');
    PRINT N'[OK] Đã backfill original_amount và netted_amount';

    -- C. Chuyển mapping 1-1 cũ của sharing_member_id vào bảng payment_request_shares
    EXEC('
        INSERT INTO dbo.payment_request_shares (payment_request_id, sharing_member_id)
        SELECT pr.id, pr.sharing_member_id
        FROM dbo.payment_requests pr
        WHERE pr.sharing_member_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM dbo.payment_request_shares ps
              WHERE ps.payment_request_id = pr.id AND ps.sharing_member_id = pr.sharing_member_id
          );
    ');
    PRINT N'[OK] Đã chuyển mapping cũ vào dbo.payment_request_shares';

    COMMIT TRANSACTION;
    PRINT N'[SUCCESS] Migration 03_pairwise_debt_netting.sql hoàn tất thành công 100%!';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();

    PRINT N'[ERROR] Có lỗi xảy ra trong quá trình migration: ' + @ErrorMessage;
    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
