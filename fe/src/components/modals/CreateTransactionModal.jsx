import React, { useState, useEffect } from "react";
import { X, Receipt, Check, AlertCircle } from "lucide-react";
import { formatVND, formatNumber } from "../../utils/formatters";
import { groupApi } from "../../services/api";
import { splitAmount, editShare } from "../../utils/splitAmount";

export default function CreateTransactionModal({ isOpen, onClose, groups = [], onSubmit, currentUserId }) {
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL"); // "EQUAL" | "CUSTOM"
  const [members, setMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [customShares, setCustomShares] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && groups.length > 0 && !groupId) {
      setGroupId(groups[0].id);
    }
  }, [isOpen, groups, groupId]);

  useEffect(() => {
    if (!isOpen || !groupId) return;
    let isCancelled = false;

    async function fetchMembers() {
      const selectedGroup = groups.find((g) => g.id === groupId);
      let groupMembers = selectedGroup?.members || [];
      if (!groupMembers || groupMembers.length === 0) {
        try {
          groupMembers = await groupApi.getMembers(groupId);
        } catch (err) {
          console.error("Không thể tải thành viên của nhóm", err);
          groupMembers = [];
        }
      }

      if (!isCancelled) {
        setMembers(groupMembers);
        const allIds = groupMembers.map((m) => m.userId || m.id);
        setSelectedMemberIds(allIds);

        setCustomShares(null);
      }
    }

    fetchMembers();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, groupId, groups]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (rawVal && !Number.isSafeInteger(Number(rawVal))) {
      setError("Số tiền quá lớn để chia chính xác.");
      return;
    }
    setTotalAmount(rawVal);
    setCustomShares(null);
    setError("");
  };

  const toggleMember = (id) => {
    setCustomShares(null);
    setSelectedMemberIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        if (prev.length <= 1) return prev; // Phải có ít nhất 1 người
        return prev.filter((mId) => mId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCustomShareChange = (memberId, value) => {
    const rawVal = value.replace(/\D/g, "");
    setCustomShares((prev) => editShare(numericTotal, selectedMemberIds, currentUserId,
      prev || equalShares, memberId, Number(rawVal)));
  };

  // Calculations
  const numericTotal = parseInt(totalAmount, 10) || 0;
  const equalShares = splitAmount(numericTotal, selectedMemberIds, currentUserId);
  const displayedShares = customShares || equalShares;

  const customSum = selectedMemberIds.reduce((sum, id) => sum + (displayedShares[id] || 0), 0);
  const isCustomBalanced = Math.abs(customSum - numericTotal) === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!groupId) {
      setError("Vui lòng chọn nhóm chi tiêu");
      return;
    }
    if (!title.trim()) {
      setError("Vui lòng nhập tên hóa đơn/khoản chi");
      return;
    }
    if (numericTotal <= 0) {
      setError("Vui lòng nhập tổng số tiền hợp lệ (> 0)");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("Phải có ít nhất 1 người tham gia chia tiền");
      return;
    }

    if (numericTotal < selectedMemberIds.length || !isCustomBalanced) {
      setError("Tổng tiền phải đủ ít nhất 1 đồng cho mỗi người và bằng tổng các phần chia.");
      return;
    }
    const shares = selectedMemberIds.map((id) => ({ userId: id, shareAmount: displayedShares[id] }));

    setIsSubmitting(true);
    try {
      await onSubmit({
        groupId,
        title: title.trim(),
        totalAmount: numericTotal,
        shares,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Không thể tạo hóa đơn mới.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Thêm hóa đơn / Chi tiêu mới</h3>
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

          {/* Nhóm */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nhóm chi tiêu
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tiêu đề & Tổng tiền */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên khoản chi
              </label>
              <input
                type="text"
                placeholder="VD: Tiền phòng tháng 9, Ăn lẩu..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tổng số tiền (VNĐ)
              </label>
              <input
                type="text"
                placeholder="0"
                aria-label="Tổng số tiền"
                value={formatNumber(totalAmount)}
                onChange={handleAmountChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Cách chia tiền */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Phương thức chia tiền
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setSplitType("EQUAL"); setCustomShares(null); setError(""); }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitType === "EQUAL"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Chia đều (ưu tiên phần lẻ cho người trả)
              </button>
              <button
                type="button"
                onClick={() => setSplitType("CUSTOM")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitType === "CUSTOM"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Tùy chỉnh số tiền từng người
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Phần chia được tính lại khi đổi tổng tiền hoặc thành viên. Khi giảm một phần chia, tiền còn lại tự chuyển về người trả (hoặc người khác nếu bạn đang sửa phần của người trả).</p>
          </div>

          {/* Danh sách người tham gia chia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Thành viên chia ({selectedMemberIds.length}/{members.length})
              </label>
                <span
                  aria-label="Tổng đã chia / tổng hóa đơn"
                  className={`text-xs font-semibold ${
                    isCustomBalanced ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatVND(customSum)} / {formatVND(numericTotal)}
                </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {members.map((member) => {
                const memberId = member.userId || member.id;
                const isSelected = selectedMemberIds.includes(memberId);
                const isMe = memberId === currentUserId;
                const memberName = member.fullName || member.name || (isMe ? "Bạn" : "Thành viên");

                return (
                  <div
                    key={memberId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-slate-50/80 border-slate-200"
                        : "bg-white border-slate-100 opacity-60"
                    }`}
                  >
                    <div
                      onClick={() => toggleMember(memberId)}
                      className="flex items-center gap-2.5 cursor-pointer select-none flex-1"
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-800">
                        {memberName} {isMe && "(Bạn)"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-1.5 w-36">
                        <input
                          type="text"
                          aria-label={`Số tiền của ${memberName}`}
                          value={formatNumber(displayedShares[memberId] || "")}
                          disabled={numericTotal < selectedMemberIds.length}
                          onChange={(e) => handleCustomShareChange(memberId, e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[11px] text-slate-400 font-medium">đ</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">
                  Đang tải thành viên nhóm...
                </div>
              )}
            </div>
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
              {isSubmitting ? "Đang tạo..." : "Xác nhận tạo hóa đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
