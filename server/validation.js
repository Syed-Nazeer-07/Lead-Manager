export const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost'];
export const SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Other'];

export function validateLead(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { form: 'Please provide a valid lead.' }, value: null };
  }
  const fields = ['name', 'email', 'phone', 'company', 'source', 'status'];
  const value = {};
  for (const field of fields) {
    if (typeof input[field] !== 'string') {
      errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`;
      continue;
    }
    value[field] = input[field].trim();
    if (!value[field]) errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`;
  }
  if (value.name && value.name.length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (value.company && value.company.length > 120) errors.company = 'Company must be 120 characters or fewer.';
  if (value.email && (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors.email = 'Enter a valid email address.';
  if (value.phone && (value.phone.length > 25 || !/^\+?[0-9().\s-]{7,25}$/.test(value.phone))) errors.phone = 'Enter a valid phone number.';
  if (value.source && !SOURCES.includes(value.source)) errors.source = 'Choose a valid source.';
  if (value.status && !STATUSES.includes(value.status)) errors.status = 'Choose a valid status.';
  return { value, errors };
}
