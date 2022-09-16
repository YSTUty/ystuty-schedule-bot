import { DynamicModule, Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { InboundMiddleware, PromModule, PromModuleOptions } from '@khaledez/nestjs-prom';
import { DEFAULT_PROM_OPTIONS } from '@khaledez/nestjs-prom/dist/prom.constants';

import * as xEnv from '@my-environment';
import { MetricsService } from './metrics.service';

const METRIC_PATH = '/api/metrics';

@Global()
@Module({})
export class MetricsModule implements NestModule {
    static forRoot() {
        const moduleForRoot: DynamicModule = {
            module: MetricsModule,
            imports: [],
            providers: [MetricsService],
            exports: [MetricsService],
        };

        if (xEnv.PROMETHEUS_ENABLED) {
            const promOptions: PromModuleOptions = {
                metricPath: METRIC_PATH,
                withDefaultsMetrics: true,
                withDefaultController: true,
                defaultLabels: {
                    app: xEnv.INSTANCE_NAME,
                    // version: '0.1.0',
                },
                // prefix: 'ystuty_',
            };

            moduleForRoot.imports.push(PromModule.forRoot(promOptions));

            moduleForRoot.providers.push({
                provide: DEFAULT_PROM_OPTIONS,
                useValue: promOptions,
            });
        }

        return moduleForRoot;
    }

    configure(consumer: MiddlewareConsumer) {
        if (xEnv.PROMETHEUS_ENABLED === true) {
            // We register the Middleware ourselves to avoid tracking
            // latency for static files served for the frontend.
            consumer.apply(InboundMiddleware).exclude(METRIC_PATH).forRoutes('/api');

            // if (this.config.get<boolean>('PROMETHEUS_BASIC_AUTH')) {
            //     consumer.apply(MetricsAuthMiddleware).forRoutes(METRIC_PATH);
            // }
        }
    }
}
