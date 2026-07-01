// Region-based tax (VAT/GST) rates. UK-first; extend as more regions launch.
// Returns the tax rate as a percentage (e.g. 20 = 20%).
const TAX_RATES = Object.freeze({
  GB: 20, // United Kingdom VAT
  IE: 23,
  DE: 19,
  FR: 20,
});

const COUNTRY_ALIASES = Object.freeze({
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  england: 'GB',
  gb: 'GB',
  ireland: 'IE',
  germany: 'DE',
  france: 'FR',
});

const normalizeCountry = (country) => {
  if (!country) return null;
  const c = String(country).trim().toLowerCase();
  if (COUNTRY_ALIASES[c]) return COUNTRY_ALIASES[c];
  return c.length === 2 ? c.toUpperCase() : null;
};

// Tax rate (%) for a shipping destination. Unknown/no country → 0 (no tax).
const taxRateForCountry = (country) => {
  const code = normalizeCountry(country);
  return code && TAX_RATES[code] != null ? TAX_RATES[code] : 0;
};

// Compute the tax amount (rounded to 2dp) for a taxable subtotal.
const computeTax = (subtotal, country) => {
  const rate = taxRateForCountry(country);
  return Math.round(subtotal * rate) / 100;
};

module.exports = { taxRateForCountry, computeTax, TAX_RATES };
