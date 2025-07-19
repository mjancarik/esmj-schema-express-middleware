# @esmj/schema-express-middleware

Express middleware for validating request body, query, params, and headers using [`@esmj/schema`](https://github.com/mjancarik/esmj-schema). Inspired by popular validation middlewares like zod-express-middleware and express-joi-validation, but using @esmj/schema for fast, type-safe validation.

## Installation

```sh
npm install @esmj/schema-express-middleware
```

## Usage

### Basic Example

```typescript
import express from 'express';
import { s, validateBody } from '@esmj/schema-express-middleware';

const app = express();
app.use(express.json());

const userSchema = s.object({
  name: s.string().min(1),
  age: s.number().int().min(0),
});

app.post('/users', validateBody(userSchema), (req, res) => {
  // req.body is now validated and typed
  res.json({ user: req.body });
});

app.listen(3000);
```

## API

### validate(schemas, errorHandler?)

**Arguments:**
- `schemas`: `{ body?, query?, params?, headers? }` — An object where each property is an optional [`@esmj/schema` SchemaInterface](https://github.com/mjancarik/esmj-schema). Each provided schema will be used to validate the corresponding part of the request (`req.body`, `req.query`, `req.params`, `req.headers`).
- `errorHandler` (optional): `(opts) => unknown` — A function called on validation error. Receives an object with `{ req, res, next, part, error, result }`.
  - `part`: One of `'body' | 'query' | 'params' | 'headers'` indicating which part failed.
  - `error`: The validation error (with `message` and optional `cause`).
  - `result`: The failed parse result (with `success: false`).

**Returns:** Express `RequestHandler` middleware.

```typescript
import { validate, s } from '@esmj/schema-express-middleware';

app.post(
  '/login',
  validate({
    body: s.object({ username: s.string(), password: s.string() }),
    query: s.object({ next: s.string().optional() }),
  }),
  (req, res) => {
    // req.body and req.query are validated and typed
    res.send('ok');
  }
);
```

#### Custom Error Handler

You can provide a custom error handler to control the response:

```typescript
import { validate } from '@esmj/schema-express-middleware';

function myErrorHandler({ res, error, part }) {
  res.status(422).json({ part, message: error.message });
}

app.post('/users', validate({ body: userSchema }, myErrorHandler), handler);
```

### validateBody(schema, errorHandler?)

**Arguments:**
- `schema`: [`@esmj/schema` SchemaInterface] — The schema to validate `req.body`.
- `errorHandler` (optional): Same as above.

**Returns:** Express `RequestHandler` middleware.

```typescript
app.post('/users', validateBody(userSchema), handler);
```

### validateQuery(schema, errorHandler?)

**Arguments:**
- `schema`: [`@esmj/schema` SchemaInterface] — The schema to validate `req.query`.
- `errorHandler` (optional): Same as above.

**Returns:** Express `RequestHandler` middleware.

```typescript
app.get('/search', validateQuery(s.object({ q: s.string() })), handler);
```

### validateParams(schema, errorHandler?)

**Arguments:**
- `schema`: [`@esmj/schema` SchemaInterface] — The schema to validate `req.params`.
- `errorHandler` (optional): Same as above.

**Returns:** Express `RequestHandler` middleware.

```typescript
app.get('/users/:id', validateParams(s.object({ id: s.string() })), handler);
```

### validateHeaders(schema, errorHandler?)

**Arguments:**
- `schema`: [`@esmj/schema` SchemaInterface] — The schema to validate `req.headers`.
- `errorHandler` (optional): Same as above.

**Returns:** Express `RequestHandler` middleware.

```typescript
app.get('/secure', validateHeaders(s.object({ authorization: s.string() })), handler);
```

## Types

- All helpers are fully typed. After validation, `req.body`, `req.query`, `req.params`, and `req.headers` are typed according to your schema.
- All schemas must be @esmj/schema.

## License

MIT
