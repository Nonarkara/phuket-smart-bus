import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const requestContextMiddleware: RequestHandler = (request, response, next) => {
  const requestId =
    request.header("x-request-id")?.trim() ||
    request.header("x-correlation-id")?.trim() ||
    randomUUID();
  const startedAt = Date.now();

  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  response.on("finish", () => {
    const level =
      response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";

    console.log(
      JSON.stringify({
        level,
        event: "http_request",
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ip: request.ip
      })
    );
  });

  next();
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = String(response.locals.requestId ?? "unknown");
  const isBodyTooLarge =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large";
  const isZodPayloadTooLarge =
    error instanceof ZodError &&
    error.issues.some((issue) => issue.code === "too_big");
  const fallbackStatusCode =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? Number((error as { status: number }).status)
      : 500;
  const statusCode = error instanceof HttpError ? error.statusCode : isBodyTooLarge ? 413 : fallbackStatusCode;
  const statusCodeWithValidation =
    error instanceof ZodError ? (isZodPayloadTooLarge ? 413 : 400) : statusCode;
  const code =
    error instanceof HttpError
      ? error.code
      : error instanceof ZodError
        ? isZodPayloadTooLarge
          ? "payload_too_large"
          : "validation_error"
        : isBodyTooLarge
          ? "payload_too_large"
          : "internal_error";
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof ZodError
        ? isZodPayloadTooLarge
          ? "Request body exceeds the configured batch limit"
          : error.issues[0]?.message ?? "Request validation failed"
        : isBodyTooLarge
        ? "Request body exceeds the configured limit"
        : "Unexpected server error";

  console.error(
    JSON.stringify({
      level: "error",
      event: "http_error",
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: statusCodeWithValidation,
      code,
      message: error instanceof Error ? error.message : String(error)
    })
  );

  if (response.headersSent) {
    return;
  }

  response.status(statusCodeWithValidation).json({
    error: message,
    code,
    issues: error instanceof ZodError ? error.issues : undefined,
    requestId
  });
};
