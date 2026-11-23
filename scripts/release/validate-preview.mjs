const previewOrigin = 'https://preview.trustfive.co.uk';

export async function validatePreview({origin, fetchImpl = fetch, clientId, clientSecret, expectedSha}) {
  if (![previewOrigin, previewOrigin + '/'].includes(origin)) throw new Error('Unexpected preview origin');
  if (!clientId || !clientSecret || !/^[a-f0-9]{40}$/.test(expectedSha ?? '')) {
    throw new Error('Missing credentials or invalid expected commit');
  }

  const health = new URL('/api/health', previewOrigin);
  async function probe(headers) {
    try {
      return await fetchImpl(health, {headers, redirect: 'manual', signal: AbortSignal.timeout(5000)});
    } catch {
      throw new Error('Preview health request failed');
    }
  }

  const anonymous = await probe();
  if (anonymous.status !== 403) {
    const redirect = URL.parse(anonymous.headers.get('location') ?? '');
    if (anonymous.status < 300 || anonymous.status >= 400 ||
        redirect?.protocol !== 'https:' || !redirect.hostname.endsWith('.cloudflareaccess.com')) {
      throw new Error('Preview did not deny anonymous access');
    }
  }

  const authorized = await probe({'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret});
  if (authorized.status !== 200) throw new Error('Authorized preview access failed');
  const report = await authorized.json().catch(() => null);
  if (report?.service !== 'trustfive-web' || report.status !== 'ok' || report.commitSha !== expectedSha) {
    throw new Error('Preview health or release commit could not be verified');
  }
}
