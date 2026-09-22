import { expect, test, vi } from "vitest";
import { createPendingRequests } from "./pendingRequests";

test("concurrent reads share one request but later refreshes fetch fresh data", async () => {
  const read = createPendingRequests();
  const request = vi.fn().mockResolvedValue([1]);
  await Promise.all([read("user:/groups", request), read("user:/groups", request)]);
  expect(request).toHaveBeenCalledTimes(1);
  await read("user:/groups", request);
  expect(request).toHaveBeenCalledTimes(2);
});

test("failures are not cached and different identities do not share requests", async () => {
  const read = createPendingRequests();
  const fail = vi.fn().mockRejectedValue(new Error("offline"));
  await expect(read("user1", fail)).rejects.toThrow("offline");
  const request = vi.fn().mockResolvedValue("ok");
  await Promise.all([read("user1", request), read("user2", request)]);
  expect(request).toHaveBeenCalledTimes(2);
});
