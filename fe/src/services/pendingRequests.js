// Share only concurrent reads. Settled data is never cached across mutations.
export function createPendingRequests() {
  const pending = new Map();
  return (key, request) => {
    if (!pending.has(key)) {
      const promise = Promise.resolve().then(request).finally(() => {
        if (pending.get(key) === promise) pending.delete(key);
      });
      pending.set(key, promise);
    }
    return pending.get(key);
  };
}
