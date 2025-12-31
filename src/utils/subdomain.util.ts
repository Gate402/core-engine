import { nanoid } from 'nanoid';

/**
 * Generate a unique subdomain from an origin URL
 * Format: {sanitized-hostname}-{random-6}
 * Example: "api-example-a3f9k2"
 */
export function generateSubdomain(originUrl: string): string {
  try {
    const url = new URL(originUrl);
    const hostname = url.hostname.split('.')[0];

    // Sanitize: lowercase, alphanumeric + hyphens only, max 20 chars
    const sanitized = hostname
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 20);

    // Add random suffix for uniqueness
    const suffix = nanoid(6).toLowerCase();

    return `${sanitized}-${suffix}`;
  } catch {
    // Fallback if URL parsing fails
    return `api-${nanoid(8).toLowerCase()}`;
  }
}

/**
 * Validate subdomain format
 * Rules: lowercase alphanumeric + hyphens, 1-63 chars, no leading/trailing hyphens
 */
export function isValidSubdomain(subdomain: string): boolean {
  const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return regex.test(subdomain);
}

/**
 * Extract subdomain from hostname
 * Examples:
 *   "api.gate402.io" -> "api"
 *   "api.localhost" -> "api"
 *   "localhost" -> null
 */
export function extractSubdomain(host: string): string | null {
  const parts = host.split('.');

  // Handle localhost development
  if (host.includes('localhost')) {
    if (parts.length >= 2 && parts[parts.length - 1].startsWith('localhost')) {
      return parts[0];
    }
    return null;
  }

  // Production: extract first part if 3+ parts
  if (parts.length > 2) {
    return parts[0];
  }

  return null;
}
