# Kế hoạch triển khai luồng email

Trạng thái: đã thống nhất phạm vi, chưa triển khai mã nguồn.

## 1. Quyết định nghiệp vụ đã chốt

- Toàn hệ thống sử dụng múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
- Ngày chốt chỉ được là số nguyên từ 1 đến 27. Giữ khả năng chọn nhiều ngày. Backend từ chối giá trị không hợp lệ; không âm thầm lọc hoặc đổi thành ngày khác.
- 08:00: chốt và gửi sao kê theo lịch của nhóm.
- 09:00: gửi nhắc nợ, gom tất cả khoản PENDING của một người trong mọi nhóm vào một email duy nhất trong ngày.
- Mỗi PaymentRequest có phần nội dung và QR riêng trong email tổng hợp. Không dùng QR của một khoản để đại diện tổng nhiều khoản.
- WAITING_APPROVE không được đưa vào số tiền yêu cầu chuyển lại; COMPLETED không được nhắc nợ.
- Giới hạn một email/ngày chỉ áp dụng cho nhắc nợ. Sao kê, kích hoạt tài khoản, reset mật khẩu và thông báo sự kiện được xử lý riêng.
- Request phát sinh sau khi đã gửi nhắc nợ được đưa vào ngày tiếp theo.
- Sau downtime: chạy bù nghiệp vụ và gửi bản nhắc nợ hiện tại, không gửi dồn các bản nhắc của ngày cũ.
- Nội dung chuyển khoản: tên người nợ không dấu + ` chuyen tien`, chuẩn hóa khoảng trắng. Ví dụ: `Nguyen Van An chuyen tien`.
- Thông tin ngân hàng dạng chữ và kỳ sao kê chi tiết chỉ hiển thị trên web. Email vẫn có số tiền, người nhận, QR và nút mở yêu cầu.
- Kỳ sao kê tính từ lần chốt trước đến lần chốt hiện tại; phân biệt nợ tồn và phát sinh trong kỳ.
- Bỏ hoàn toàn mock mail. Lỗi phải được ghi nhận đúng, không báo gửi thành công.
- Không làm tùy chọn tần suất nhận nhắc nợ.
- Hoãn mở rộng bảo mật reset mật khẩu như hash token, cooldown reset và thu hồi các token reset liên quan.
- Hệ thống mới, không cần duy trì chính sách tương thích cho tài khoản cũ.

## 2. Kiến trúc

Sử dụng SQL Server hiện có, transactional outbox và worker Spring Boot; chưa cần Redis/RabbitMQ.

Luồng: thao tác nghiệp vụ → lưu dữ liệu và outbox cùng transaction → commit → worker nhận việc → gọi Brevo → lưu kết quả.

Tách trạng thái xử lý gửi khỏi trạng thái giao thư. Nhà cung cấp tiếp nhận không đồng nghĩa thư đã vào Inbox hoặc đã được đọc.

## 3. Các giai đoạn triển khai

### Giai đoạn 1 — Schema, Token và kích hoạt tài khoản

- [ ] Viết migration có phiên bản thay vì chỉ dựa vào Hibernate tự cập nhật schema cho đổi tên bảng.
- [ ] Đổi entity PasswordResetToken thành Token và bảng thành tokens; chuyển repository và tác vụ dọn token.
- [ ] Giữ các field id, token, user, expiryDate, used, createdAt; thêm type với PASSWORD_RESET và EMAIL_VERIFICATION.
- [ ] Nếu có dữ liệu token hiện hữu, chuyển sang type PASSWORD_RESET; không làm mất dữ liệu ngoài phạm vi migration.
- [ ] Mọi truy vấn sử dụng token phải kiểm tra type, hạn dùng và used.
- [ ] Sử dụng lại User.isActive đã tồn tại; đăng ký thường tạo isActive=false, không cấp phiên truy cập sử dụng được trước kích hoạt.
- [ ] Tạo token xác thực email và outbox cùng transaction đăng ký.
- [ ] Thêm API/trang kích hoạt; cập nhật isActive và used nguyên tử. Mở link chỉ hiển thị trang, người dùng xác nhận mới thực hiện kích hoạt.
- [ ] Bổ sung gửi lại mail kích hoạt có giới hạn gửi; tài khoản active không được gửi lại kích hoạt.
- [ ] Tài khoản Google mới có email đã xác minh được active; không tự mở khóa một tài khoản đã bị vô hiệu hóa chỉ vì đăng nhập Google.
- [ ] Frontend đăng ký hiển thị hướng dẫn kiểm tra email, trạng thái xác thực và lỗi hết hạn/đã dùng.

Mặc định triển khai đề xuất: token kích hoạt có hạn 24 giờ; token reset giữ 15 phút. Chưa triển khai các thay đổi bảo mật reset đã hoãn.

Tiêu chí nghiệm thu: token kích hoạt không dùng được cho reset và ngược lại; user chưa active không truy cập API cần đăng nhập; kích hoạt hợp lệ cho phép đăng nhập.

### Giai đoạn 2 — Thời gian và kỳ sao kê

- [ ] Thiết lập timezone JVM, cron và Clock dùng chung theo UTC+7; rà soát các chỗ lấy ngày giờ liên quan.
- [ ] Đồng bộ cấu hình deploy, không phụ thuộc timezone máy chủ.
- [ ] Frontend chỉ cho chọn 1–27; backend validate từng phần tử, xử lý trùng và quy định mặc định nhất quán.
- [ ] Kiểm tra dữ liệu ngày chốt ngoài 1–27 nếu có; báo rõ để xử lý, không tự đổi ngày.
- [ ] Lưu kỳ sao kê với mốc bắt đầu/kết thúc, thời điểm xử lý và khóa duy nhất theo nhóm/kỳ.
- [ ] Dùng khoảng thời gian không chồng lấn để phân loại phát sinh giữa các kỳ; kỳ đầu bắt đầu từ thời điểm tạo nhóm.
- [ ] Tách nợ tồn, phát sinh và khoản chờ duyệt; lưu dữ liệu cần thiết để xem lại sao kê lịch sử.
- [ ] Ghi nhận kỳ chưa chạy để có thể chạy bù sau downtime, không tạo lại kỳ đã xử lý.

Tiêu chí nghiệm thu: chỉ nhận ngày 1–27; ngày nghiệp vụ đúng UTC+7; không thiếu hoặc đếm hai lần phát sinh ở ranh giới kỳ.

### Giai đoạn 3 — Công nợ, tổng hợp email và QR

- [ ] Giữ request riêng cho từng khoản; kiểm tra dữ liệu trùng trước khi thêm unique constraint cho sharing_member_id.
- [ ] Query nhắc nợ chỉ lấy PENDING, gom theo người nợ trên toàn bộ nhóm.
- [ ] Render mỗi request với số tiền, người nhận, QR và nút mở yêu cầu; tổ chức theo nhóm để dễ đọc.
- [ ] Loại WAITING_APPROVE khỏi số tiền cần chuyển; hiển thị riêng trạng thái này trong sao kê trên web.
- [ ] Chuẩn hóa tên tiếng Việt không dấu, gồm đ/Đ, và khoảng trắng để tạo nội dung chuyển khoản thống nhất.
- [ ] Kiểm tra lại trạng thái request trước khi gửi; nếu không còn khoản cần nhắc thì bỏ công việc gửi.
- [ ] Không gửi email rỗng khi mọi khoản đã được xử lý.

Tiêu chí nghiệm thu: hai khoản thuộc hai chủ nợ tạo hai QR đúng trong một email; cùng một người ở nhiều nhóm chỉ có một bản nhắc/ngày.

### Giai đoạn 4 — Outbox, chống trùng và lỗi

- [ ] Tạo outbox lưu loại mail, user/người nhận, ngày nghiệp vụ, các định danh nghiệp vụ, trạng thái, số lần thử, lần thử kế tiếp, lỗi và mã thư nhà cung cấp.
- [ ] Tạo khóa duy nhất cho nhắc nợ theo user/ngày UTC+7; mail sự kiện có khóa riêng theo sự kiện, sao kê theo kỳ/người nhận.
- [ ] Worker nhận việc bằng khóa/cập nhật nguyên tử; có cơ chế phục hồi công việc đang xử lý khi tiến trình chết.
- [ ] Gửi HTTP ngoài transaction nghiệp vụ dài; dùng HttpClient tái sử dụng và timeout rõ ràng.
- [ ] Reset mật khẩu được xử lý ngay, không chờ cron nhắc nợ; không gửi link đã hết hạn.
- [ ] Phân loại lỗi cấu hình/dữ liệu vĩnh viễn, lỗi tạm thời và kết quả chưa rõ.
- [ ] Retry có giới hạn, backoff và tuân thủ thời gian chờ của nhà cung cấp; không tạo một mail logic mới khi retry.
- [ ] Khi timeout không biết Brevo đã tiếp nhận chưa, chuyển UNKNOWN, không tự retry mù quáng.
- [ ] Kiểm chứng khả năng chống trùng/tra cứu của Brevo trước khi chọn cơ chế phục hồi UNKNOWN.
- [ ] Xóa toàn bộ mock; thiếu cấu hình bắt buộc phải báo lỗi khởi động.
- [ ] Không log toàn bộ HTML, link reset, token hoặc khóa API. Không lưu token nhạy cảm vào lịch sử có thể xem tự do.
- [ ] Sau downtime, gửi bản nhắc của ngày hiện tại, không gửi dồn ngày cũ. Request phát sinh sau bản đã gửi để sang ngày sau.

Giới hạn kỹ thuật: unique DB chống tạo hai công việc, nhưng không tự bảo đảm giao email đúng một lần nếu nhà cung cấp đã nhận mà phản hồi bị mất. Ưu tiên tránh gửi trùng và lưu UNKNOWN để đối soát.

### Giai đoạn 5 — Web và template

- [ ] Thêm route mở đúng PaymentRequest từ email.
- [ ] Sau đăng nhập, quay lại đúng route; kiểm tra quyền ở backend, không dựa vào việc biết ID.
- [ ] Người nợ được xác nhận chuyển; chủ nợ được duyệt/từ chối theo trạng thái; người khác không được truy cập.
- [ ] Email cũ mở ra trạng thái mới nhất; link GET không tự thực hiện thanh toán hoặc duyệt.
- [ ] Hiển thị thông tin ngân hàng dạng chữ, nội dung chuyển khoản và kỳ sao kê chi tiết trên web.
- [ ] Template có escape mặc định cho tên, nhóm, tiêu đề, ghi chú; xử lý URL an toàn trong thuộc tính HTML.
- [ ] Kiểm tra hiển thị email trên màn hình nhỏ và khi ảnh QR không tải được; vẫn có nút mở web.

### Giai đoạn 6 — Thông báo nghiệp vụ bổ sung

- [ ] Kích hoạt email sau đăng ký thường.
- [ ] Báo chủ nợ khi người nợ xác nhận đã chuyển.
- [ ] Báo người nợ khi chủ nợ duyệt hoặc từ chối.
- [ ] Thông báo đổi mật khẩu thành công.
- [ ] Tạo các thông báo từ sự kiện nghiệp vụ đã commit, có khóa chống trùng riêng.
- [ ] Không lặp hằng ngày các mail sự kiện, sao kê hoặc quên mật khẩu; retry kỹ thuật có kiểm soát không phải một lịch nhắc mới.

### Giai đoạn 7 — Lịch sử gửi và webhook

- [ ] Lưu lịch sử gửi và từng lần thử, liên kết tới user/request/kỳ; không lộ bí mật trong giao diện.
- [ ] Lưu message ID Brevo để tra cứu và nối sự kiện giao thư về đúng email.
- [ ] Tạo endpoint nhận webhook, xác thực nguồn theo cơ chế Brevo hỗ trợ; chống xử lý sự kiện trùng và sai thứ tự.
- [ ] Lưu delivery riêng với accepted; không diễn giải delivery thành người dùng đã đọc.
- [ ] Xử lý bounce: lỗi vĩnh viễn dừng gửi tới địa chỉ có vấn đề và báo cần kiểm tra; lỗi tạm thời theo chính sách retry, tránh nhân đôi với retry của nhà cung cấp.
- [ ] Màn hình quản trị tra cứu theo người nhận, loại mail, thời gian và trạng thái; gửi lại có kiểm soát, vẫn giữ quy tắc chống trùng nhắc nợ.
- [ ] Theo dõi hàng đợi tồn, lỗi gửi và UNKNOWN để vận hành phát hiện vấn đề.

## 4. Giải thích chức năng

### Nút mở đúng yêu cầu thanh toán

Mỗi request trong email có nút mở trang riêng của request. Nếu chưa đăng nhập, người dùng đăng nhập rồi quay lại đúng trang. Trang kiểm tra quyền, hiển thị dữ liệu hiện tại và hành động hợp lệ. Việc mở link không tự xác nhận thanh toán; email cũ không thể khiến khoản đã hoàn tất tiếp tục bị yêu cầu chuyển.

### Lịch sử gửi, message ID, delivery và bounce

- Lịch sử gửi trả lời email đã được tạo/gửi/thử lại khi nào và lỗi gì.
- Message ID là mã do nhà cung cấp trả về để đối soát; không phải bằng chứng người nhận đã đọc.
- Delivery biểu thị thư được giao tới máy chủ thư bên nhận, không bảo đảm vào Inbox.
- Bounce là thư bị trả lại. Cần phân biệt địa chỉ không tồn tại với vấn đề tạm thời.
- Webhook đưa các sự kiện này về hệ thống để cập nhật lịch sử tự động.

## 5. Kiểm thử và nghiệm thu

- [ ] Đăng ký → nhận token → kích hoạt → đăng nhập; token sai loại/hết hạn/đã dùng.
- [ ] Google có email xác minh và tài khoản không active.
- [ ] Ngày 0, 28, 31 bị từ chối; ngày 1 và 27 hợp lệ; danh sách có phần tử lỗi không bị âm thầm lọc.
- [ ] Một người, nhiều request, nhiều chủ nợ và nhiều nhóm → một email nhắc/ngày với đúng từng QR.
- [ ] WAITING_APPROVE/COMPLETED không bị nhắc chuyển; khoản thay đổi trạng thái trước lúc gửi được loại.
- [ ] Request mới sau lúc gửi được xử lý ngày sau; sao kê 08:00 vẫn độc lập với nhắc nợ 09:00.
- [ ] Hai worker hoặc hai instance không tạo/gửi trùng công việc thông thường.
- [ ] Rollback DB không phát sinh email; restart không làm mất công việc chờ gửi.
- [ ] HTTP lỗi, timeout không rõ kết quả, giới hạn retry, token reset hết hạn trong hàng đợi.
- [ ] Biên ngày UTC+7, ranh giới kỳ, chạy bù sau downtime.
- [ ] Tên/ghi chú chứa HTML không chèn nội dung vào template.
- [ ] Deep link yêu cầu đăng nhập và đúng quyền; email cũ mở trạng thái hiện tại.
- [ ] Webhook giả, trùng, sai thứ tự; accepted/delivered/bounced được phân biệt.
- [ ] Chạy lại các test nghiệp vụ hiện có; kiểm tra migration và cấu hình deploy trước phát hành.

## 6. Điểm cần xác minh trong lúc triển khai

Không còn câu hỏi bắt buộc về các quyết định đã chốt. Những điểm kỹ thuật cần kiểm chứng:

- Khả năng chống trùng, tra cứu message và xác thực webhook thực tế của Brevo.
- Schema/dữ liệu hiện tại trước migration, đặc biệt ngày chốt ngoài 1–27 và request trùng.
- Chính sách gửi sao kê khi chạy bù qua nhiều kỳ: đề xuất lưu đủ các kỳ nhưng gửi một thông báo dẫn tới các sao kê mới được tạo, tránh gửi dồn nhiều email.
- Token kích hoạt 24 giờ và chính sách giới hạn gửi lại là mặc định đề xuất để triển khai, chưa phải con số do người dùng chỉ định.

## 7. Thứ tự thực hiện

1. Schema Token và kích hoạt tài khoản.
2. Timezone, ngày chốt và dữ liệu kỳ sao kê.
3. Sửa công nợ, tổng hợp request và QR.
4. Outbox, worker, retry và chống trùng.
5. Web, deep link và template an toàn.
6. Thông báo nghiệp vụ bổ sung.
7. Lịch sử gửi, webhook và vận hành.
8. Kiểm thử tổng thể, migration và triển khai.

Các giai đoạn có phụ thuộc được tích hợp trước phát hành: không phát hành luồng kích hoạt hoặc thông báo mới khi outbox và xử lý lỗi chưa hoàn tất.
