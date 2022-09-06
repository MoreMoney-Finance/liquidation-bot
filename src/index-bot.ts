import { run } from './index';

async function sleep(ms: number) {
  return new Promise((resolve, reject) => setTimeout(() => resolve(true), ms));
}

async function start() {

  while (true) {
    await run();
    await sleep(30000);
  }
}

start();
