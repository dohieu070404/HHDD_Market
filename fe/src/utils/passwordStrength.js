export function passwordStrength(password) {
  const pw = String(password || "");
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  score = Math.min(score, 4);
  const label = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][score];
  return { score, label };
}
