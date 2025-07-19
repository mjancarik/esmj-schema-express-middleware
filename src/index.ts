import { type Infer, type SchemaInterface, s } from '@esmj/schema';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type EsmjSchemaMiddlewareSchemas = {
  body?: SchemaInterface<unknown, unknown>;
  query?: SchemaInterface<unknown, unknown>;
  params?: SchemaInterface<unknown, unknown>;
  headers?: SchemaInterface<unknown, unknown>;
};

export type ErrorHandler = (opts: {
  req: Request;
  res: Response;
  next: NextFunction;
  part: keyof EsmjSchemaMiddlewareSchemas;
  error:
    | {
        message: string;
        cause?: unknown;
      }
    | Error;
  result?: {
    success: false;
    error: { message: string; cause?: unknown };
  };
}) => unknown;

export type EsmjSchemaMiddlewareResult<S extends EsmjSchemaMiddlewareSchemas> =
  {
    body: S['body'] extends SchemaInterface<infer I, infer O> ? O : unknown;
    query: S['query'] extends SchemaInterface<infer I, infer O> ? O : unknown;
    params: S['params'] extends SchemaInterface<infer I, infer O> ? O : unknown;
    headers: S['headers'] extends SchemaInterface<infer I, infer O>
      ? O
      : unknown;
  };

function defaultErrorHandler({
  res,
  error,
  result,
}: Parameters<ErrorHandler>[0]): Response {
  if (result?.error) {
    return res
      .status(400)
      .json({ error: result.error.message, cause: result.error.cause });
  }
  return res
    .status(400)
    .json({ error: error instanceof Error ? error.message : String(error) });
}

export function validate(
  schemas: EsmjSchemaMiddlewareSchemas,
  errorHandler: ErrorHandler = defaultErrorHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const part of ['body', 'query', 'params', 'headers'] as const) {
        if (schemas[part]) {
          try {
            const result = schemas[part]?.safeParse(req[part]);
            if (!result.success) {
              return errorHandler({
                req,
                res,
                next,
                part,
                error: result.error,
                result,
              });
            }
            req[part] = result.data;
          } catch (err) {
            return errorHandler({
              req,
              res,
              next,
              part,
              error: (err as Error) || new Error('Unknown error'),
            });
          }
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateBody(
  schema: SchemaInterface<unknown, unknown>,
  errorHandler?: ErrorHandler,
): RequestHandler {
  return validate({ body: schema }, errorHandler);
}

export function validateQuery(
  schema: SchemaInterface<unknown, unknown>,
  errorHandler?: ErrorHandler,
): RequestHandler {
  return validate({ query: schema }, errorHandler);
}

export function validateParams(
  schema: SchemaInterface<unknown, unknown>,
  errorHandler?: ErrorHandler,
): RequestHandler {
  return validate({ params: schema }, errorHandler);
}

export function validateHeaders(
  schema: SchemaInterface<unknown, unknown>,
  errorHandler?: ErrorHandler,
): RequestHandler {
  return validate({ headers: schema }, errorHandler);
}

export { s, type SchemaInterface, type Infer } from '@esmj/schema';
