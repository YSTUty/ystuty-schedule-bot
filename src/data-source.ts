import { DataSource } from 'typeorm';

import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import * as xEnv from './environment';

const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  ...xEnv.TYPEORM_CONFIG,
  synchronize: false,
  dropSchema: false,
  logging: true,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  logger: 'advanced-console',
};

export default new DataSource(dataSourceOptions);
