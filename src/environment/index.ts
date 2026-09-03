import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const config = dotenv.config();
dotenvExpand.expand(config);

export enum EnvType {
  DEV = 'development',
  PROD = 'production',
  TEST = 'testing',
}

// environment
export const NODE_ENV: EnvType =
  (process.env.NODE_ENV as EnvType) || EnvType.DEV;

export const INSTANCE_NAME: string =
  process.env.INSTANCE_NAME || 'ystuty-schedule-bot';

export const SERVER_PORT: number = +process.env.SERVER_PORT! || 8080;

export const SCHEDULE_API_URL: string =
  process.env.SCHEDULE_API_URL ?? `http://ystuty_s_schedule`;
export const SCHEDULE_API_TOKEN: string | null =
  process.env.SCHEDULE_API_TOKEN ?? null;

export const YSTUTY_WEB_VIEW_ADDRESS: string =
  process.env.YSTUTY_WEB_VIEW_ADDRESS || '';

// * Postgres
const postgresDatabase = process.env.POSTGRES_DATABASE || 'ystuty-schedule-bot';
const postgresSynchronize = process.env.POSTGRES_SYNCHRONIZE
  ? process.env.POSTGRES_SYNCHRONIZE === 'true'
  : postgresDatabase.endsWith('dev');

if (postgresSynchronize && NODE_ENV === EnvType.PROD) {
  throw new Error(
    'POSTGRES_SYNCHRONIZE must not be enabled in production. Use migrations instead.',
  );
}

export const TYPEORM_CONFIG: Partial<PostgresConnectionOptions> = {
  logging: process.env.POSTGRES_LOGGING === 'true',
  synchronize: postgresSynchronize,
  uuidExtension: 'uuid-ossp',
  host: process.env.POSTGRES_HOST || 'postgres',
  port: +process.env.POSTGRES_PORT! || 5432,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: postgresDatabase,
};

// * Redis
export const REDIS_HOST: string = process.env.REDIS_HOST || 'redis';
export const REDIS_PORT: number = +process.env.REDIS_PORT! || 6379;
export const REDIS_USER: string | undefined = process.env.REDIS_USER;
export const REDIS_PASSWORD: string | undefined = process.env.REDIS_PASSWORD;
export const REDIS_DATABASE: number = +process.env.REDIS_DATABASE! || 0;
export const REDIS_PREFIX: string =
  process.env.REDIS_PREFIX ?? 'ystuty.schedule.bot:';

export const BROADCAST_HISTORY_LIMIT: string | undefined =
  process.env.BROADCAST_HISTORY_LIMIT;
export const TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND: number | undefined =
  process.env.TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND
    ? Number(process.env.TELEGRAM_BROADCAST_MAX_DELIVERIES_PER_SECOND)
    : undefined;
export const TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS: number | undefined =
  process.env.TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS
    ? Number(process.env.TELEGRAM_BROADCAST_RATE_LIMIT_BUFFER_SECONDS)
    : undefined;
export const TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS: number | undefined = process
  .env.TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS
  ? Number(process.env.TELEGRAM_BROADCAST_MAX_RETRY_ATTEMPTS)
  : undefined;

// * Socials

// VKontakte
export const SOCIAL_VK_GROUP_ID: number | null =
  +process.env.SOCIAL_VK_GROUP_ID! || null;
export const SOCIAL_VK_GROUP_TOKEN: string =
  process.env.SOCIAL_VK_GROUP_TOKEN || '';
export const SOCIAL_VK_ADMIN_IDS: number[] =
  (process.env.SOCIAL_VK_ADMIN_IDS &&
    JSON.parse(process.env.SOCIAL_VK_ADMIN_IDS)) ||
  [];

// Telegram
export const SOCIAL_TELEGRAM_BOT_NAME =
  process.env.SOCIAL_TELEGRAM_BOT_NAME || '';
export const SOCIAL_TELEGRAM_BOT_TOKEN =
  process.env.SOCIAL_TELEGRAM_BOT_TOKEN || '';
export const SOCIAL_TELEGRAM_ADMIN_IDS: number[] =
  (process.env.SOCIAL_TELEGRAM_ADMIN_IDS &&
    JSON.parse(process.env.SOCIAL_TELEGRAM_ADMIN_IDS)) ||
  [];
export const SOCIAL_TELEGRAM_API_ROOT = process.env.SOCIAL_TELEGRAM_API_ROOT;

// Prometheus
export const PROMETHEUS_ENABLED: boolean = process.env.PROMETHEUS_ENABLED
  ? process.env.PROMETHEUS_ENABLED === 'true'
  : true;
export const PROMETHEUS_PUSHGATEWAY_URL: string =
  process.env.PROMETHEUS_PUSHGATEWAY_URL || '';
/** Включает series с конкретными группами и преподавателями. */
export const PROMETHEUS_DETAILED_SCHEDULE_TARGET_METRICS: boolean =
  process.env.PROMETHEUS_DETAILED_SCHEDULE_TARGET_METRICS === 'true';
/** Включает фоновый обход групп для метрик наполненности расписания. */
export const PROMETHEUS_SCHEDULE_AVAILABILITY_METRICS: boolean =
  process.env.PROMETHEUS_SCHEDULE_AVAILABILITY_METRICS === 'true';

// * oAuth
export const OAUTH_URL = process.env.OAUTH_URL || 'http://ystuty_oauth';
export const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'ystuty-invite';
export const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || '';
// export const OAUTH_REDIRECT_URI =
//   process.env.OAUTH_REDIRECT_URI || `${SERVER_URL}/callback/oauth`;

//
export const SOCAIL_CONNECT_URI = process.env.SOCAIL_CONNECT_URI || '';
