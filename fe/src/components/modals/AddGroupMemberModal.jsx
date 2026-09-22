import React, { useEffect, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { groupApi } from "../../services/api";

export default function AddGroupMemberModal({ group, onClose, onMembersChanged }) {
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    groupApi.getMembers(group.id).then((items) => {
      if (active) setMembers(items);
    }).catch((err) => {
      if (active) setError(err.response?.data?.message || "Không thể tải danh sách thành viên.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.id]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const member = await groupApi.addMember(group.id, { email: email.trim().toLowerCase() });
      const updated = [...members, member];
      setMembers(updated);
      onMembersChanged(group.id, updated);
      setEmail("");
      setSuccess(`Đã thêm ${member.fullName || member.email} vào nhóm.`);
    } catch (err) {
      setError(err.response?.data?.errors?.email || err.response?.data?.message || "Không thể thêm thành viên.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="add-member-title" className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="add-member-title" className="font-bold text-lg">Thành viên · {group.name}</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        {loading ? <p>Đang tải thành viên...</p> : (
          <ul className="max-h-48 overflow-y-auto mb-4 divide-y divide-slate-100">
            {members.map((member) => <li key={member.userId || member.id} className="py-2 text-sm">
              <div className="font-medium">{member.fullName}</div><div className="text-slate-500">{member.email}</div>
            </li>)}
          </ul>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="member-email" className="block text-sm font-medium">Email thành viên mới</label>
          <input id="member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={saving} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="thanhvien@example.com" />
          <p className="text-xs text-slate-500">Nhập email của tài khoản đã đăng ký ChiaTiền.</p>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-600">{success}</p>}
          <button type="submit" disabled={saving || loading} className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white rounded-lg py-2 disabled:opacity-50">
            <UserPlus className="w-4 h-4" />{saving ? "Đang thêm..." : "Thêm thành viên"}
          </button>
        </form>
      </section>
    </div>
  );
}
