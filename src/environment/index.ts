import { resolve } from 'path';
import { config } from 'dotenv';

const repoBranch = '';

config({
    path: resolve(process.cwd(), `.env${repoBranch ? `.${repoBranch}` : ''}`),
});

export enum EnvType {
    DEV = 'development',
    PROD = 'production',
    TEST = 'testing',
}

// environment
export const NODE_ENV: EnvType =
    (process.env.NODE_ENV as EnvType) || EnvType.DEV;

export const INSTANCE_NAME: string = process.env.INSTANCE_NAME || 'ystuty-schedule-bot';

export const SERVER_PORT: number = +process.env.SERVER_PORT || 8080;

export const YSTUTY_PARSER_URL: string =
    process.env.YSTUTY_PARSER_URL || `http://ystuty_parser:8080`;

// * Redis
export const REDIS_HOST: string = process.env.REDIS_HOST || 'redis';
export const REDIS_PORT: number = +process.env.REDIS_PORT || 6379;
export const REDIS_USER: string = process.env.REDIS_USER;
export const REDIS_PASSWORD: string = process.env.REDIS_PASSWORD;
export const REDIS_DATABASE: number = +process.env.REDIS_DATABASE || 0;

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
