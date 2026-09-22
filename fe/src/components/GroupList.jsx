import React from "react";
import { Users, Calendar, Plus, FolderKanban, CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatVND } from "../utils/formatters";

export default function GroupList({
  groups = [],
  selectedGroupId,
  onSelectGroup,
  onOpenCreateGroup,
  onOpenCreateModal,
  currentUser,
  onAddMember,
  onSettleEarly,
  settlingGroupId,
}) {
  const handleOpenCreate = onOpenCreateGroup || onOpenCreateModal;

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nhóm chi tiêu của bạn</h2>
            <p className="text-xs text-slate-500">Bấm vào nhóm để xem sao kê hóa đơn chi tiết</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo nhóm</span>
        </button>
      </div>

      {/* Group Pills / Filter buttons */}
      <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar border-b border-slate-100 mb-4">
        <button
          onClick={() => onSelectGroup(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            selectedGroupId === null
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          Tất cả các nhóm ({groups.length})
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              selectedGroupId === group.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Grid of group cards: 1 col on mobile, 2 cols on tablet/desktop for wider, readable cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const userBalance = group.myBalance ?? 0;
          const isPositive = userBalance > 0;
          const isZero = userBalance === 0;

          return (
            <div
              key={group.id}
              onClick={() => onSelectGroup(isSelected ? null : group.id)}
              className={`cursor-pointer group relative p-4 sm:p-5 rounded-2xl border transition-all ${
                isSelected
                  ? "bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-indigo-600 transition-colors">
                  {group.name}
                </h3>
                {group.summaryDayOfMonth && (
                  <span
                    title={`Chốt sao kê và gửi mail vào ngày ${Array.isArray(group.summaryDayOfMonth) ? group.summaryDayOfMonth.join(", ") : group.summaryDayOfMonth} hàng tháng`}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80"
                  >
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Ngày {Array.isArray(group.summaryDayOfMonth) ? group.summaryDayOfMonth.join(", ") : group.summaryDayOfMonth}</span>
                  </span>
                )}
              </div>

              {group.description && (
                <p className="text-xs text-slate-500 mb-3">{group.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <div className="text-slate-600 font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{group.memberCount ?? group.members?.length ?? "—"} thành viên</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-normal">Số dư trong nhóm</span>
                  <span
                    className={`font-extrabold text-sm sm:text-base ${
                      isZero
                        ? "text-slate-600"
                        : isPositive
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatVND(userBalance)}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/billing-sharing/groups/${group.id}/statements`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600" />
                  <span>Xem sao kê</span>
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  {onAddMember && (currentUser?.role === "ADMIN" || group.createdById === currentUser?.id) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddMember(group);
                      }}
                    >
                      <span>+ Thêm thành viên bằng email</span>
                    </button>
                  )}
                  {onSettleEarly && group.createdById === currentUser?.id && (
                    <button
                      type="button"
                      disabled={settlingGroupId === group.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 px-2.5 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSettleEarly(group);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{settlingGroupId === group.id ? "Đang tất toán..." : "Tất toán trước hạn"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Bạn chưa tham gia nhóm nào</p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
            >
              + Bấm vào đây để tạo nhóm đầu tiên
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
