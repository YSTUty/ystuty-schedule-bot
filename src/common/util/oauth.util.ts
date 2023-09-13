import { OAuth2 } from 'oauth';
import * as xEnv from '@my-environment';

export const oAuth = new OAuth2(
  xEnv.OAUTH_CLIENT_ID,
  xEnv.OAUTH_CLIENT_SECRET,
  xEnv.OAUTH_URL,
);
