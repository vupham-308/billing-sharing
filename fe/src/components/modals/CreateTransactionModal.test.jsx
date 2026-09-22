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

test("custom share entry preserves typed amount without auto-rebalance and disables submit until sum matches", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={submit} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");

  fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh số tiền từng người" }));
  fireEvent.change(screen.getByLabelText("Số tiền của vu"), { target: { value: "60000" } });
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("60000");
  fireEvent.blur(screen.getByLabelText("Số tiền của vu"));
  // Vu keeps 60.000 without snapping back, Payer stays 55.555 without auto-rebalancing
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("60.000");
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");

  // Sum (115.555) > Total (111.111): Submit button must be disabled
  fireEvent.change(screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu..."), { target: { value: "Dinner" } });
  const submitBtn = screen.getByRole("button", { name: "Xác nhận tạo hóa đơn" });
  expect(submitBtn.disabled).toBe(true);

  // Fix Payer's share to make total match exactly
  fireEvent.change(screen.getByLabelText("Số tiền của Payer"), { target: { value: "51111" } });
  fireEvent.blur(screen.getByLabelText("Số tiền của Payer"));
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("51.111");
  expect(submitBtn.disabled).toBe(false);

  fireEvent.click(submitBtn);
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
    totalAmount: 111111, shares: [{ userId: "vu", shareAmount: 60000 }, { userId: "payer", shareAmount: 51111 }],
  })));
});

test("under-allocated shares show difference, disable submit, and equal split button resets", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={submit} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  expect(screen.getByLabelText("Tổng đã chia / tổng hóa đơn").textContent.replace(/\s/g, " ")).toBe("111.111 ₫ / 111.111 ₫");
  expect(screen.getByText("(Đã khớp)")).toBeTruthy();

  // Edit vu to 50000
  fireEvent.change(screen.getByLabelText("Số tiền của vu"), { target: { value: "50000" } });
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  fireEvent.keyDown(screen.getByLabelText("Số tiền của vu"), { key: "Enter" });
  expect(submit).not.toHaveBeenCalled();
  // Payer MUST NOT be rebalanced
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  expect(screen.getByText(/Thiếu/)).toBeTruthy();

  const submitBtn = screen.getByRole("button", { name: "Xác nhận tạo hóa đơn" });
  expect(submitBtn.disabled).toBe(true);

  // Clicking "Chia đều" resets everyone to balanced equal shares
  fireEvent.click(screen.getByRole("button", { name: /Chia đều/ }));
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  expect(screen.getByLabelText("Số tiền của Payer").value).toBe("55.555");
  expect(screen.getByText("(Đã khớp)")).toBeTruthy();
  expect(submitBtn.disabled).toBe(false);
});

test("clearing and retyping does not alter others; an empty blur restores the amount", async () => {
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={vi.fn()} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "111111" } });
  const input = screen.getByLabelText("Số tiền của Payer");
  fireEvent.change(input, { target: { value: "" } });
  expect(input.value).toBe("");
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  fireEvent.blur(input);
  expect(input.value).toBe("55.555");
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.change(input, { target: { value: "4" } });
  fireEvent.change(input, { target: { value: "40000" } });
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
  fireEvent.blur(input);
  expect(input.value).toBe("40.000");
  expect(screen.getByLabelText("Số tiền của vu").value).toBe("55.556");
});

test("submitting with an unblurred draft sends the committed values when sum matches", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={submit} />);
  await screen.findByText("vu");
  fireEvent.change(screen.getByLabelText("Tổng số tiền"), { target: { value: "100000" } });
  fireEvent.change(screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu..."), { target: { value: "Dinner" } });
  fireEvent.change(screen.getByLabelText("Số tiền của vu"), { target: { value: "60000" } });
  fireEvent.blur(screen.getByLabelText("Số tiền của vu"));
  // Unblurred draft for Payer
  fireEvent.change(screen.getByLabelText("Số tiền của Payer"), { target: { value: "40000" } });
  fireEvent.submit(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn" }).closest("form"));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
    shares: [{ userId: "vu", shareAmount: 60000 }, { userId: "payer", shareAmount: 40000 }],
  })));
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

test("total amount input handles focus, editing raw digits, live preview, and blur formatting", async () => {
  render(<CreateTransactionModal isOpen groups={groups} currentUserId="payer" onClose={() => {}} onSubmit={vi.fn()} />);
  await screen.findByText("vu");

  const totalInput = screen.getByLabelText("Tổng số tiền");
  expect(totalInput.value).toBe("");

  // Focus into total amount input
  fireEvent.focus(totalInput);
  fireEvent.change(totalInput, { target: { value: "343233" } });
  // While focused, it shows raw digits to prevent Telex/IME cursor jumps
  expect(totalInput.value).toBe("343233");
  // Live formatted preview is visible
  expect(screen.getByText(/=\s*343\.233\s*₫/)).toBeTruthy();

  // Appending digits at the end
  fireEvent.change(totalInput, { target: { value: "3432330" } });
  expect(totalInput.value).toBe("3432330");
  expect(screen.getByText(/=\s*3\.432\.330\s*₫/)).toBeTruthy();

  // On blur, the input formats with dots
  fireEvent.blur(totalInput);
  expect(totalInput.value).toBe("3.432.330");
});

test("reopening or closing modal resets form fields so subsequent transactions start clean", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <CreateTransactionModal
      isOpen={true}
      groups={groups}
      currentUserId="payer"
      onClose={() => {}}
      onSubmit={submit}
    />
  );
  await screen.findByText("vu");

  const titleInput = screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu...");
  const totalInput = screen.getByLabelText("Tổng số tiền");

  fireEvent.change(titleInput, { target: { value: "ăn tối" } });
  fireEvent.change(totalInput, { target: { value: "300000" } });
  expect(titleInput.value).toBe("ăn tối");
  expect(totalInput.value).toBe("300.000");

  // User submits or closes modal
  rerender(
    <CreateTransactionModal
      isOpen={false}
      groups={groups}
      currentUserId="payer"
      onClose={() => {}}
      onSubmit={submit}
    />
  );

  // User reopens modal to create a new transaction
  rerender(
    <CreateTransactionModal
      isOpen={true}
      groups={groups}
      currentUserId="payer"
      onClose={() => {}}
      onSubmit={submit}
    />
  );
  await screen.findByText("vu");

  const newTitleInput = screen.getByPlaceholderText("VD: Tiền phòng tháng 9, Ăn lẩu...");
  const newTotalInput = screen.getByLabelText("Tổng số tiền");

  expect(newTitleInput.value).toBe("");
  expect(newTotalInput.value).toBe("");
});
