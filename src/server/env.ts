// LinkedIn OAuth is optional local config, never committed. If any of the
// three env vars are missing, linkedinConfig is null and the connect route
// responds 503 instead of the server failing to boot.
export type LinkedinConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function buildLinkedinConfig(): LinkedinConfig | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

export const linkedinConfig = buildLinkedinConfig();

export function linkedinConfigured(): boolean {
  return linkedinConfig !== null;
}
