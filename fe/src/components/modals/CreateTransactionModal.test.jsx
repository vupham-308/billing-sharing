// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreateTransactionModal from "./CreateTransactionModal";

vi.mock("../../services/api", () => ({ groupApi: { getMembers: vi.fn() } }));
afterEach(cleanup);
const groups = [{ id: "g1", name: "Nhóm", members: [
  { userId: "vu", fullName: "vu" }, { userId: "payer", fullName: "Payer" },
] }];

test("shown amounts match submitted amounts and oversized custom edit snaps back", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={submit} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh số tiền từng người" }));
  fireEvent.change(screen.getByLabelText("Số tiền của vu"), { target: { value: "60000" } });
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  fireEvent.change(screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu..."), { target: { value: "Dinner" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
    totalAmount: 111111, shares: [{ userId: "vu", shareAmount: 55556 }, { userId: "payer", shareAmount: 55555 }],
  })));
});

test("equal split remains editable, shows totals, submits edits and can split again", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={submit} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  expect(screen.getByLabelText("Tổng đã chia / tổng hóa đơn").textContent.replace(/\s/g, " ")).toBe("111.111 ₫ / 111.111 ₫");
  fireEvent.change(screen.getByLabelText("Số tiền của vu"), { target: { value: "50000" } });
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("61.111");
  expect(screen.getByLabelText("Tổng đã chia / tổng hóa đơn").textContent.replace(/\s/g, " ")).toBe("111.111 ₫ / 111.111 ₫");
  fireEvent.change(screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu..."), { target: { value: "Dinner" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
    shares: [{ userId: "vu", shareAmount: 50000 }, { userId: "payer", shareAmount: 61111 }],
  })));
  fireEvent.click(screen.getByRole("button", { name: /Chia đều/ }));
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
});

test("changing total or selection recalculates custom shares", async () => {
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={vi.fn()} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh số tiền từng người" }));
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "100001" } });
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("50.001");
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("50.000");
  fireEvent.click(screen.getByText("vu"));
  expect(screen.queryByLabelText("Số tiền của vu")).toBeNull();
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("100.001");
});
