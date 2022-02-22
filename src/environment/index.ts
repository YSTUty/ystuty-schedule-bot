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

export const INSTANCE_NAME: string = process.env.INSTANCE_NAME || 'ystuty-bot';

export const SERVER_PORT: number = +process.env.SERVER_PORT || 7574;

export const YSTUTY_PARSER_URL: string =
    process.env.YSTUTY_PARSER_URL || `http://app_srv:7576`;
