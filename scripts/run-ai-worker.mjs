const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

process.env.WORKER_SHARED_SECRET ||= "dev-worker-secret";

const processUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/internal/import-jobs/process`;

async function processQueueLoop() {
  while (true) {
    try {
      const res = await fetch(processUrl, {
        method: "POST",
        headers: {
          "x-worker-secret": process.env.WORKER_SHARED_SECRET,
        },
      });

      if (!res.ok) {
        await sleep(3000);
        continue;
      }

      const payload = await res.json();
      await sleep(payload.processed ? 300 : 2000);
    } catch {
      await sleep(3000);
    }
  }
}

await processQueueLoop();
