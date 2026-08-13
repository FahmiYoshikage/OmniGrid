import { NextRequest, NextResponse } from 'next/server';
import { getGitHub, fetchGitHubUser } from '@/lib/auth/github';
import { linkIdentityToUser } from '@/lib/auth/accounts';
import { upsertGitHubUser } from '@/lib/auth/user';
import { createSession } from '@/lib/auth/session';
import { consumeOAuthRequest } from '@/lib/auth/oauth-requests';
import { buildPublicUrl } from '@/lib/auth/urls';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
        return NextResponse.redirect(
            buildPublicUrl('/login?error=invalid_state', request.url)
        );
    }

    const requestState = await consumeOAuthRequest('github', state);
    if (!requestState) {
        return NextResponse.redirect(
            buildPublicUrl('/login?error=invalid_state', request.url)
        );
    }

    try {
        const github = getGitHub();
        const tokens = await github.validateAuthorizationCode(code);
        const accessToken = tokens.accessToken();
        const ghUser = await fetchGitHubUser(accessToken);

        if (requestState.linkUserId) {
            linkIdentityToUser(requestState.linkUserId, {
                provider: 'github',
                providerUserId: String(ghUser.id),
                email: ghUser.email ?? ghUser.verified_email ?? null,
                username: ghUser.login,
                displayName: ghUser.name,
                avatarUrl: ghUser.avatar_url,
            });
            await createSession(requestState.linkUserId);
            return NextResponse.redirect(
                buildPublicUrl('/settings?auth=github-linked', request.url)
            );
        }

        const userId = upsertGitHubUser(ghUser);
        await createSession(userId);

        return NextResponse.redirect(
            buildPublicUrl('/auth/success?provider=github', request.url)
        );
    } catch (error) {
        console.error('[auth] GitHub OAuth callback error:', error);
        if (requestState.linkUserId) {
            return NextResponse.redirect(
                buildPublicUrl(
                    '/settings?authError=github-link-failed',
                    request.url
                )
            );
        }
        return NextResponse.redirect(
            buildPublicUrl('/login?error=auth_failed', request.url)
        );
    }
}
