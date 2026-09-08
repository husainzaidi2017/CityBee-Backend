import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Request, Response } from 'express';

interface ListMeta {
  pagination?: { page: number; limit: number; total: number; hasNext: boolean };
  searchRadiusKm?: number;
}

/**
 * Wraps every successful response as
 * `{ success, data, message, pagination?, searchRadiusKm? }`.
 *
 * Services return `{ data, pagination?, searchRadiusKm? }` from list
 * endpoints; everything else passes through unchanged.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = _context.switchToHttp();
    ctx.getResponse<Response>().statusCode;

    return next.handle().pipe(
      map((payload) => {
        if (payload && typeof payload === 'object' && 'data' in (payload as ListMeta)) {
          const { data, pagination, searchRadiusKm, message } = payload as ListMeta & {
            data: unknown;
            message?: string;
          };
          return {
            success: true,
            data,
            message: message ?? 'Success',
            ...(pagination ? { pagination } : {}),
            ...(searchRadiusKm != null ? { searchRadiusKm } : {}),
          };
        }
        return { success: true, data: payload, message: 'Success' };
      }),
    );
  }
}
