import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  private writeLog(
    code: number,
    req: Request,
    start: number,
    missingHeaders: string[],
    values: Record<string, string | null>,
    errorMessage?: string,
  ): void {
    let logInfo = `${req.method} ${req.url} ${code} - ${Date.now() - start}ms - ${JSON.stringify(values)}`;

    if (missingHeaders.length > 0)
      logInfo += ` - missing: ${missingHeaders.join(', ')}`;

    if (code >= 500)
      this.logger.error(
        (logInfo += ` - error: ${errorMessage ?? 'Unknown error'}`),
      );
    else if (code >= 400)
      this.logger.warn(
        (logInfo += ` - error: ${errorMessage ?? 'Unknown error'}`),
      );
    else {
      if (missingHeaders.length > 0) this.logger.warn(logInfo);
      else this.logger.log(logInfo);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const listHeader = ['x-platform', 'x-device', 'x-app-version'];

    const missingHeaders: string[] = [];
    const values: Record<string, string | null> = {};

    for (const header of listHeader) {
      const value = request.headers[header];

      if (!value) missingHeaders.push(header);

      values[header] = Array.isArray(value) ? value.join(', ') : value || null;
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeLog(
            response.statusCode,
            request,
            start,
            missingHeaders,
            values,
          );
        },
        error: (err: unknown) => {
          const code = err instanceof HttpException ? err.getStatus() : 500;
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          this.writeLog(
            code,
            request,
            start,
            missingHeaders,
            values,
            errorMessage,
          );
        },
      }),
    );
  }
}
