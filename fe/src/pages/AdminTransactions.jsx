import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminTransactionApi } from "../services/api";
import Navbar from "../components/Navbar";

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function AdminTransactions() {
  const [groups, setGroups] = useState([]);
  const [groupError, setGroupError] = useState("");
  const [filters, setFilters] = useState({ groupId: "", paid: "", search: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adjustBalances, setAdjustBalances] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    adminTransactionApi.groups().then((items) => { if (active) setGroups(items); })
      .catch(() => { if (active) setGroupError("Không thể tải danh sách nhóm. Bấm Làm mới để thử lại."); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    const params = { page, size: 20 };
    if (filters.groupId) params.groupId = filters.groupId;
    if (filters.paid !== "") params.paid = filters.paid;
    if (filters.search) params.search = filters.search;
    adminTransactionApi.list(params).then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Không thể tải hóa đơn. Bấm Làm mới để thử lại."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, revision]);

  const beginLoad = () => { setLoading(true); setError(""); };
  const filter = (key, value) => { beginLoad(); setPage(0); setFilters((prev) => ({ ...prev, [key]: value })); };
  const changePage = (value) => { beginLoad(); setPage(value); };
  const openEdit = (tx) => {
    setActionError(""); setAdjustBalances(false);
    setEdit({ ...tx, sharingMembers: tx.sharingMembers.map((s) => ({ ...s })) });
  };
  const changeShare = (id, key, value) => setEdit((prev) => ({ ...prev,
    sharingMembers: prev.sharingMembers.map((s) => s.id === id ? { ...s, [key]: value } : s) }));
  const mutate = async (event) => {
    event.preventDefault(); setSaving(true); setActionError(""); setSuccess("");
    try {
      if (edit) {
        await adminTransactionApi.update(edit.id, { title: edit.title.trim(), totalAmount: Number(edit.totalAmount),
          sharingMembers: edit.sharingMembers.map((s) => ({ id: s.id, shareAmount: Number(s.shareAmount), isPaid: Boolean(s.isPaid) })) });
        setSuccess("Đã cập nhật hóa đơn.");
      } else {
        await adminTransactionApi.delete(deleting.id, adjustBalances);
        setSuccess("Đã xóa hóa đơn. Lịch sử thanh toán được giữ lại.");
      }
      setPage(0);
      setEdit(null); setDeleting(null); beginLoad(); setRevision((v) => v + 1);
    } catch (err) { setActionError(err.response?.data?.message || "Không thể thực hiện thao tác. Vui lòng thử lại."); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <nav aria-label="Quản trị" className="flex gap-3 text-sm font-semibold">
          <Link to="/billing-sharing/admin/outbox" className="text-slate-600 hover:text-purple-700">Email Outbox</Link>
          <span className="text-purple-700">Hóa đơn toàn hệ thống</span>
        </nav>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap justify-between gap-4">
          <div><h1 className="text-xl font-bold text-slate-900">Hóa đơn toàn hệ thống</h1>
            <p className="text-sm text-slate-500 mt-1">Xem hóa đơn của mọi nhóm và trạng thái từng phần chia.</p></div>
          <button onClick={() => { beginLoad(); setGroupError(""); setRevision((v) => v + 1); }} className="px-4 py-2 rounded-xl bg-purple-100 text-purple-700 font-semibold">Làm mới</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); filter("search", searchDraft.trim()); }}
          className="bg-white border border-slate-200 rounded-2xl p-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm text-slate-600">Nhóm
            <select value={filters.groupId} onChange={(e) => filter("groupId", e.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1">
              <option value="">Tất cả nhóm</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Thanh toán
            <select value={filters.paid} onChange={(e) => filter("paid", e.target.value)} className="block w-full border border-slate-200 rounded-lg p-2 mt-1">
              <option value="">Tất cả trạng thái</option><option value="true">Đã trả hết</option><option value="false">Còn chưa trả</option>
            </select>
          </label>
          <div><label className="text-sm text-slate-600" htmlFor="invoice-search">Tìm hóa đơn, nhóm hoặc người trả</label>
            <div className="flex gap-2 mt-1"><input id="invoice-search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} className="min-w-0 w-full border border-slate-200 rounded-lg p-2" />
              <button className="px-3 rounded-lg bg-indigo-600 text-white">Tìm</button></div></div>
        </form>
        {groupError && <p role="alert" className="text-rose-700">{groupError}</p>}
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        {success && <p role="status" className="text-emerald-700">{success}</p>}
        {loading ? <p role="status">Đang tải hóa đơn...</p> : !error && <>
          <p className="text-sm text-slate-600">{data.totalElements} hóa đơn · Trạng thái “Đã trả hết” chỉ khi mọi phần chia đã trả. Bao gồm giao dịch điều chỉnh.</p>
          {data.content.length === 0 ? <p className="bg-white p-6 rounded-2xl border border-slate-200">Không có hóa đơn phù hợp.</p> :
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
              <table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600"><tr>
                {["Hóa đơn", "Nhóm", "Người trả", "Tổng tiền", "Thanh toán", "Phần chia", "Thao tác"].map((h) => <th key={h} className="p-4 whitespace-nowrap">{h}</th>)}
              </tr></thead><tbody>{data.content.map((tx) => <tr key={tx.id} className="border-t border-slate-100 align-top">
                <td className="p-4"><p className="font-semibold text-slate-900">{tx.title}</p><p className="text-xs text-slate-500 mt-1">{date(tx.createdAt)}</p>
                  {tx.isAdjustment && <span className="text-xs text-purple-700">Điều chỉnh · {tx.adjustmentType}</span>}</td>
                <td className="p-4">{tx.groupName}</td><td className="p-4">{tx.payerName}</td><td className="p-4 whitespace-nowrap font-semibold">{money(tx.totalAmount)}</td>
                <td className="p-4"><span className={`inline-block rounded-lg px-2 py-1 whitespace-nowrap ${tx.isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{tx.isPaid ? "Đã trả hết" : "Còn chưa trả"}</span></td>
                <td className="p-4 min-w-64"><details><summary className="cursor-pointer text-indigo-700">Xem {tx.sharingMembers.length} phần chia</summary>
                  <ul className="mt-3 space-y-3">{tx.sharingMembers.map((s) => <li key={s.id}>
                    <p className="font-medium">{s.fullName} · {money(s.shareAmount)}</p>
                    <p className={`text-xs ${s.isPaid ? "text-emerald-700" : "text-amber-700"}`}>{s.isPaid ? "Đã trả" : "Chưa trả"}{s.isPaid && s.paidAt ? ` · ${date(s.paidAt)}` : ""}</p>
                  </li>)}</ul><p className="text-xs text-slate-400 mt-3 break-all">ID: {tx.id}</p>
                </details></td>
                <td className="p-4 whitespace-nowrap"><button onClick={() => openEdit(tx)} className="text-indigo-700 font-semibold mr-3">Sửa</button>
                  <button onClick={() => { setActionError(""); setAdjustBalances(false); setDeleting(tx); }} className="text-rose-700 font-semibold">Xóa</button></td>
              </tr>)}</tbody></table>
            </div>}
          <div className="flex items-center justify-end gap-3 text-sm">
            <button disabled={page === 0} onClick={() => changePage(page - 1)} className="px-3 py-2 rounded-lg border disabled:opacity-40">Trang trước</button>
            <span>Trang {data.totalPages ? page + 1 : 0} / {data.totalPages}</span>
            <button disabled={page + 1 >= data.totalPages} onClick={() => changePage(page + 1)} className="px-3 py-2 rounded-lg border disabled:opacity-40">Trang sau</button>
          </div>
        </>}
      </main>
      {(edit || deleting) && <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="edit-title" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <form onSubmit={mutate} className="space-y-4">
            <h2 id="edit-title" className="text-lg font-bold">{edit ? "Sửa hóa đơn" : "Xóa hóa đơn"}</h2>
            <p className="text-sm text-slate-500">{(edit || deleting).groupName} · Người trả: {(edit || deleting).payerName}</p>
            {edit ? <>
              <label className="block text-sm">Tên hóa đơn<input required maxLength={255} value={edit.title} onChange={(e) => setEdit((prev) => ({ ...prev, title: e.target.value }))} className="block w-full border rounded-lg p-2 mt-1" /></label>
              <label className="block text-sm">Tổng tiền<input required type="number" min="0" step="1" value={edit.totalAmount} onChange={(e) => setEdit((prev) => ({ ...prev, totalAmount: e.target.value }))} className="block w-full border rounded-lg p-2 mt-1" /></label>
              <div className="flex justify-between items-center"><h3 className="font-semibold text-sm">Phần chia và trạng thái</h3>
                <button type="button" onClick={() => setEdit((prev) => ({ ...prev, sharingMembers: prev.sharingMembers.map((s) => ({ ...s, isPaid: true })) }))} className="text-sm text-emerald-700">Đánh dấu tất cả đã trả</button></div>
              {edit.sharingMembers.map((s) => <div key={s.id} className="grid sm:grid-cols-2 gap-3 border rounded-xl p-3">
                <label className="text-sm">{s.fullName}<input required type="number" min="0" step="1" value={s.shareAmount} onChange={(e) => changeShare(s.id, "shareAmount", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
                <label className="flex items-center gap-2 text-sm"><input aria-label={`Đã trả: ${s.fullName}`} type="checkbox" checked={Boolean(s.isPaid)} disabled={s.userId === edit.payerId} onChange={(e) => changeShare(s.id, "isPaid", e.target.checked)} />Đã trả</label>
              </div>)}
              <p className="text-xs text-slate-500">Tổng các phần chia phải bằng tổng tiền. Thay đổi số tiền hoặc trạng thái sẽ tự động cập nhật số dư của người chịu nợ, người trả và thành viên nhóm. Hóa đơn đã có lịch sử thanh toán chỉ cho sửa tên và trạng thái.</p>
            </> : <p>Bạn sẽ xóa hóa đơn <strong>{deleting.title}</strong> ({money(deleting.totalAmount)}). Thao tác này không thể hoàn tác.</p>}
            {deleting && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={adjustBalances} onChange={(e) => setAdjustBalances(e.target.checked)} className="mt-1" />
              <span>Điều chỉnh số dư công nợ khi xóa.<span className="block text-xs text-slate-500">Chọn khi khoản nợ thực sự chưa trả để loại khoản nợ khỏi số dư.</span></span></label>}
            {actionError && <p role="alert" className="text-rose-700">{actionError}</p>}
            <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => { setEdit(null); setDeleting(null); }} className="border rounded-lg px-4 py-2">Hủy</button>
              <button disabled={saving} className={`rounded-lg px-4 py-2 text-white disabled:opacity-50 ${edit ? "bg-indigo-600" : "bg-rose-600"}`}>{saving ? "Đang xử lý..." : edit ? "Lưu thay đổi" : "Xác nhận xóa"}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
