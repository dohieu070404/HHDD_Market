export function getReputationTitle(score) {
  const s = Number(score || 0);
  if (s >= 90) return "Shop Kim Cương";
  if (s >= 80) return "Shop Vàng";
  if (s >= 60) return "Shop Bạc";
  if (s >= 40) return "Shop Đồng";
  if (s >= 20) return "Shop nguy cơ";
  return "Shop tín nhiệm thấp";
}
