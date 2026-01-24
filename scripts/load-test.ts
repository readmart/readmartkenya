// Using native fetch (Node.js 18+)
const targetUrl = process.argv[2] || 'http://localhost:3000/api/health';
const CONCURRENCY = parseInt(process.argv[3]) || 10;
const DURATION_MS = parseInt(process.argv[4]) || 5000;

async function runTest() {
  console.log(`Starting load test on ${targetUrl}`);
  console.log(`Concurrency: ${CONCURRENCY}, Duration: ${DURATION_MS}ms`);

  let successCount = 0;
  let errorCount = 0;
  let totalLatency = 0;
  const startTime = Date.now();

  const tasks = Array(CONCURRENCY).fill(null).map(async () => {
    while (Date.now() - startTime < DURATION_MS) {
      const requestStart = Date.now();
      try {
        const res = await fetch(targetUrl);
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (e) {
        errorCount++;
      }
      totalLatency += (Date.now() - requestStart);
    }
  });

  await Promise.all(tasks);

  const totalTime = Date.now() - startTime;
  const totalRequests = successCount + errorCount;
  
  console.log('\n--- Test Results ---');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Success Rate: ${((successCount / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Average Latency: ${(totalLatency / totalRequests).toFixed(2)}ms`);
  console.log(`Requests Per Second: ${(totalRequests / (totalTime / 1000)).toFixed(2)}`);
}

runTest().catch(console.error);
