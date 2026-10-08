export function errorPayload(data, status) {
  if (status < 400 || !data || typeof data !== 'object') return data;
  const hints = {
    400: 'Check the request against /openapi.json and correct invalid fields.',
    401: 'Use the endpoint authentication flow. Sign in at /login; for /v1 protected APIs create a current key at /keys and send Authorization: Bearer <key>.',
    403: 'Use your own account and an authorized connection. Do not bypass access controls.',
    404: 'Check the endpoint path in /openapi.json.',
    405: 'Use the HTTP method listed in the Allow header or /openapi.json.',
    413: 'Reduce request size and attachment sizes before sending again.',
    429: 'Wait for Retry-After or quota reset. Do not automatically retry a generation POST.',
    500: 'The service encountered an error. Check health and contact support without sharing secrets.',
    502: 'The upstream service failed. Verify the outcome before repeating a generation request.',
    503: 'Check /v1/health and provider availability before trying again.'
  };
  return {...data, error: data.error || data.status || 'request_failed', resolution: {docs:'/developers',hint:hints[status] || 'Inspect the HTTP status and consult /developers.'}};
}
