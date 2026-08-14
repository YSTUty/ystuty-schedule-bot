import { DataSource } from 'typeorm';

import { join } from 'node:path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import * as xEnv from './environment';

const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  ...xEnv.TYPEORM_CONFIG,
  synchronize: false,
  dropSchema: false,
  logging: true,
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  migrationsTableName: 'migrations',
  logger: 'advanced-console',
};

export default new DataSource(dataSourceOptions);
