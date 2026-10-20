import test from 'node:test';
import assert from 'node:assert/strict';
import { emailForUsername, normalizeUsername, validateDisplayName, validatePassword } from '../src/utils/account.js';
test('normaliza username y genera email interno estable', () => {
  assert.equal(normalizeUsername('  PePiTo  '), 'pepito');
  assert.equal(emailForUsername(' PePiTo '), 'pepito@users.novacore');
  assert.equal(emailForUsername('ianova'), 'ianova@users.novacore');
});
test('no admite espacios o símbolos en username', () => {
  assert.throws(() => emailForUsername('juan perez'));
  assert.throws(() => emailForUsername('a'));
  assert.throws(() => emailForUsername('niño'));
});
test('valida nombres y contraseñas sin guardarlos', () => {
  assert.equal(validateDisplayName('  María   López '), 'María López');
  assert.throws(() => validateDisplayName('A'));
  assert.throws(() => validatePassword('corta'));
  assert.equal(validatePassword('contraseña-muy-larga'), 'contraseña-muy-larga');
});
