import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown;
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      // Nest anida { statusCode, message, error } dentro de getResponse() cuando la
      // excepción se construye con un string o un array (ValidationPipe) — se
      // desenvuelve aquí para que el frontend reciba directamente el string/array.
      message = (typeof body === 'object' && body !== null && 'message' in body)
        ? (body as { message: unknown }).message
        : body;
    } else {
      message = 'Error interno del servidor';
    }

    if (status >= 500) {
      // PostgreSQL errors may contain row values or credentials in diagnostics.
      // Do not serialize unknown exceptions to either the client or request logs.
      this.logger.error(`${req.method} ${req.path}: error interno`);
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message,
    });
  }
}
