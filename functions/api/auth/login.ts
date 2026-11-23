import type { CFPagesFunction } from '../../env';

export const onRequestGet: CFPagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.GITHUB_CLIENT_ID) {
    return Response.redirect(`${url.origin}/?auth_error=oauth_not_configured`, 302);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/auth/callback`;
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo');
  authorizeUrl.searchParams.set('state', state);

  const secureAttr = url.protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Cache-Control': 'no-store',
      'Set-Cookie': `kb_oauth_state=${encodeURIComponent(state)}; HttpOnly${secureAttr}; SameSite=Lax; Path=/api/auth; Max-Age=600`,
    },
  });
};
