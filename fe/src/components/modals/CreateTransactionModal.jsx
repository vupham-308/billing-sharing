import React, { useState, useEffect } from "react";
import { X, Receipt, Check, AlertCircle } from "lucide-react";
import { formatVND, formatNumber } from "../../utils/formatters";

export default function CreateTransactionModal({ isOpen, onClose, groups = [], onSubmit, currentUserId }) {
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL"); // "EQUAL" | "CUSTOM"
  const [members, setMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [customShares, setCustomShares] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (groups.length > 0 && !groupId) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  useEffect(() => {
    if (!groupId) return;
    const selectedGroup = groups.find((g) => g.id === groupId);
    if (selectedGroup && selectedGroup.members) {
      setMembers(selectedGroup.members);
      const allIds = selectedGroup.members.map((m) => m.userId || m.id);
      setSelectedMemberIds(allIds);

      // Default custom shares to equal
      const count = allIds.length;
      const parsedAmount = parseInt(totalAmount, 10) || 0;
      const initialCustom = {};
      allIds.forEach((id) => {
        initialCustom[id] = count > 0 ? Math.round(parsedAmount / count) : 0;
      });
      setCustomShares(initialCustom);
    }
  }, [groupId, groups]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    setTotalAmount(rawVal);

    if (splitType === "CUSTOM" && rawVal) {
      const num = parseInt(rawVal, 10) || 0;
      const count = selectedMemberIds.length;
      const newShares = {};
      selectedMemberIds.forEach((id) => {
        newShares[id] = count > 0 ? Math.round(num / count) : 0;
      });
      setCustomShares(newShares);
    }
  };

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        if (prev.length <= 1) return prev; // At least one member
        return prev.filter((mId) => mId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCustomShareChange = (memberId, value) => {
    const rawVal = value.replace(/\D/g, "");
    setCustomShares((prev) => ({
      ...prev,
      [memberId]: parseInt(rawVal, 10) || 0,
    }));
  };

  // Calculations
  const numericTotal = parseInt(totalAmount, 10) || 0;
  const equalSharePerPerson =
    selectedMemberIds.length > 0 ? Math.round(numericTotal / selectedMemberIds.length) : 0;

  const customSum = selectedMemberIds.reduce((sum, id) => sum + (customShares[id] || 0), 0);
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

    let sharingMembersPayload = [];
    if (splitType === "EQUAL") {
      let remainder = numericTotal - equalSharePerPerson * selectedMemberIds.length;
      sharingMembersPayload = selectedMemberIds.map((id, index) => ({
        userId: id,
        amount: index === 0 ? equalSharePerPerson + remainder : equalSharePerPerson,
      }));
    } else {
      if (!isCustomBalanced) {
        setError(
          `Tổng số tiền chia (${formatVND(customSum)}) chưa khớp với tổng hóa đơn (${formatVND(
            numericTotal
          )})`
        );
        return;
      }
      sharingMembersPayload = selectedMemberIds.map((id) => ({
        userId: id,
        amount: customShares[id] || 0,
      }));
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        groupId,
        title: title.trim(),
        totalAmount: numericTotal,
        sharingMembers: sharingMembersPayload,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra khi tạo hóa đơn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Thêm hóa đơn mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Group selector */}
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

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên khoản chi / Hóa đơn
            </label>
            <input
              type="text"
              placeholder="VD: Ăn trưa bún bò, Taxi sân bay..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tổng số tiền (VND)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="0"
                value={totalAmount ? formatNumber(totalAmount) : ""}
                onChange={handleAmountChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-400">
                VND
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Người thanh toán mặc định: <strong>Bạn (Tự động ghi nhận)</strong>
            </p>
          </div>

          {/* Split Type toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Cách thức chia tiền
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSplitType("EQUAL")}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                  splitType === "EQUAL"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Chia đều ({selectedMemberIds.length} người)
              </button>
              <button
                type="button"
                onClick={() => setSplitType("CUSTOM")}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                  splitType === "CUSTOM"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Chia theo số tiền cụ thể
              </button>
            </div>
          </div>

          {/* Members sharing list */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Người tham gia ({selectedMemberIds.length}/{members.length})
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {members.map((member) => {
                const id = member.userId || member.id;
                const isSelected = selectedMemberIds.includes(id);

                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      isSelected ? "bg-slate-50/80 border-slate-200" : "bg-white border-slate-100 opacity-60"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{member.userName || member.name || "Thành viên"}</span>
                    </label>

                    {isSelected && (
                      <div>
                        {splitType === "EQUAL" ? (
                          <span className="text-xs font-bold text-slate-700">
                            {formatVND(equalSharePerPerson)}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={customShares[id] !== undefined ? formatNumber(customShares[id]) : ""}
                              onChange={(e) => handleCustomShareChange(id, e.target.value)}
                              className="w-24 text-right px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                              placeholder="0"
                            />
                            <span className="text-[10px] text-slate-400">₫</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitType === "CUSTOM" && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  isCustomBalanced
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                <span>Tổng tiền đã chia: {formatVND(customSum)}</span>
                <span>{isCustomBalanced ? "✓ Đã cân bằng" : `Chênh lệch: ${formatVND(numericTotal - customSum)}`}</span>
              </div>
            )}
          </div>

          {/* Footer actions */}
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
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Đang lưu..." : "Tạo hóa đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
