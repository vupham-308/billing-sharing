import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Key,
  Copy,
  Check,
  ZoomIn,
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  CreditCard,
  ChevronRight,
  Info,
  RefreshCw,
  Zap,
} from "lucide-react";

export default function SepayGuide() {
  const navigate = useNavigate();

  // Mặc định tạo 1 khóa 128-bit (16 bytes = 32 hex chars)
  const generateKey = () => {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const [apiKey, setApiKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPrefix, setCopiedPrefix] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState(null);

  useEffect(() => {
    setApiKey(generateKey());
  }, []);

  const webhookUrl = "https://api.kaidz.xyz/api/v1/webhooks/sepay";
  const prefix = "SHARE";

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "prefix") {
      setCopiedPrefix(true);
      setTimeout(() => setCopiedPrefix(false), 2000);
    }
  };

  // Đóng modal ảnh khi ấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveImageModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const steps = [
    {
      step: 1,
      title: "Đăng ký tài khoản SePay",
      tag: "my.sepay.vn",
      description:
        "Truy cập vào trang quản trị SePay để đăng ký tài khoản (miễn phí gói cá nhân). Nếu bạn đã có tài khoản SePay, chỉ cần đăng nhập.",
      action: (
        <a
          href="https://my.sepay.vn"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <span>Đến trang đăng ký SePay</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ),
      image: null,
    },
    {
      step: 2,
      title: "Thêm kết nối ngân hàng thụ hưởng",
      tag: "Menu Ngân hàng",
      description:
        "Tại thanh menu bên trái SePay, chọn mục 'Ngân hàng'. Sau đó bấm nút '+ Kết nối mới' ở góc trên bên phải màn hình.",
      image: {
        src: "/images/sepay/step1_connect_bank.png",
        caption: "Ảnh 1: Bấm + Kết nối mới trong menu Ngân hàng",
      },
    },
    {
      step: 3,
      title: "Chọn ngân hàng và liên kết thông báo số dư",
      tag: "Liên kết số dư",
      description:
        "Tìm và chọn ngân hàng thụ hưởng của bạn trong danh sách hỗ trợ (Vietcombank, MBBank, Techcombank, TPBank, MSB, ACB, VPBank,...). Sau đó làm theo các bước hướng dẫn trên màn hình SePay để cấp quyền đọc biến động số dư qua App ngân hàng hoặc SMS/Email.",
      image: {
        src: "/images/sepay/step2_select_bank.png",
        caption: "Ảnh 2: Chọn ngân hàng thụ hưởng của bạn từ danh sách",
      },
    },
    {
      step: 4,
      title: "Cấu hình nhận diện mã thanh toán SHARE",
      tag: "Cấu hình chung",
      description: (
        <div className="space-y-2">
          <p>
            Vào menu <strong>Cấu hình công ty</strong> &rarr; chọn <strong>Cấu hình chung</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-700">
            <li>
              Gạt công tắc sang <strong>Bật, cho phép hệ thống tự động nhận diện mã thanh toán</strong>.
            </li>
            <li>
              Cấu hình mẫu mã thanh toán:
              <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5 text-indigo-900 font-medium">
                <li>
                  Tiền tố: <code className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-700 font-bold">SHARE</code>
                </li>
                <li>
                  Hậu tố: Từ <code className="px-1 py-0.5 bg-slate-100 rounded">5</code> ký tự Đến <code className="px-1 py-0.5 bg-slate-100 rounded">5</code> ký tự Là <code className="px-1 py-0.5 bg-slate-100 rounded">Số nguyên</code>
                </li>
              </ul>
            </li>
            <li>
              Ví dụ mã hợp lệ SePay nhận diện: <span className="font-mono font-semibold text-emerald-600">SHARE11111</span>.
            </li>
            <li>Bấm nút <strong>Lưu lại</strong>.</li>
          </ul>
        </div>
      ),
      image: {
        src: "/images/sepay/step3_pattern_config.png",
        caption: "Ảnh 3: Cài đặt tiền tố SHARE và hậu tố 5 số nguyên",
      },
    },
    {
      step: 5,
      title: "Mở danh sách Tích hợp Webhooks",
      tag: "Tích hợp & Thông báo",
      description:
        "Tại thanh menu bên trái SePay, cuộn xuống nhóm 'Tích hợp & Thông báo' &rarr; chọn 'Tích hợp WebHooks'. Sau đó bấm nút '+ Thêm webhook' ở góc trên.",
      image: {
        src: "/images/sepay/step4_webhook_menu.png",
        caption: "Ảnh 4: Bấm + Thêm webhook trong menu Tích hợp WebHooks",
      },
    },
    {
      step: 6,
      title: "Cấu hình Tab 'Cơ bản' của Webhook",
      tag: "Tab Cơ bản",
      description: (
        <div className="space-y-2">
          <p>Tại cửa sổ thêm webhook mới, điền các thông tin trong tab <strong>Cơ bản</strong>:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              Kích hoạt webhook: Gạt sang <strong>BẬT (ON)</strong>.
            </li>
            <li>
              Tên webhook: Nhập <code className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold text-slate-800">Billing sharing</code>.
            </li>
            <li>
              URL nhận webhook: Nhập URL backend nhận thông báo của bạn:
              <div className="mt-1 flex items-center gap-2">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono text-slate-800 break-all select-all">
                  {webhookUrl}
                </code>
                <button
                  onClick={() => handleCopy(webhookUrl, "url")}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded font-medium flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl ? "Đã copy" : "Copy"}</span>
                </button>
              </div>
            </li>
            <li>
              Loại giao dịch: Chọn <strong>Tiền vào</strong>.
            </li>
            <li>
              Định dạng dữ liệu: Chọn <strong>JSON (khuyến nghị) — application/json</strong>.
            </li>
            <li>
              Tự động gửi lại khi server trả lỗi: Gạt sang <strong>BẬT (ON)</strong>.
            </li>
          </ul>
        </div>
      ),
      image: {
        src: "/images/sepay/step5_webhook_basic.png",
        caption: "Ảnh 5: Cấu hình URL, Loại Tiền vào, Định dạng JSON và Bật gửi lại",
      },
    },
    {
      step: 7,
      title: "Cấu hình Tab 'Tài khoản' & Lọc theo mã thanh toán",
      tag: "Tab Tài khoản",
      description: (
        <div className="space-y-2">
          <p>Chuyển sang tab <strong>Tài khoản</strong> trong cùng cửa sổ:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              Tài khoản ngân hàng: Chọn <strong>Tuỳ chọn</strong> (Chỉ định tài khoản cụ thể) &rarr; Tích chọn đúng số tài khoản ngân hàng thụ hưởng của bạn.
            </li>
            <li>
              Bật toggle: <strong>Dùng để xác thực thanh toán</strong>.
            </li>
            <li>
              Bật toggle: <strong>Chỉ gửi khi có mã thanh toán</strong>.
            </li>
            <li>
              Lọc theo mã thanh toán: Nhập hoặc chọn mã <code className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded">SHARE</code>.
            </li>
          </ul>
          <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-900 mt-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý quan trọng:</strong> Cấu hình lọc theo mã <code>SHARE</code> giúp SePay chỉ gửi webhook đối với các khoản thanh toán chia tiền trong nhóm, hoàn toàn bỏ qua các giao dịch chi tiêu cá nhân khác của bạn!
            </span>
          </div>
        </div>
      ),
      image: {
        src: "/images/sepay/step6_webhook_account_filter.png",
        caption: "Ảnh 6: Chọn STK, bật Chỉ gửi khi có mã thanh toán và lọc mã SHARE",
      },
    },
    {
      step: 8,
      title: "Cấu hình Tab 'Bảo mật' & Tạo API Key 128-bit",
      tag: "Tab Bảo mật",
      description: (
        <div className="space-y-2">
          <p>Chuyển sang tab <strong>Bảo mật</strong> trong cửa sổ webhook:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              Phương thức xác thực: Chọn <strong>API Key</strong>.
            </li>
            <li>
              API Key: Dán chuỗi API Key của bạn vào ô này.
            </li>
          </ul>
          <div className="mt-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Khóa API Key 128-bit ngẫu nhiên của bạn:</span>
              </span>
              <button
                onClick={() => setApiKey(generateKey())}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors"
                title="Tạo khóa mới"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tạo lại</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={apiKey}
                className="w-full text-xs font-mono bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-900 select-all"
              />
              <button
                onClick={() => handleCopy(apiKey, "key")}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0 transition-colors shadow-xs"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? "Đã chép" : "Sao chép"}</span>
              </button>
            </div>
            <p className="text-[11px] text-indigo-700/80 mt-1.5">
              Hãy sao chép chuỗi khóa này để dán vào ô <strong>API Key</strong> trên SePay và ô <strong>SePay API Key</strong> trên Billing Sharing ở Bước 10.
            </p>
          </div>
        </div>
      ),
      image: {
        src: "/images/sepay/step7_webhook_security_apikey.png",
        caption: "Ảnh 7: Chọn xác thực API Key và điền khóa bí mật",
      },
    },
    {
      step: 9,
      title: "Lưu cấu hình Webhook trên SePay",
      tag: "Hoàn tất trên SePay",
      description:
        "Bấm nút 'Cập nhật' (hoặc 'Thêm mới') ở cuối cửa sổ Webhook để lưu lại toàn bộ cấu hình. Trạng thái của Webhook trên SePay sẽ chuyển sang 'Hoạt động' với màu xanh lá.",
      image: null,
    },
    {
      step: 10,
      title: "Dán API Key vào Billing Sharing để kích hoạt",
      tag: "Kích hoạt tự động",
      description: (
        <div className="space-y-2">
          <p>Quay lại ứng dụng Billing Sharing của bạn:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-700">
            <li>
              Tìm thẻ <strong>Tài khoản nhận tiền</strong> &rarr; Bấm vào biểu tượng <strong>Chỉnh sửa</strong> (hình cây bút).
            </li>
            <li>
              Tại ô <strong>SePay API Key (Tùy chọn)</strong>, dán chính xác chuỗi API Key ở Bước 8.
            </li>
            <li>
              Bấm <strong>Lưu thông tin</strong>.
            </li>
          </ol>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 mt-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Tuyệt vời! Hệ thống đã sẵn sàng 100%:</p>
              <p className="text-emerald-800">
                Thẻ tài khoản của bạn sẽ hiển thị huy hiệu <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-300 text-[11px]">🟢 SePay Webhook Auto</span>.
                Bất cứ khi nào bạn bè quét VietQR chuyển tiền (ví dụ nội dung: <code className="font-mono bg-emerald-100/80 px-1 rounded font-bold">SHARE48291 [TÊN BẠN] chuyen tien</code>), hệ thống sẽ tự động gạch nợ và gửi email xác nhận thành công ngay lập tức!
              </p>
            </div>
          </div>
        </div>
      ),
      action: (
        <Link
          to="/billing-sharing?action=edit-payment"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <span>Vào Cài đặt STK trên Billing Sharing</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      ),
      image: null,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/billing-sharing")}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Quay lại Bảng chi tiêu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Hướng dẫn thiết lập SePay Webhook</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                Tự động 100%
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              10 bước kết nối tài khoản ngân hàng để tự động xác nhận thanh toán VietQR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://my.sepay.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <span>Mở SePay</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <Link
            to="/billing-sharing?action=edit-payment"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Cài đặt STK</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {/* Banner Hero */}
        <div className="bg-linear-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden mb-6">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-8 translate-y-8">
            <Zap className="w-64 h-64 text-indigo-400" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Tự động hóa hoàn toàn — Không cần duyệt tay</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
              Kết nối SePay Webhook từng bước có hình ảnh
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed mb-4">
              SePay lắng nghe thông báo biến động số dư từ tài khoản ngân hàng của bạn và kích hoạt Webhook về hệ thống. Khi người nợ quét mã VietQR chuyển tiền có mã định danh <strong className="text-amber-300">SHARExxxxx</strong>, hệ thống tự động hoàn tất khoản nợ và gửi email tức thời.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-indigo-200">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Bảo mật mã hóa 128-bit
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Lọc mã SHARE riêng tư
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Miễn phí cho cá nhân
              </span>
            </div>
          </div>
        </div>

        {/* Quick Utility Box */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Bộ công cụ sao chép nhanh cấu hình
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: API Key Generator */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>API Key (128-bit)</span>
                  </span>
                  <button
                    onClick={() => setApiKey(generateKey())}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                    title="Sinh chuỗi mới"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tạo mới</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Dán vào Tab Bảo mật SePay &amp; Cài đặt STK
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 select-all"
                />
                <button
                  onClick={() => handleCopy(apiKey, "key")}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-medium shrink-0 transition-colors"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Box 2: Webhook URL */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span>URL nhận Webhook</span>
                </span>
                <p className="text-[11px] text-slate-500 mb-2">
                  Dán vào Tab Cơ bản trên SePay
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 select-all"
                />
                <button
                  onClick={() => handleCopy(webhookUrl, "url")}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-medium shrink-0 transition-colors"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Box 3: Prefix & Suffix */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tiền tố nhận diện</span>
                </span>
                <p className="text-[11px] text-slate-500 mb-2">
                  Tiền tố SHARE &amp; Hậu tố 5 số
                </p>
              </div>
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-mono font-bold text-indigo-600">
                  {prefix} + 5 số nguyên
                </span>
                <button
                  onClick={() => handleCopy(prefix, "prefix")}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
                  title="Sao chép tiền tố SHARE"
                >
                  {copiedPrefix ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 10 Step Flow */}
        <div className="space-y-6">
          {steps.map((s) => (
            <div
              key={s.step}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              {/* Step Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    {s.step}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {s.title}
                    </h4>
                    <span className="inline-block mt-0.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                      {s.tag}
                    </span>
                  </div>
                </div>
                {s.action && <div className="shrink-0">{s.action}</div>}
              </div>

              {/* Step Body */}
              <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4 pl-11">
                {s.description}
              </div>

              {/* Image Preview (if present) */}
              {s.image && (
                <div className="pl-11">
                  <div
                    onClick={() =>
                      setActiveImageModal({
                        src: s.image.src,
                        caption: s.image.caption,
                        step: s.step,
                      })
                    }
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 hover:border-indigo-400 transition-all shadow-xs inline-block max-w-xl"
                  >
                    <img
                      src={s.image.src}
                      alt={s.image.caption}
                      className="w-full max-h-72 object-cover object-top group-hover:scale-[1.02] transition-transform duration-200"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs backdrop-blur-2xs">
                      <ZoomIn className="w-4 h-4" />
                      <span>Bấm vào để phóng to xem chi tiết</span>
                    </div>
                    <div className="p-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 font-medium flex items-center justify-between">
                      <span>{s.image.caption}</span>
                      <span className="text-indigo-600 flex items-center gap-0.5 text-[10px]">
                        <ZoomIn className="w-3 h-3" />
                        Phóng to
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Call to Action Card */}
        <div className="mt-10 bg-indigo-50 border border-indigo-200 rounded-2xl p-6 sm:p-8 text-center">
          <h3 className="text-base sm:text-lg font-bold text-indigo-950 mb-2">
            Đã hoàn thành cấu hình Webhook trên SePay?
          </h3>
          <p className="text-xs sm:text-sm text-indigo-800/80 max-w-xl mx-auto mb-5">
            Dán chuỗi API Key vào cài đặt tài khoản nhận tiền trên Billing Sharing để kích hoạt ngay hệ thống tự động nhận diện thanh toán và hoàn tất công nợ.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/billing-sharing?action=edit-payment"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span>Vào Cài đặt Tài khoản nhận tiền ngay</span>
            </Link>
            <button
              onClick={() => navigate("/billing-sharing")}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-900 text-sm font-medium transition-colors"
            >
              Quay lại Bảng chi tiêu
            </button>
          </div>
        </div>
      </main>

      {/* Lightbox Modal phóng to ảnh */}
      {activeImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveImageModal(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  {activeImageModal.step}
                </span>
                <h5 className="font-semibold text-slate-900 text-sm">
                  {activeImageModal.caption}
                </h5>
              </div>
              <button
                onClick={() => setActiveImageModal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Body */}
            <div className="p-3 overflow-auto flex items-center justify-center bg-slate-900/5">
              <img
                src={activeImageModal.src}
                alt={activeImageModal.caption}
                className="max-h-[78vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
