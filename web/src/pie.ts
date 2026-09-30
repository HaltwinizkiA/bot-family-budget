const COLORS = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#4b5563", "#ca8a04"];

export function pieMarkup(slices: { category: string; amount: string }[]): string {
  if (slices.length === 0) return "";
  const total = slices.reduce((sum, slice) => sum + Number(slice.amount), 0);
  if (total <= 0) return "";
  const cx = 100;
  const cy = 100;
  const radius = 80;
  if (slices.length === 1) {
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Расходы"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="${COLORS[0]}"></circle></svg>`;
  }
  let angle = -Math.PI / 2;
  const paths = slices.map((slice, index) => {
    const delta = (Number(slice.amount) / total) * Math.PI * 2;
    const start = angle;
    const end = angle + delta;
    angle = end;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = delta > Math.PI ? 1 : 0;
    const color = COLORS[index % COLORS.length];
    return `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}"></path>`;
  });
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Расходы">${paths.join("")}</svg>`;
}
