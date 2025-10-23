import { type Infer, type SchemaInterface, s } from '@esmj/schema/full';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
declare module 'express-serve-static-core' {
  interface Request {
    schema: {
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      headers?: Record<string, unknown>;
    };
  }
}

export type MiddlewareSchema = {
  body?: SchemaInterface<unknown, unknown>;
  query?: SchemaInterface<unknown, unknown>;
  params?: SchemaInterface<unknown, unknown>;
  headers?: SchemaInterface<unknown, unknown>;
};

export type ErrorHandler = (opts: {
  req: Request;
  res: Response;
  next: NextFunction;
  part: keyof MiddlewareSchema;
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
  schema: MiddlewareSchema,
  errorHandler: ErrorHandler = defaultErrorHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.schema) {
        req.schema = {};
      }

      for (const part of ['body', 'query', 'params', 'headers'] as const) {
        if (schema[part]) {
          try {
            const result = schema[part]?.safeParse(req[part]);
            if (!result?.success) {
              return errorHandler({
                req,
                res,
                next,
                part,
                error: result.error,
                result,
              });
            }

            (req as { schema: Record<string, unknown> }).schema[part] =
              result.data;
          } catch (err) {
            return errorHandler({
              req,
              res,
              next,
              part,
              error: err instanceof Error ? err : new Error('Unknown error'),
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

export { s, type SchemaInterface, type Infer };
