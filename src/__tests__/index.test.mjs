import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
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
  // Prepare
  const schema = s.object({ name: s.string(), age: s.number() });
  const middleware = validate({ body: schema });
  const ctx = mockReqRes({ body: { name: 'Alice', age: 42 } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.deepEqual(ctx.req.schema.body, { name: 'Alice', age: 42 });
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.jsonBody, null);
  assert.equal(ctx.nextCalled, true);
  assert.equal(ctx.nextError, undefined);
});

test('validate returns 400 on invalid req.body', () => {
  // Prepare
  const schema = s.object({ name: s.string(), age: s.number() });
  const middleware = validate({ body: schema });
  const ctx = mockReqRes({ body: { name: 'Alice', age: 'not-a-number' } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of number/);
  assert.equal(ctx.nextCalled, false);
});

test('validate validates req.query and req.params', () => {
  // Prepare
  const middleware = validate({
    query: s.object({ q: s.string() }),
    params: s.object({ id: s.string() }),
  });
  const ctx = mockReqRes({ query: { q: 'search' }, params: { id: '123' } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.deepEqual(ctx.req.schema.query, { q: 'search' });
  assert.deepEqual(ctx.req.schema.params, { id: '123' });
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.jsonBody, null);
  assert.equal(ctx.nextCalled, true);
  assert.equal(ctx.nextError, undefined);
});

test('validate returns 400 on invalid req.query', () => {
  // Prepare
  const middleware = validate({ query: s.object({ q: s.string() }) });
  const ctx = mockReqRes({ query: { q: 123 } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of string/);
  assert.equal(ctx.nextCalled, false);
});

test('validate returns 400 on invalid req.params', () => {
  // Prepare
  const middleware = validate({ params: s.object({ id: s.string() }) });
  const ctx = mockReqRes({ params: { id: 123 } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.equal(ctx.res.statusCode, 400);
  assert.match(ctx.res.jsonBody.error, /must be type of string/);
  assert.equal(ctx.nextCalled, false);
});

test('validateBody supports custom error handler', () => {
  // Prepare
  const schema = s.object({ foo: s.string() });
  const customHandler = mock.fn(({ req, res, next, part, error, result }) => {
    assert.equal(part, 'body');
    assert(res);
    assert(req);
    assert(error);
    assert(result);
    res.status(422).json({ custom: true, message: error.message });
  });
  const middleware = validateBody(schema, customHandler);
  const ctx = mockReqRes({ body: { foo: 123 } });

  // Act
  middleware(ctx.req, ctx.res, ctx.next);

  // Assert
  assert.equal(ctx.res.statusCode, 422);
  assert.equal(ctx.res.jsonBody.custom, true);
  assert.equal(customHandler.mock.calls.length, 1);
});

test('validateQuery supports custom error handler and calls next', () => {
  // Prepare
  const schema = s.object({ q: s.string() });
  const customHandler = mock.fn(({ req, res, next, part, error, result }) => {
    assert.equal(part, 'query');
    next(error);
  });
  const middleware = validateQuery(schema, customHandler);
  const ctx = mockReqRes({ query: { q: 123 } });
  // Act
  middleware(ctx.req, ctx.res, ctx.next);
  // Assert
  assert.equal(ctx.nextCalled, true);
  assert(ctx.nextError);
  assert.equal(customHandler.mock.calls.length, 1);
});

test('validateParams supports custom error handler', () => {
  // Prepare
  const schema = s.object({ id: s.string() });
  const customHandler = mock.fn(({ req, res, next, part, error, result }) => {
    res.status(418).json({ error: 'I am a teapot' });
  });
  const middleware = validateParams(schema, customHandler);
  const ctx = mockReqRes({ params: { id: 123 } });
  // Act
  middleware(ctx.req, ctx.res, ctx.next);
  // Assert
  assert.equal(ctx.res.statusCode, 418);
  assert.equal(ctx.res.jsonBody.error, 'I am a teapot');
  assert.equal(customHandler.mock.calls.length, 1);
});

test('validateHeaders supports custom error handler', () => {
  // Prepare
  const schema = s.object({ authorization: s.string() });
  const customHandler = mock.fn(({ req, res, next, part, error, result }) => {
    res.status(401).json({ error: 'Unauthorized' });
  });
  const middleware = validateHeaders(schema, customHandler);
  const ctx = mockReqRes({ headers: { authorization: 123 } });
  // Act
  middleware(ctx.req, ctx.res, ctx.next);
  // Assert
  assert.equal(ctx.res.statusCode, 401);
  assert.equal(ctx.res.jsonBody.error, 'Unauthorized');
  assert.equal(customHandler.mock.calls.length, 1);
});

test('validate supports custom error handler for any part', () => {
  // Prepare
  const schemas = {
    body: s.object({ foo: s.string() }),
    query: s.object({ bar: s.string() }),
  };
  const customHandler = mock.fn(({ req, res, next, part, error, result }) => {
    res.status(400).json({ error: part });
  });
  const middleware = validate(schemas, customHandler);
  const ctx = mockReqRes({ body: { foo: 123 }, query: { bar: 123 } });
  // Act
  middleware(ctx.req, ctx.res, ctx.next);
  // Assert
  assert.equal(ctx.res.statusCode, 400);
  assert.equal(ctx.res.jsonBody.error, 'body');
  assert.equal(customHandler.mock.calls.length, 1); // stops at first error
});
