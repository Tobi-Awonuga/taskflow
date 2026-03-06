/**
 * Global test setup — loads .env.test if present, otherwise falls back to .env.
 * Point MYSQL_DATABASE at a separate test DB so tests never touch dev data.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const testEnv = resolve(process.cwd(), '.env.test');
config({ path: existsSync(testEnv) ? testEnv : resolve(process.cwd(), '.env') });

// Override the DB name so tests run against nectar_test, not nectar
process.env.MYSQL_DATABASE = process.env.TEST_DATABASE ?? 'nectar_test';
// Clear DATABASE_URL so the individual MYSQL_* fields take effect
delete process.env.DATABASE_URL;
