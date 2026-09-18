export function webhookConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.SITE_WEBHOOK_URL?.trim();
  const secret = environment.WEBHOOK_SECRET;
  if (!url || !secret?.trim()) throw new Error('SITE_WEBHOOK_URL and WEBHOOK_SECRET are required');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid SITE_WEBHOOK_URL configuration'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    throw new Error('Invalid SITE_WEBHOOK_URL configuration');
  }
  if (environment.NODE_ENV === 'production') {
    if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(parsed.hostname)
      || parsed.pathname !== '/api/webhooks/crm/order-status' || parsed.search) {
      throw new Error('Production SITE_WEBHOOK_URL must be the public HTTPS CRM order-status endpoint');
    }
    if (secret.startsWith('replace-with-')) throw new Error('Production WEBHOOK_SECRET must be configured');
  }
  return { url, secret };
}
