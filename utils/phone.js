// utils/phone.js
const parsePhoneNumber = require('libphonenumber-js');

function toE164(raw, defaultCountry = process.env.COUNTRY_DEFAULT || 'ET') {
  try {
    const p = parsePhoneNumber(raw, defaultCountry);
    if (!p || !p.isValid()) return null;
    return p.number; // "+2519…"
  } catch {
    return null;
  }
}

module.exports = { toE164 };
