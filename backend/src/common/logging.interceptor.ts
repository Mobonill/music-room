import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `Interceptor completed for ${request.method} ${request.url} - ${Date.now() - start}ms`,
        );
      }),
    );
  }
}
