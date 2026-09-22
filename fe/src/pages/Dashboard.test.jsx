// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

const mocks = vi.hoisted(() => ({
  groups: vi.fn(), transactions: vi.fn(), members: vi.fn(), addMember: vi.fn(),
  debts: vi.fn(), credits: vi.fn(), info: vi.fn(),
  user: { id: "u1", fullName: "An", role: "USER" },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { ...mocks.user }, isLoading: false, refreshUser: vi.fn() }) }));
vi.mock("../services/api", () => ({
  groupApi: { getGroups: mocks.groups, getGroupTransactions: mocks.transactions, getMembers: mocks.members, addMember: mocks.addMember },
  paymentRequestApi: { getMyDebts: mocks.debts, getMyCredits: mocks.credits },
  paymentInfoApi: { getMyInfo: mocks.info }, transactionApi: {},
}));
vi.mock("../components/Navbar", () => ({ default: () => null }));
vi.mock("../components/HeroBalance", () => ({ default: () => null }));
vi.mock("../components/PaymentRequestsSection", () => ({ default: () => null }));
vi.mock("../components/PaymentInfoCard", () => ({ default: () => null }));
vi.mock("../components/modals/PaymentInfoModal", () => ({ default: () => null }));
vi.mock("../components/modals/VietQrModal", () => ({ default: () => null }));
vi.mock("../components/auth/AuthCard", () => ({ default: () => null }));
vi.mock("../components/RecentTransactions", () => ({ default: ({ transactions }) => <div data-testid="transactions">{transactions.map((tx) => tx.title).join(",")}</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "u1", fullName: "An", role: "USER" };
  mocks.groups.mockResolvedValue([
    { id: "g1", name: "Nhóm Một", createdById: "u1" },
    { id: "g2", name: "Nhóm Hai", createdById: "u2" },
  ]);
  mocks.transactions.mockImplementation(async (id) => ({ content: [{ id: `t-${id}`, title: `Hóa đơn ${id}`, groupId: id, createdAt: "2026-09-22" }], totalPages: 1 }));
  mocks.debts.mockResolvedValue([]);
  mocks.credits.mockResolvedValue([]);
  mocks.info.mockResolvedValue(null);
  mocks.members.mockResolvedValue([{ userId: "u1", fullName: "An", email: "an@example.com" }]);
});
afterEach(cleanup);
const app = () => <MemoryRouter><Dashboard /></MemoryRouter>;

test("all groups stays selected and group switching does not reload dashboard or hidden members", async () => {
  const view = render(app());
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toContain("Hóa đơn g2"));
  expect(mocks.groups).toHaveBeenCalledTimes(1);
  expect(mocks.members).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Nhóm Một", exact: true }));
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toBe("Hóa đơn g1"));
  fireEvent.click(screen.getByRole("button", { name: "Tất cả các nhóm (2)" }));
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toContain("Hóa đơn g2"));
  view.rerender(app()); // Auth user object may refresh without its ID changing.
  expect(mocks.groups).toHaveBeenCalledTimes(1);
  expect(mocks.debts).toHaveBeenCalledTimes(1);
  expect(mocks.credits).toHaveBeenCalledTimes(1);
  expect(mocks.members).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Tất cả các nhóm (2)" }).className).toContain("bg-slate-900");
});

test("creator adds an existing account by normalized email and updates member count", async () => {
  mocks.addMember.mockResolvedValue({ userId: "u3", fullName: "Bình", email: "binh@example.com" });
  render(app());
  const buttons = await screen.findAllByRole("button", { name: "+ Thêm thành viên bằng email" });
  expect(buttons).toHaveLength(1);
  fireEvent.click(buttons[0]);
  await screen.findByText("an@example.com");
  fireEvent.change(screen.getByLabelText("Email thành viên mới"), { target: { value: "BINH@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên", exact: true }));
  await screen.findByText("Đã thêm Bình vào nhóm.");
  expect(mocks.addMember).toHaveBeenCalledWith("g1", { email: "binh@example.com" });
  expect(screen.getByText("2 thành viên")).toBeTruthy();
  expect(mocks.groups).toHaveBeenCalledTimes(1);
});

test("duplicate member error is displayed without closing the form", async () => {
  mocks.addMember.mockRejectedValue({ response: { data: { message: "Người dùng này đã là thành viên trong nhóm" } } });
  render(app());
  fireEvent.click(await screen.findByRole("button", { name: "+ Thêm thành viên bằng email" }));
  await screen.findByText("an@example.com");
  fireEvent.change(screen.getByLabelText("Email thành viên mới"), { target: { value: "an@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên", exact: true }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Người dùng này đã là thành viên trong nhóm");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("all-groups view includes subsequent backend pages", async () => {
  mocks.transactions.mockImplementation(async (id, { page }) => ({ content: [{ id: `${id}-${page}`, title: `${id} trang ${page}`, createdAt: "2026-09-22" }], totalPages: id === "g1" ? 2 : 1 }));
  render(app());
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toContain("g1 trang 1"));
  expect(screen.getByTestId("transactions").textContent).toContain("g2 trang 0");
});

test("late response from the previous group cannot overwrite the current selection", async () => {
  render(app());
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toContain("Hóa đơn g2"));
  let resolveOld;
  mocks.transactions.mockImplementation((id) => id === "g1"
    ? new Promise((resolve) => { resolveOld = resolve; })
    : Promise.resolve({ content: [{ id: "new", title: "Nhóm đang chọn", groupId: "g2" }], totalPages: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Nhóm Một", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Nhóm Hai", exact: true }));
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toBe("Nhóm đang chọn"));
  resolveOld({ content: [{ id: "old", title: "Kết quả cũ", groupId: "g1" }], totalPages: 1 });
  await waitFor(() => expect(screen.getByTestId("transactions").textContent).toBe("Nhóm đang chọn"));
});
