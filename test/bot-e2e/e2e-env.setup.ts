import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.e2e');

if (!existsSync(envPath)) {
  throw new Error(
    'Bot E2E requires a local .env.e2e file. Copy .env.e2e.example first.',
  );
}

dotenvExpand.expand(dotenv.config({ path: envPath }));
