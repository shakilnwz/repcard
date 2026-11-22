import type { CFPagesFunction } from '../../env';

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface RepoResponse {
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

interface UserResponse {
  login?: string;
  avatar_url?: string;
}

function parseCookie(header: string | null, key: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === key) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function clearStateCookie(isHttps: boolean): string {
  const secureAttr = isHttps ? '; Secure' : '';
  return `kb_oauth_state=; HttpOnly${secureAttr}; SameSite=Lax; Path=/api/auth; Max-Age=0`;
}

function redirectError(origin: string, code: string, isHttps: boolean): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?auth_error=${encodeURIComponent(code)}`,
      'Cache-Control': 'no-store',
      'Set-Cookie': clearStateCookie(isHttps),
    },
  });
}

export const onRequestGet: CFPagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = parseCookie(request.headers.get('Cookie'), 'kb_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectError(url.origin, 'invalid_oauth_state', isHttps);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return redirectError(url.origin, 'oauth_not_configured', isHttps);
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'genforge-kb-app',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return redirectError(url.origin, 'token_exchange_failed', isHttps);
  }

  const tokenData = (await tokenRes.json()) as TokenResponse;
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return redirectError(url.origin, 'token_missing', isHttps);
  }

  const allowedRepo = (env.ALLOWED_REPO || 'shakilnwz/genforge-lab-knowledgebase').trim();
  const repoRes = await fetch(`https://api.github.com/repos/${allowedRepo}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'genforge-kb-app',
    },
  });

  if (!repoRes.ok) {
    return redirectError(url.origin, 'push_access_required', isHttps);
  }

  const repoData = (await repoRes.json()) as RepoResponse;
  if (repoData.permissions?.push !== true) {
    return redirectError(url.origin, 'push_access_required', isHttps);
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'genforge-kb-app',
    },
  });
  const userData = userRes.ok ? ((await userRes.json()) as UserResponse) : {};

  const hash = new URLSearchParams({
    auth_token: accessToken,
    auth_user: userData.login || 'collaborator',
    ...(userData.avatar_url ? { auth_avatar: userData.avatar_url } : {}),
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/#${hash.toString()}`,
      'Cache-Control': 'no-store',
      'Set-Cookie': clearStateCookie(isHttps),
    },
  });
};
