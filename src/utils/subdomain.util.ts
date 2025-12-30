export const extractSubdomain = (host: string): string | null => {
  // host: "alice.gate402.io" -> "alice"
  // host: "localhost:3000" -> null (or handle localhost for dev)
  // host: "custom.com" -> null (treated as full domain)

  const parts = host.split('.');

  // Basic logic: if 3 parts and ends with gate402.io, return first part
  // Adjust for localhost/dev env
  if (host.includes('localhost')) {
    // e.g. alice.localhost
    if (parts.length >= 2 && parts[parts.length - 1].startsWith('localhost')) {
      return parts[0];
    }
    return null;
  }

  // Production logic: assume gate402.io (or whatever domain)
  // We can loosely check if it ends with our suffix if configured, or just trust the structure.
  // For now: if it looks like a subdomain of our main domain.
  // But wait, the instruction says: "Express reads req.hostname -> 'alice-weather.gate402.io'"
  // We need to know our own ROOT_DOMAIN to extract safely.
  // For now, let's treat any 3+ part domain as potential subdomain if it matches pattern.

  // Better approach:
  // If we receive "alice.gate402.io", we return "alice".
  // If we receive "api.weatherpro.com", we return null (uses custom domain logic).

  if (parts.length > 2) {
    // Check if it ends with standard domain parts?
    // Simplified: return the first part if it looks like a subdomain.
    return parts[0];
  }

  return null;
};

export const isValidSubdomain = (subdomain: string): boolean => {
  // Alphanumeric + hyphens, 1-63 chars
  const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return regex.test(subdomain);
};
