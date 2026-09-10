/**
 * Payload validation shared by the /api/admin/* routes.
 *
 * Kept out of the route files so the create and update paths cannot drift
 * apart (a password rule enforced on create but not on update is exactly the
 * kind of gap that lets a weak credential in through the back door), and so
 * the rules can be unit tested without standing up a request.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 120;
export const MAX_ROLE_NAME_LENGTH = 50;

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/** @returns {{ok: true, value: object} | {ok: false, error: string}} */
export function validateUserCreate(body) {
  const email = str(body?.email).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const roleId = str(body?.roleId);
  const fullName = str(body?.fullName);

  if (!email || !password || !roleId) {
    return { ok: false, error: 'Email, password and role are all required' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (!UUID_RE.test(roleId)) {
    return { ok: false, error: 'Select a valid role' };
  }
  if (fullName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }

  return { ok: true, value: { email, password, roleId, fullName: fullName || null } };
}

/**
 * Update payload. Every field is optional — only what is supplied is changed —
 * but at least one must be present, and a supplied field still has to be valid.
 * A blank password means "leave the current one alone", not "set it to blank".
 */
export function validateUserUpdate(body) {
  const value = {};

  if (body?.fullName !== undefined) {
    const fullName = str(body.fullName);
    if (fullName.length > MAX_NAME_LENGTH) {
      return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` };
    }
    value.fullName = fullName || null;
  }

  if (body?.password !== undefined && body.password !== '') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    value.password = password;
  }

  if (body?.roleId !== undefined) {
    const roleId = str(body.roleId);
    if (!UUID_RE.test(roleId)) {
      return { ok: false, error: 'Select a valid role' };
    }
    value.roleId = roleId;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: 'Nothing to update' };
  }

  return { ok: true, value };
}

/** @returns {{ok: true, value: object} | {ok: false, error: string}} */
export function validateRoleCreate(body) {
  const roleName = str(body?.roleName);
  const description = str(body?.description);

  if (!roleName) {
    return { ok: false, error: 'Role name is required' };
  }
  if (roleName.length > MAX_ROLE_NAME_LENGTH) {
    return { ok: false, error: `Role name must be ${MAX_ROLE_NAME_LENGTH} characters or fewer` };
  }

  return { ok: true, value: { roleName, description: description || null } };
}

export function isUuid(value) {
  return UUID_RE.test(str(value));
}
