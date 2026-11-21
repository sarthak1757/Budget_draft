import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiError } from "@budget-draft/shared";

// Throw this from a route to send a specific status code and message.
// Express 5 passes errors from async handlers to the error handler automatically.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Not found"));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    const body: ApiError = { error: error.message };
    res.status(error.status).json(body);
    return;
  }
  // express.json() throws this for a malformed JSON body.
  if (error instanceof SyntaxError) {
    const body: ApiError = { error: "Request body is not valid JSON" };
    res.status(400).json(body);
    return;
  }
  // express.json() also throws for a body over the size limit (and a few other
  // client mistakes). Those carry a 4xx status and are safe to pass on.
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    const body: ApiError = { error: "Request is too big" };
    res.status(413).json(body);
    return;
  }
  // Anything else is a bug: log the details, but don't leak them to the client.
  console.error(error);
  const body: ApiError = { error: "Something went wrong on the server" };
  res.status(500).json(body);
};
