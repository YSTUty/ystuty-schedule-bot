import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import * as xEnv from '@my-environment';
import { HttpExceptionFilter } from '@my-common';

import { AppModule } from './models/app/app.module';

async function bootstrap() {
  Logger.log(
    `🥙 Application (${process.env.npm_package_name}@v${process.env.npm_package_version})`,
    'NestJS',
  );

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  await app.listen(xEnv.SERVER_PORT);

  if (xEnv.NODE_ENV !== xEnv.EnvType.PROD) {
    Logger.log(
      `🤬 Application is running on: ${await app.getUrl()}`,
      'Bootstrap',
    );
  } else {
    Logger.log(
      `🚀 Server is listening on port ${xEnv.SERVER_PORT}`,
      'Bootstrap',
    );
  }
}

const logger = new Logger('GlobalErrorHandler');
process.on('uncaughtException', (error: Error, origin: string) => {
  logger.error(`Uncaught Exception: ${error.message}`, error.stack);
});
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error(
    `Unhandled Rejection at: ${promise}, reason: ${reason?.message || reason}`,
    reason?.stack,
  );
});

bootstrap().catch((e) => {
  Logger.warn(`❌  Error starting server, ${e}`, 'Bootstrap');
  throw e;
});
