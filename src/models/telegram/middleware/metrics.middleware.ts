import { Injectable } from '@nestjs/common';
import { MiddlewareObj } from 'telegraf/typings/middleware';
import { IContext } from '@my-interfaces/telegram';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class MetricsMiddleware implements MiddlewareObj<IContext> {
    constructor(private readonly metricsService: MetricsService) {}

    middleware() {
        return async (
            ctx: IContext,
            next: (...args: any[]) => Promise<any>,
        ) => {
            const { updateType } = ctx;
            const duration =
                this.metricsService.telegramRequestDurationHistogram.startTimer(
                    { updateType },
                );

            try {
                await next?.();
                this.metricsService.telegramRequestCounter.inc({
                    updateType,
                    status: 'success',
                });
                duration({ status: 'success' });
            } catch (err) {
                this.metricsService.telegramRequestCounter.inc({
                    updateType,
                    status: 'error',
                });
                duration({ status: 'error' });
                throw err;
            } finally {
                // duration();
            }
        };
    }
}
