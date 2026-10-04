// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTransactions from "./AdminTransactions";

const mocks = vi.hoisted(() => ({ list: vi.fn(), groups: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("../services/api", () => ({ adminTransactionApi: mocks }));
vi.mock("../components/Navbar", () => ({ default: () => null }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.groups.mockResolvedValue([{ id: "g1", name: "Nhóm Một" }, { id: "g2", name: "Nhóm Hai" }]);
  mocks.list.mockResolvedValue({ content: [{ id: "t1", title: "Ăn tối", groupName: "Nhóm Hai", payerName: "Thành", totalAmount: 21000,
    isPaid: false, sharingMembers: [{ id: "s1", fullName: "Minh", shareAmount: 7000, isPaid: false }] }], totalElements: 21, totalPages: 2 });
});
afterEach(cleanup);
const app = () => <MemoryRouter><AdminTransactions /></MemoryRouter>;

test("shows invoices from other groups with per-member payment state", async () => {
  render(app());
  expect(await screen.findByText("Ăn tối")).toBeTruthy();
  expect(screen.getByText("Thành")).toBeTruthy();
  expect(screen.getByText("Chưa trả")).toBeTruthy();
  expect(mocks.list).toHaveBeenCalledWith({ page: 0, size: 20 });
});

test("changing group or payment filters resets pagination and search is submitted", async () => {
  render(app());
  await screen.findByText("Ăn tối");
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, size: 20 }));
  await screen.findByText("Ăn tối");
  fireEvent.change(screen.getByLabelText("Nhóm"), { target: { value: "g2" } });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 0, size: 20, groupId: "g2" }));
  fireEvent.change(screen.getByLabelText("Thanh toán"), { target: { value: "false" } });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 0, size: 20, groupId: "g2", paid: "false" }));
  fireEvent.change(screen.getByLabelText("Tìm hóa đơn, nhóm hoặc người trả"), { target: { value: " Minh " } });
  fireEvent.click(screen.getByRole("button", { name: "Tìm", exact: true }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 0, size: 20, groupId: "g2", paid: "false", search: "Minh" }));
});

test("failed loads can be retried and empty results disable pagination", async () => {
  mocks.list.mockRejectedValueOnce(new Error("network"));
  render(app());
  expect(await screen.findByRole("alert")).toBeTruthy();
  mocks.list.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
  expect(await screen.findByText("Không có hóa đơn phù hợp.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Trang sau" }).disabled).toBe(true);
});

test("admin edits per-share status and refreshes after saving", async () => {
  mocks.update.mockResolvedValue(undefined);
  render(app());
  await screen.findByText("Ăn tối");
  fireEvent.click(screen.getByRole("button", { name: "Sửa", exact: true }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Đã trả: Minh" }));
  fireEvent.change(screen.getByLabelText("Tên hóa đơn"), { target: { value: "Ăn tối đã sửa" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("t1", {
    title: "Ăn tối đã sửa", totalAmount: 21000,
    sharingMembers: [{ id: "s1", shareAmount: 7000, isPaid: true }],
  }));
  expect(await screen.findByText("Đã cập nhật hóa đơn.")).toBeTruthy();
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
});

test("delete needs explicit confirmation and failed deletes keep the dialog open", async () => {
  mocks.delete.mockRejectedValueOnce({ response: { data: { message: "Đang chờ thanh toán" } } });
  render(app());
  await screen.findByText("Ăn tối");
  fireEvent.click(screen.getByRole("button", { name: "Xóa", exact: true }));
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  expect(await screen.findByText("Đang chờ thanh toán")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  mocks.delete.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  expect(await screen.findByText("Đã xóa hóa đơn. Lịch sử thanh toán được giữ lại.")).toBeTruthy();
  expect(mocks.delete).toHaveBeenCalledWith("t1", false);
});
