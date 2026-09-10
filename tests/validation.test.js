import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  validateRoleCreate,
  validateUserCreate,
  validateUserUpdate,
} from '@/lib/validation';

const ROLE_ID = '8de6ac07-1d4b-440c-bfae-7e1cf5855a77';

describe('validateUserCreate', () => {
  it('accepts a complete payload and normalises it', () => {
    const result = validateUserCreate({
      email: '  Riyas@NewMass.com ',
      password: 'longenoughpw',
      roleId: ROLE_ID,
      fullName: '  Riyas  ',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        email: 'riyas@newmass.com', // trimmed and lower-cased
        password: 'longenoughpw',
        roleId: ROLE_ID,
        fullName: 'Riyas',
      },
    });
  });

  it('turns a blank name into null rather than an empty string', () => {
    const result = validateUserCreate({
      email: 'a@b.com',
      password: 'longenoughpw',
      roleId: ROLE_ID,
      fullName: '   ',
    });
    expect(result.ok).toBe(true);
    expect(result.value.fullName).toBeNull();
  });

  it('requires email, password and role', () => {
    expect(validateUserCreate({}).ok).toBe(false);
    expect(validateUserCreate({ email: 'a@b.com', password: 'longenoughpw' }).ok).toBe(false);
    expect(validateUserCreate({ email: 'a@b.com', roleId: ROLE_ID }).ok).toBe(false);
  });

  it('rejects a malformed email', () => {
    for (const email of ['nope', 'no@domain', '@b.com', 'a b@c.com']) {
      expect(
        validateUserCreate({ email, password: 'longenoughpw', roleId: ROLE_ID }).ok
      ).toBe(false);
    }
  });

  it('rejects a password below the minimum length', () => {
    const result = validateUserCreate({
      email: 'a@b.com',
      password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1),
      roleId: ROLE_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least/i);
  });

  it('rejects a role id that is not a uuid', () => {
    expect(
      validateUserCreate({ email: 'a@b.com', password: 'longenoughpw', roleId: 'admin' }).ok
    ).toBe(false);
  });

  it('rejects non-string junk without throwing', () => {
    expect(validateUserCreate(null).ok).toBe(false);
    expect(validateUserCreate({ email: 42, password: {}, roleId: [] }).ok).toBe(false);
  });
});

describe('validateUserUpdate', () => {
  it('allows a partial update of just the name', () => {
    expect(validateUserUpdate({ fullName: 'New Name' })).toEqual({
      ok: true,
      value: { fullName: 'New Name' },
    });
  });

  it('allows a partial update of just the role', () => {
    expect(validateUserUpdate({ roleId: ROLE_ID })).toEqual({
      ok: true,
      value: { roleId: ROLE_ID },
    });
  });

  it('treats a blank password as "leave it alone", not "set it to blank"', () => {
    const result = validateUserUpdate({ fullName: 'X', password: '' });
    expect(result.ok).toBe(true);
    expect(result.value).not.toHaveProperty('password');
  });

  it('enforces the same password floor as creation', () => {
    expect(validateUserUpdate({ password: 'short' }).ok).toBe(false);
    expect(validateUserUpdate({ password: 'longenoughpw' })).toEqual({
      ok: true,
      value: { password: 'longenoughpw' },
    });
  });

  it('rejects an empty payload so a no-op cannot masquerade as success', () => {
    const result = validateUserUpdate({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nothing to update/i);
  });

  it('rejects an invalid role id', () => {
    expect(validateUserUpdate({ roleId: 'not-a-uuid' }).ok).toBe(false);
  });

  it('clears the name when explicitly blanked', () => {
    const result = validateUserUpdate({ fullName: '  ' });
    expect(result.ok).toBe(true);
    expect(result.value.fullName).toBeNull();
  });
});

describe('validateRoleCreate', () => {
  it('accepts a name and trims it', () => {
    expect(validateRoleCreate({ roleName: '  Store Keeper  ' })).toEqual({
      ok: true,
      value: { roleName: 'Store Keeper', description: null },
    });
  });

  it('keeps a description when given', () => {
    const result = validateRoleCreate({ roleName: 'Chef', description: ' Runs the kitchen ' });
    expect(result.value.description).toBe('Runs the kitchen');
  });

  it('requires a name', () => {
    expect(validateRoleCreate({}).ok).toBe(false);
    expect(validateRoleCreate({ roleName: '   ' }).ok).toBe(false);
  });

  it('rejects a name longer than the column allows', () => {
    expect(validateRoleCreate({ roleName: 'x'.repeat(51) }).ok).toBe(false);
  });
});
