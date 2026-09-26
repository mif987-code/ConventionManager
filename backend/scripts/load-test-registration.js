const baseUrl = process.env.LOAD_TEST_URL || 'http://localhost:3000';
const concurrency = Math.max(1, Math.min(100, Number(process.env.LOAD_TEST_CONCURRENCY || 40)));
const packageId = process.env.LOAD_TEST_PACKAGE_ID ? Number(process.env.LOAD_TEST_PACKAGE_ID) : null;
const target = new URL(baseUrl);

if (!['localhost', '127.0.0.1'].includes(target.hostname) && process.env.LOAD_TEST_CONFIRM !== 'staging') {
  throw new Error('Refusing to load test a non-local URL. Set LOAD_TEST_CONFIRM=staging only for an isolated staging environment.');
}

const runId = Date.now();
const startedAt = Date.now();

async function register(index) {
  const response = await fetch(`${baseUrl}/public/preregister/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participants: [{
        name: 'Prueba',
        last_name: `Carga${index}`,
        email: `load-${runId}-${index}@example.test`,
        password: `LoadTest-${runId}-${index}`,
        dob: '2000-01-01',
        age: 26,
        attendance_dates: [],
        packages: packageId ? [{ package_id: packageId, quantity: 1 }] : [],
        event_prereg_ids: [],
      }],
      recaptcha_token: process.env.LOAD_TEST_RECAPTCHA_TOKEN || '',
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body.error || JSON.stringify(body)}`);
  if (packageId && body.registrations[0].package_total_cost > 0) {
    const paymentResponse = await fetch(`${baseUrl}/public/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: body.registrations[0].user.id }),
    });
    if (!paymentResponse.ok) throw new Error(`Payment ${paymentResponse.status}: ${await paymentResponse.text()}`);
  }
  return Date.now() - startedAt;
}

Promise.allSettled(Array.from({ length: concurrency }, (_, index) => register(index + 1))).then(results => {
  const failures = results.filter(result => result.status === 'rejected');
  const durations = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  console.log(JSON.stringify({
    target: baseUrl,
    concurrency,
    succeeded: durations.length,
    failed: failures.length,
    totalMs: Date.now() - startedAt,
    slowestMs: durations.length ? Math.max(...durations) : null,
    errors: failures.slice(0, 10).map(result => result.reason.message),
  }, null, 2));
  if (failures.length) process.exitCode = 1;
});
