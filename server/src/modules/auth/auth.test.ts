import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { enforceStoreScope, type StoreRow } from './storeScope.js';
import { createToken, verifyToken, type AuthUser } from './token.service.js';

const areaManager: AuthUser = {
  locationId: 10,
  locationName: 'Area 1',
  username: 'am1',
  access: 'Area Manager',
};

const mockStores: StoreRow[] = [
  { LOCATIONID: 101, LOCATIONNAME: 'Store A', ORGLOCATIONREF: 'A' },
  { LOCATIONID: 102, LOCATIONNAME: 'Store B', ORGLOCATIONREF: 'B' },
];

function signRawPayload(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const input = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  const sig = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(input)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${input}.${sig}`;
}

function mockRes(): { res: Response; statusCode: number; body: unknown } {
  const state = { statusCode: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
  };
}

test('verifyToken accepts a valid token and rejects missing/zero/expired exp', () => {
  const token = createToken(areaManager, 300);
  assert.deepEqual(verifyToken(token), areaManager);

  const zeroExp = signRawPayload({ ...areaManager, iat: 100, exp: 0 });
  assert.equal(verifyToken(zeroExp), null);

  const missingExp = signRawPayload({ ...areaManager, iat: 100 });
  assert.equal(verifyToken(missingExp), null);

  const missingAccess = signRawPayload({
    locationId: 10,
    locationName: 'Area 1',
    username: 'am1',
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  assert.equal(verifyToken(missingAccess), null);
});

test('enforceStoreScope allows assigned store, ALL, and whitespace, and caches scopedStores', async () => {
  let dbCalls = 0;
  const resolveStores = async () => {
    dbCalls++;
    return mockStores;
  };

  for (const locationName of ['Store A', '  store b  ', 'ALL', 'ALL_PENDING', '   ']) {
    const req = { user: areaManager, body: { locationName } } as unknown as AuthenticatedRequest;
    const m = mockRes();
    let calledNext = false;
    await enforceStoreScope(req, m.res, () => {
      calledNext = true;
    }, resolveStores);
    assert.equal(calledNext, true, `Expected next() for locationName=${JSON.stringify(locationName)}`);
    assert.deepEqual(req.allowedStoreNames, ['Store A', 'Store B']);
    assert.deepEqual(req.scopedStores, mockStores);
  }
  assert.equal(dbCalls, 5);
});

test('enforceStoreScope rejects unauthorized store (403) and array/object bypass (400)', async () => {
  const resolveStores = async () => mockStores;

  // Unauthorized store
  const unauthReq = { user: areaManager, body: { locationName: 'Store C' } } as unknown as AuthenticatedRequest;
  const unauthRes = mockRes();
  let nextCalled = false;
  await enforceStoreScope(unauthReq, unauthRes.res, () => {
    nextCalled = true;
  }, resolveStores);
  assert.equal(nextCalled, false);
  assert.equal(unauthRes.statusCode, 403);

  // Array bypass attempt
  const arrayReq = { user: areaManager, query: { locationName: ['Store C'] } } as unknown as AuthenticatedRequest;
  const arrayRes = mockRes();
  await enforceStoreScope(arrayReq, arrayRes.res, () => {
    nextCalled = true;
  }, resolveStores);
  assert.equal(nextCalled, false);
  assert.equal(arrayRes.statusCode, 400);
});
