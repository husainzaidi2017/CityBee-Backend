import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * Normalizes every error to `{ success: false, message, statusCode }`.
 * Internal errors are logged with stack but surfaced as a generic message —
 * no SQL/driver details leak to clients.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray((body as { message?: string[] }).message)
            ? ((body as { message: string[] }).message as string[]).join(', ')
            : ((body as { message?: string }).message ?? exception.message);
      response.status(exception.getStatus()).json({
        success: false,
        message,
        statusCode: exception.getStatus(),
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong on our side. Please try again.',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
