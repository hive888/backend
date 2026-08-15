const ROLE_IDS = {
  administrator: 'fd487831-19c2-11f0-8461-c89402834315',
  customer: 'fd50497c-19c2-11f0-8461-c89402834315',
  superadmin: 'fd4fe48e-19c2-11f0-8461-c89402834315',
};

const ADMINISTRATOR_ROLES = ['administrator', 'admin', 'superadmin'];
const USER_ROLES = ['customer', 'user'];

function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || 'admin@hive888.org';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRoles(user = {}) {
  const fromArray = Array.isArray(user.roles) ? user.roles : [];
  const fromName = user.role_name
    ? String(user.role_name).split(',')
    : [];
  return [...fromArray, ...fromName]
    .map((role) => String(role).trim().toLowerCase())
    .filter(Boolean);
}

function isAdministrator(user) {
  return normalizeRoles(user).some((role) => ADMINISTRATOR_ROLES.includes(role));
}

function expandRequiredRoles(required = []) {
  const list = (Array.isArray(required) ? required : [required])
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean);
  const expanded = new Set();
  for (const role of list) {
    if (role === 'administrator' || role === 'admin') {
      ADMINISTRATOR_ROLES.forEach((item) => expanded.add(item));
    } else if (role === 'customer' || role === 'user') {
      USER_ROLES.forEach((item) => expanded.add(item));
    } else {
      expanded.add(role);
    }
  }
  return [...expanded];
}

module.exports = {
  ROLE_IDS,
  ADMINISTRATOR_ROLES,
  USER_ROLES,
  parseAdminEmails,
  normalizeRoles,
  isAdministrator,
  expandRequiredRoles,
};
