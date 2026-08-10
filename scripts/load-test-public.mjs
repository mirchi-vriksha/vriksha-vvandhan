const baseArgument = process.argv.find((argument) => argument.startsWith("--base-url="));
const baseUrl = new URL(baseArgument?.slice("--base-url=".length) ?? "http://127.0.0.1:3010");
if (!["127.0.0.1", "localhost"].includes(baseUrl.hostname) && !process.argv.includes("--allow-staging")) {
  throw new Error("Refusing to load-test a non-local target without --allow-staging.");
}
if (/prod/i.test(baseUrl.hostname) || baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
  throw new Error("Refusing a production-like or invalid load-test target.");
}

async function runScenario(name, path, concurrency) {
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: concurrency }, async () => {
    const requestStarted = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "Vriksha-Vvandhan-Section-6-Bounded-Load-Test" },
      });
      await response.arrayBuffer();
      return { status: response.status, milliseconds: performance.now() - requestStarted };
    } catch {
      return { status: 0, milliseconds: performance.now() - requestStarted };
    }
  }));

  const latencies = results.map((result) => result.milliseconds).sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * value) - 1)];
  const failures = results.filter((result) => result.status < 200 || result.status >= 400);
  return {
    name,
    requests: results.length,
    failures: failures.length,
    statuses: Object.fromEntries([...new Set(results.map((result) => result.status))].map((status) => [
      String(status),
      results.filter((result) => result.status === status).length,
    ])),
    p50Ms: Math.round(percentile(0.5)),
    p95Ms: Math.round(percentile(0.95)),
    totalMs: Math.round(performance.now() - started),
  };
}

const report = {
  target: baseUrl.origin,
  safety: "bounded-read-only",
  scenarios: await Promise.all([
    runScenario("homepage", "/", 100),
    runScenario("movement-wall", "/movement", 100),
  ]),
};

console.log(JSON.stringify(report, null, 2));
if (report.scenarios.some((scenario) => scenario.failures > 0)) process.exitCode = 1;
