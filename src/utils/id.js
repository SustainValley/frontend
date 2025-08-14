export const isNumericOnly = (v = "") => /^\d+$/.test(String(v).trim());

export const digitsOnly = (v = "") => String(v).replace(/\D/g, "");

export const isBizNo = (v = "") => digitsOnly(v).length === 10;

export const hyphenizeBiz10 = (v = "") => {
  const d = digitsOnly(v).slice(0, 10);
  if (d.length !== 10) return v; 
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
};
