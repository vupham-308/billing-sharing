// Payer receives the remainder, regardless of their position in the member list.
export function splitAmount(total, memberIds, payerId) {
  if (!Number.isSafeInteger(total) || total < memberIds.length || !memberIds.length) return {};
  const remainderId = memberIds.includes(payerId) ? payerId : memberIds[0];
  const others = memberIds.filter((id) => id !== remainderId);
  const rounded = Math.ceil(total / memberIds.length);
  const result = {};
  let remaining = total;
  others.forEach((id, index) => {
    // Reserve at least 1 VND per remaining participant, as required by the API.
    result[id] = Math.min(rounded, remaining - (others.length - index));
    remaining -= result[id];
  });
  result[remainderId] = remaining;
  return result;
}

export function editShare(total, memberIds, payerId, shares, editedId, requested) {
  if (!memberIds.includes(editedId) || total < memberIds.length) return shares;
  const othersTotal = memberIds.filter((id) => id !== editedId)
    .reduce((sum, id) => sum + shares[id], 0);
  const maximum = total - othersTotal;
  const value = Math.max(1, Math.min(Number.isFinite(requested) ? requested : maximum, maximum));
  const result = { ...shares, [editedId]: value };
  const remainder = total - othersTotal - value;
  const recipient = payerId !== editedId && memberIds.includes(payerId)
    ? payerId : memberIds.find((id) => id !== editedId);
  if (recipient) result[recipient] += remainder;
  else result[editedId] = total;
  return result;
}
