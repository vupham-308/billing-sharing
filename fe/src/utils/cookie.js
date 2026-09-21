/**
 * Tiện ích quản lý Cookie cho việc lưu trữ Access Token thay thế cho Local Storage
 */
export const cookieUtils = {
  /**
   * Lấy giá trị cookie theo tên
   * @param {string} name Tên cookie
   * @returns {string|null} Giá trị cookie hoặc null nếu không tìm thấy
   */
  get: (name) => {
    if (typeof document === "undefined") return null;
    const nameEQ = encodeURIComponent(name) + "=";
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      let c = cookies[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  },

  /**
   * Thiết lập cookie với thời hạn sống (mặc định 30 ngày)
   * @param {string} name Tên cookie
   * @param {string} value Giá trị cookie
   * @param {number} days Số ngày có hiệu lực
   */
  set: (name, value, days = 30) => {
    if (typeof document === "undefined") return;
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax${
      isSecure ? "; Secure" : ""
    }`;
  },

  /**
   * Xóa cookie
   * @param {string} name Tên cookie cần xóa
   */
  remove: (name) => {
    if (typeof document === "undefined") return;
    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${
      isSecure ? "; Secure" : ""
    }`;
  },
};
