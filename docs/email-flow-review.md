# Kiểm tra luồng mail và bổ sung thông báo hóa đơn mới

## Kết luận

Code hiện tại chưa hoàn thành toàn bộ kế hoạch email trước đó. Đã có Token dùng chung cho reset/xác thực email, đăng ký tài khoản chưa active, xác thực và gửi lại mail kích hoạt. Phần outbox, tổng hợp nhắc nợ và sao kê chính xác theo kỳ vẫn chưa hoàn chỉnh.

## Thay đổi trong lần này

- Thêm NewInvoiceNotificationService chạy 08:00 theo Asia/Ho_Chi_Minh.
- Lấy Transaction.createdAt trong khoảng [00:00 hôm qua, 00:00 hôm nay). Bao gồm 23:59:59 và phần lẻ giây; không lấy hóa đơn đúng 00:00 hôm nay.
- Chỉ lấy user active có TransactionSharingMember trong ít nhất một hóa đơn của khoảng đó và user không phải payer của hóa đơn đó. Nếu user chỉ là payer thì không gửi, kể cả có phần chia cho chính mình. Nếu có cả hai vai trò thì vẫn gửi nhưng số hóa đơn mới chỉ đếm hóa đơn do người khác trả. Share đã thanh toán vẫn thỏa điều kiện nếu user không phải payer.
- Gom tất cả nhóm thành một email/người/ngày hóa đơn, đếm số transaction phân biệt.
- Tổng còn nợ và còn được nhận được tính riêng từ các share chưa tất toán trên toàn bộ nhóm tại thời điểm lập mail; không dùng balance thuần vì balance bù trừ sẽ che mất việc một người vừa nợ vừa là chủ nợ.
- Tính cả khoản chưa đến ngày chốt nên chưa có PaymentRequest. Không tính phần payer tự chia cho mình.
- Khoản chờ duyệt vẫn là công nợ chưa tất toán; email giải thích rõ không cần chuyển lại nếu đã chuyển và chờ duyệt. Mail này là thông báo tổng quan, không phải yêu cầu chuyển toàn bộ số dư.
- Thêm invoice_digest_deliveries, khóa duy nhất (user_id, invoice_date). Claim được commit trước khi gọi Brevo; không giữ transaction đọc dữ liệu trong lúc gửi HTTP.
- Trạng thái SENDING → ACCEPTED khi Brevo chấp nhận; UNKNOWN khi gửi gặp lỗi. ACCEPTED không đồng nghĩa đã giao tới Inbox. Không tự gửi lại UNKNOWN để tránh trùng khi phản hồi nhà cung cấp bị mất.
- Thông báo hóa đơn mới lúc 08:00, sao kê lúc 08:30 theo lịch nhóm, nhắc nợ lúc 09:00; cố định zone cho các job và job dọn token. JVM mặc định UTC+7 khi khởi động qua main.
- Bỏ nhánh mock. Thiếu API key hoặc lỗi gửi phát sinh lỗi thực sự; không ghi log toàn bộ HTML/token hoặc response body từ nhà cung cấp.
- Escape nội dung động trong mail, đóng stream đọc template; template thiếu báo lỗi thay vì dùng nhầm template reset cho mail kích hoạt.

## Các vấn đề còn lại trong luồng cũ

1. **P1 — QR sao kê chưa khớp tổng:** ScheduledTaskService.processSummaryForGroup cộng nhiều khoản nhưng chỉ truyền QR của khoản đầu tiên có thông tin ngân hàng. Cần nội dung/QR theo từng request.
2. **P1 — Sao kê vẫn tính khoản chờ duyệt vào tiền cần thanh toán:** query isPaid=false không loại WAITING_APPROVE; cần tách số tiền cần chuyển và chờ duyệt.
3. **P1 — Chưa có outbox chung:** AuthService và job sao kê vẫn gửi trong transaction nghiệp vụ; mail có thể được nhà cung cấp chấp nhận trước khi DB commit thất bại. Thay đổi báo lỗi lần này không giải quyết tính nguyên tử giữa DB và nhà cung cấp.
4. **P2 — Nhắc nợ 09:00 chưa gom:** vẫn một mail/request PENDING, chưa có khóa người nhận/ngày. Khóa chống trùng mới chỉ áp dụng cho thông báo hóa đơn mới 08:00.
5. **P2 — Chưa có kỳ sao kê và chạy bù:** sao kê vẫn lấy tất cả share chưa thanh toán, chưa lưu đầu kỳ/cuối kỳ hoặc lịch sử kỳ đã chốt. Cron bị bỏ lỡ khi app dừng vẫn chưa tự chạy bù.
6. **P2 — Chưa có theo dõi giao thư và phục hồi:** chưa lưu message ID/webhook delivery/bounce cho luồng chung; chưa có retry có phân loại hoặc UI gửi lại. Bản ghi SENDING bị bỏ lại khi crash và UNKNOWN cần đối soát thủ công; không tự coi chúng là chưa gửi.
7. **P2 — Thông báo nghiệp vụ còn thiếu:** confirm/approve/reject payment và đổi mật khẩu thành công chưa phát sinh mail.
8. **P2 — Nội dung chuyển khoản cũ:** các luồng thanh toán hiện tại vẫn dùng ghi chú theo hóa đơn, chưa thống nhất tên người nợ không dấu + chuyen tien.
9. **P2 — Thiếu kiểm tra cấu hình ngay startup:** hiện thiếu key báo lỗi khi có yêu cầu gửi, chưa làm fail-fast khi khởi động.

## Vận hành và phạm vi kiểm chứng

- Bảng invoice_digest_deliveries mới được tạo theo cơ chế spring.jpa.hibernate.ddl-auto=update hiện có; nếu môi trường tắt tự cập nhật schema phải tạo bảng/unique constraint trước chạy job.
- Dữ liệu created_at đang dùng LocalDateTime không có timezone. Cần xác nhận dữ liệu lịch sử trên máy triển khai đã lưu theo giờ Việt Nam trước khi đổi JVM từ UTC sang +7; không tự sửa giờ dữ liệu lịch sử trong lần này.
- Các job lần lượt được lên lịch lúc 08:00, 08:30 và 09:00; thời điểm thực tế thư đến còn tùy thời gian xử lý/nhà cung cấp.
- Không gọi Brevo thật, không khởi động ứng dụng với DB production, không gửi mail tới người dùng trong lúc kiểm tra.
- 31 unit test đã chạy thành công, gồm 10 test mới cho service/email.
- 3 integration test H2 đã chạy thành công: ranh giới ngày và user active, công nợ hai chiều, unique constraint chống trùng. H2 không thay thế kiểm chứng SQL Server production.
- Các thay đổi GroupService, GroupServiceTest và frontend đã có sẵn trước lần làm việc này được giữ nguyên.

## File chính

- be/src/main/java/com/kai/billingsharing/service/NewInvoiceNotificationService.java
- be/src/main/java/com/kai/billingsharing/service/NewInvoiceDigestReader.java
- be/src/main/java/com/kai/billingsharing/entity/InvoiceDigestDelivery.java
- be/src/main/java/com/kai/billingsharing/repository/TransactionSharingMemberRepository.java
- be/src/main/java/com/kai/billingsharing/service/EmailService.java
