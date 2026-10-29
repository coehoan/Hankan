process.env.HANKAN_WORKER_MAIN = '1';
await import('../src/jobs/worker');
