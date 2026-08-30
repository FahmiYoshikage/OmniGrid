import { NextResponse } from 'next/server';
import { generateCodeVerifier } from 'arctic';
import { getGoogle, getGoogleOAuthRedirectUri } from '@/lib/auth/google';
import { getSessionUser } from '@/lib/auth/session';
import { createOAuthRequest } from '@/lib/auth/oauth-requests';
import { buildPublicUrl } from '@/lib/auth/urls';
import { protectRateLimit } from '@/lib/security/request';

export async function GET(request: Request) {
    const rateResponse = protectRateLimit(request, 'auth-google-initiation', { limit: 20, windowMs: 60_000 });
    if (rateResponse) return rateResponse;
    const url = new URL(request.url);
    const intent = url.searchParams.get('intent');
    const sessionUser = intent === 'link' ? await getSessionUser() : null;

    if (intent === 'link' && !sessionUser) {
        return NextResponse.redirect(
            buildPublicUrl('/login?error=login_required', request.url)
        );
    }

    const google = getGoogle();
    const redirectUri = getGoogleOAuthRedirectUri();
    const codeVerifier = generateCodeVerifier();
    const { state } = await createOAuthRequest({
        provider: 'google',
        secureCookie: redirectUri.startsWith('https://'),
        codeVerifier,
        linkUserId: sessionUser?.id ?? null,
    });

    const authorizationUrl = google.createAuthorizationURL(
        state,
        codeVerifier,
        ['openid', 'profile', 'email']
    );
    return NextResponse.redirect(authorizationUrl);
}
