import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    const request = context.switchToHttp().getRequest<Request>();
    const listHeader = ['x-platform', 'x-device', 'x-app-version'];

    const missingHeaders: string[] = [];
    const values: Record<string, string | null> = {};

    for (const header of listHeader) {
      const value = request.headers[header];

      if (!value) missingHeaders.push(header);

      values[header] = Array.isArray(value) ? value.join(', ') : value || null;
    }

    return next.handle().pipe(
      tap(() => {
        if (missingHeaders.length > 0) {
          this.logger.warn(
            `${request.method} ${request.url} - ${Date.now() - start}ms - ${JSON.stringify(values)} - missing: ${missingHeaders.join(', ')}`,
          );
        } else {
          this.logger.log(
            `${request.method} ${request.url} - ${Date.now() - start}ms - ${JSON.stringify(values)}`,
          );
        }
      }),
    );
  }
}
