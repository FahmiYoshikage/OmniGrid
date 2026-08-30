import { NextResponse } from 'next/server';
import { getGitHub, getGitHubOAuthRedirectUri } from '@/lib/auth/github';
import { getSessionUser } from '@/lib/auth/session';
import { createOAuthRequest } from '@/lib/auth/oauth-requests';
import { buildPublicUrl } from '@/lib/auth/urls';
import { protectRateLimit } from '@/lib/security/request';

export async function GET(request: Request) {
    const rateResponse = protectRateLimit(request, 'auth-github-initiation', { limit: 20, windowMs: 60_000 });
    if (rateResponse) return rateResponse;
    const url = new URL(request.url);
    const intent = url.searchParams.get('intent');
    const sessionUser = intent === 'link' ? await getSessionUser() : null;

    if (intent === 'link' && !sessionUser) {
        return NextResponse.redirect(
            buildPublicUrl('/login?error=login_required', request.url)
        );
    }

    const github = getGitHub();
    const redirectUri = getGitHubOAuthRedirectUri();
    const { state } = await createOAuthRequest({
        provider: 'github',
        secureCookie: redirectUri.startsWith('https://'),
        linkUserId: sessionUser?.id ?? null,
    });

    const authorizationUrl = github.createAuthorizationURL(state, [
        'read:user',
        'user:email',
    ]);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);

    return NextResponse.redirect(authorizationUrl);
}
