import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  s,
  validate,
  validateBody,
  validateHeaders,
  validateParams,
  validateQuery,
} from '../index.ts';

function mockReqRes(initial = {}) {
  let statusCode = 200;
  let jsonBody = null;
  const context = {
    req: { ...initial },
    res: {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonBody = body;
        return this;
      },
      get statusCode() {
        return statusCode;
      },
      get jsonBody() {
        return jsonBody;
      },
    },
    nextCalled: false,
    nextError: undefined,
  };
  context.next = (err) => {
    context.nextCalled = true;
    context.nextError = err;
  };
  return context;
}

test('validate validates and transforms req.body', () => {
  const schema = s.object({ name: s.string(), age: s.number() });
  const middleware = validate({ body: schema });
  const ctx = mockReqRes({ body: { name: 'Alice', age: 42 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.deepEqual(ctx.req.body, { name: 'Alice', age: 42 });
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.jsonBody, null);
  assert.equal(ctx.nextCalled, true);
  assert.equal(ctx.nextError, undefined);
});

test('validate returns 400 on invalid req.body', () => {
  const schema = s.object({ name: s.string(), age: s.number() });
  const middleware = validate({ body: schema });
  const ctx = mockReqRes({ body: { name: 'Alice', age: 'not-a-number' } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of number/);
  assert.equal(ctx.nextCalled, false);
});

test('validate validates req.query and req.params', () => {
  const middleware = validate({
    query: s.object({ q: s.string() }),
    params: s.object({ id: s.string() }),
  });
  const ctx = mockReqRes({ query: { q: 'search' }, params: { id: '123' } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.deepEqual(ctx.req.query, { q: 'search' });
  assert.deepEqual(ctx.req.params, { id: '123' });
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.jsonBody, null);
  assert.equal(ctx.nextCalled, true);
  assert.equal(ctx.nextError, undefined);
});

test('validate returns 400 on invalid req.query', () => {
  const middleware = validate({ query: s.object({ q: s.string() }) });
  const ctx = mockReqRes({ query: { q: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of string/);
  assert.equal(ctx.nextCalled, false);
});

test('validate returns 400 on invalid req.params', () => {
  const middleware = validate({ params: s.object({ id: s.string() }) });
  const ctx = mockReqRes({ params: { id: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of string/);
  assert.equal(ctx.nextCalled, false);
});

test('validateBody supports custom error handler', () => {
  const schema = s.object({ foo: s.string() });
  let called = false;
  const customHandler = ({ req, res, next, part, error, result }) => {
    called = true;
    assert.equal(part, 'body');
    assert(res);
    assert(req);
    assert(error);
    assert(result);
    res.status(422).json({ custom: true, message: error.message });
  };
  const middleware = validateBody(schema, customHandler);
  const ctx = mockReqRes({ body: { foo: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 422);
  assert.equal(ctx.res.jsonBody.custom, true);
  assert.equal(called, true);
});

test('validateQuery supports custom error handler and calls next', () => {
  const schema = s.object({ q: s.string() });
  let called = false;
  const customHandler = ({ req, res, next, part, error, result }) => {
    called = true;
    assert.equal(part, 'query');
    next(error);
  };
  const middleware = validateQuery(schema, customHandler);
  const ctx = mockReqRes({ query: { q: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.nextCalled, true);
  assert(ctx.nextError);
  assert.equal(called, true);
});

test('validateParams supports custom error handler', () => {
  const schema = s.object({ id: s.string() });
  let called = false;
  const customHandler = ({ req, res, next, part, error, result }) => {
    called = true;
    res.status(418).json({ error: 'I am a teapot' });
  };
  const middleware = validateParams(schema, customHandler);
  const ctx = mockReqRes({ params: { id: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 418);
  assert.equal(ctx.res.jsonBody.error, 'I am a teapot');
  assert.equal(called, true);
});

test('validateHeaders supports custom error handler', () => {
  const schema = s.object({ authorization: s.string() });
  let called = false;
  const customHandler = ({ req, res, next, part, error, result }) => {
    called = true;
    res.status(401).json({ error: 'Unauthorized' });
  };
  const middleware = validateHeaders(schema, customHandler);
  const ctx = mockReqRes({ headers: { authorization: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 401);
  assert.equal(ctx.res.jsonBody.error, 'Unauthorized');
  assert.equal(called, true);
});

test('validate supports custom error handler for any part', () => {
  const schemas = {
    body: s.object({ foo: s.string() }),
    query: s.object({ bar: s.string() }),
  };
  const calledParts = [];
  const customHandler = ({ req, res, next, part, error, result }) => {
    calledParts.push(part);
    res.status(400).json({ error: part });
  };
  const middleware = validate(schemas, customHandler);
  const ctx = mockReqRes({ body: { foo: 123 }, query: { bar: 123 } });
  middleware(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400);
  assert.equal(ctx.res.jsonBody.error, 'body');
  assert.deepEqual(calledParts, ['body']); // stops at first error
});
