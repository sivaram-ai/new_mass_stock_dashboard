export const UNITS = ['count', 'weight', 'kg', 'g', 'lt', 'ml', 'packet', 'box'];

export const ACTION_TYPES = ['CREDIT', 'DEBIT', 'INITIAL'];

export const ROLE_ADMIN = 'Admin';
export const ROLE_MANAGER = 'Manager';
export const ROLE_KITCHEN = 'Kitchen Staff';

/** Roles allowed to maintain the catalogue. Mirrors can_manage_items() in SQL. */
export const CATALOGUE_ROLES = [ROLE_ADMIN, ROLE_MANAGER];

export function canManageItems(roleName) {
  return CATALOGUE_ROLES.includes(roleName);
}

export function canCredit(roleName) {
  return roleName !== ROLE_KITCHEN;
}

export function isAdmin(roleName) {
  return roleName === ROLE_ADMIN;
}
