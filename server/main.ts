import { existsSync } from 'node:fs';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile();
const app = await createApp();
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
console.log(`Roombook listening on ${await app.getUrl()}`);
