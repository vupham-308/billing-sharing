package com.kai.billingsharing.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

public final class PaymentDescriptionUtil {

    private static final Pattern DIACRITICS_PATTERN = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private PaymentDescriptionUtil() {
    }

    /**
     * Chuẩn hóa tên thành không dấu, in hoa, chỉ giữ ký tự chữ và số.
     * Ví dụ: "Phạm Tuấn Vũ" -> "PHAM TUAN VU"
     */
    public static String removeDiacritics(String text) {
        if (text == null || text.isBlank()) {
            return "NGUOI DUNG";
        }
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD);
        String withoutDiacritics = DIACRITICS_PATTERN.matcher(normalized).replaceAll("");
        // Thay chữ Đ/đ
        withoutDiacritics = withoutDiacritics.replace("Đ", "D").replace("đ", "d");
        // Giữ lại ký tự an toàn
        return withoutDiacritics.replaceAll("[^a-zA-Z0-9 ]", "").trim().toUpperCase();
    }

    /**
     * Quy chuẩn nội dung chuyển tiền thống nhất: <TÊN NGƯỜI NỢ> chuyen tien
     * Ví dụ: "PHAM TUAN VU chuyen tien"
     */
    public static String buildTransferDescription(String debtorName) {
        String cleanName = removeDiacritics(debtorName);
        return cleanName + " chuyen tien";
    }

    public static String buildPaymentDescription(String debtorName) {
        return buildTransferDescription(debtorName);
    }

    /**
     * Sinh mã định danh giao dịch dạng SHARE + 5 số ngẫu nhiên (10000 - 99999).
     * Ví dụ: "SHARE48291"
     */
    public static String buildIdentify() {
        int randomNum = java.util.concurrent.ThreadLocalRandom.current().nextInt(10000, 100000);
        return "SHARE" + randomNum;
    }

    /**
     * Quy chuẩn nội dung chuyển tiền kèm mã định danh SHARE:
     * SHARE<5_so_random> <TÊN NGƯỜI NỢ> chuyen tien
     * Ví dụ: "SHARE48291 PHAM TUAN VU chuyen tien"
     */
    public static String buildTransferDescriptionWithIdentify(String identify, String debtorName) {
        String cleanName = removeDiacritics(debtorName);
        if (identify == null || identify.isBlank()) {
            return cleanName + " chuyen tien";
        }
        return identify.trim().toUpperCase() + " " + cleanName + " chuyen tien";
    }
}
