import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';

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

export const SERVER_PORT: number = +process.env.SERVER_PORT || 8080;

/** @deprecated Use `SCHEDULE_API_URL` */
export const YSTUTY_PARSER_URL: string =
  process.env.YSTUTY_PARSER_URL ?? `http://ystuty_parser:8080`;
export const SCHEDULE_API_URL: string =
  process.env.SCHEDULE_API_URL ?? `http://ystuty_s_schedule`;
export const SCHEDULE_API_TOKEN: string =
  process.env.SCHEDULE_API_TOKEN ?? null;

export const YSTUTY_WEB_VIEW_ADDRESS: string =
  process.env.YSTUTY_WEB_VIEW_ADDRESS || '';

// * Postgres
export const TYPEORM_CONFIG = {
  logging: process.env.POSTGRES_LOGGING === 'true',
  synchronize: false,
  host: process.env.POSTGRES_HOST || 'postgres',
  port: +process.env.POSTGRES_PORT || 5432,
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE || 'ystuty-schedule-bot',
};
TYPEORM_CONFIG.synchronize = process.env.POSTGRES_SYNCHRONIZE
  ? process.env.POSTGRES_SYNCHRONIZE === 'true'
  : TYPEORM_CONFIG.database.endsWith('dev');

// * Redis
export const REDIS_HOST: string = process.env.REDIS_HOST || 'redis';
export const REDIS_PORT: number = +process.env.REDIS_PORT || 6379;
export const REDIS_USER: string = process.env.REDIS_USER;
export const REDIS_PASSWORD: string = process.env.REDIS_PASSWORD;
export const REDIS_DATABASE: number = +process.env.REDIS_DATABASE || 0;
export const REDIS_PREFIX: string =
  process.env.REDIS_PREFIX ?? 'ystuty.schedule.bot:';

// * Socials

// VKontakte
export const SOCIAL_VK_GROUP_ID: number =
  +process.env.SOCIAL_VK_GROUP_ID || null;
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

// Prometheus
export const PROMETHEUS_ENABLED: boolean = process.env.PROMETHEUS_ENABLED
  ? process.env.PROMETHEUS_ENABLED === 'true'
  : true;
export const PROMETHEUS_PUSHGATEWAY_URL: string =
  process.env.PROMETHEUS_PUSHGATEWAY_URL || '';

// * oAuth
export const OAUTH_URL = process.env.OAUTH_URL || 'http://ystuty_oauth';
export const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'ystuty-invite';
export const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || '';
// export const OAUTH_REDIRECT_URI =
//   process.env.OAUTH_REDIRECT_URI || `${SERVER_URL}/callback/oauth`;

//
export const SOCAIL_CONNECT_URI = process.env.SOCAIL_CONNECT_URI || '';
