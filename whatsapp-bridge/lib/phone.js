'use strict';

// WhatsApp wants the full international number as digits only (no "+",
// spaces or dashes) and never a leading zero.
function normalizePhone(value) {
  const digits = String(value ?? '').replace(/[\s()+.-]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new Error('Use a full international phone number with country code (8-15 digits).');
  }
  return digits;
}

function isGroupId(value) {
  return /^[0-9]+(-[0-9]+)?@g\.us$/.test(String(value ?? ''));
}

module.exports = { normalizePhone, isGroupId };
