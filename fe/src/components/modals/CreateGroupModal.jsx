import React, { useState, useEffect } from "react";
import { X, Users, Calendar, AlertCircle, Check } from "lucide-react";

export default function CreateGroupModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDays, setSelectedDays] = useState([25]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setSelectedDays([25]);
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day) => {
    if (day < 1 || day > 27) return;
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) {
        setError("Nhóm phải có ít nhất 1 ngày chốt sao kê");
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort((a, b) => a - b));
    }
    setError("");
  };

  const applyPreset = (days) => {
    const validDays = days.filter((d) => d >= 1 && d <= 27);
    setSelectedDays(validDays);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Vui lòng nhập tên nhóm chi tiêu");
      return;
    }
    if (selectedDays.length === 0) {
      setError("Vui lòng chọn ít nhất 1 ngày chốt sao kê trong tháng");
      return;
    }
    if (selectedDays.some((d) => d < 1 || d > 27)) {
      setError("Ngày chốt sao kê chỉ hợp lệ từ ngày 1 đến ngày 27");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        summaryDayOfMonth: selectedDays,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Không thể tạo nhóm mới.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Tạo nhóm chi tiêu mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên nhóm
            </label>
            <input
              type="text"
              placeholder="VD: Du lịch Đà Lạt, Phòng trọ 304, Ăn trưa..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mô tả ngắn
            </label>
            <input
              type="text"
              placeholder="Ghi chú về nhóm chi tiêu này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Chọn ngày chốt sao kê (Multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Ngày chốt sao kê hàng tháng
              </label>
              <span className="text-xs font-bold text-indigo-600">
                {selectedDays.length > 0 ? `Ngày ${selectedDays.join(", ")}` : "Chưa chọn ngày"}
              </span>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                { label: "Ngày 25", days: [25] },
                { label: "Ngày 15 & 25", days: [15, 25] },
                { label: "Ngày 1 & 15", days: [1, 15] },
                { label: "Ngày 10 & 20", days: [10, 20] },
                { label: "Ngày 1, 10 & 20", days: [1, 10, 20] },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => applyPreset(preset.days)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    JSON.stringify(selectedDays) === JSON.stringify(preset.days)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Grid 27 days picker (Chỉ cho phép từ ngày 1 đến ngày 27) */}
            <div className="grid grid-cols-7 gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {Array.from({ length: 27 }, (_, i) => i + 1).map((d) => {
                const isSelected = selectedDays.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`h-7 rounded-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs scale-95"
                        : "text-slate-700 hover:bg-white hover:text-indigo-600 hover:shadow-2xs"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Hệ thống tự động tổng hợp & gửi mail sao kê lúc 08:30 sáng vào các ngày đã chọn (từ ngày 1 đến ngày 27).</span>
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Đang tạo..." : "Tạo nhóm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
