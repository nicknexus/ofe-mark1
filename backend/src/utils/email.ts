/**
 * Email utility for sending transactional emails via Resend
 * 
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Create an API key
 * 3. Add RESEND_API_KEY to your .env file
 * 4. Verify your sending domain (or use onboarding@resend.dev for testing)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
// For testing: use 'onboarding@resend.dev' (only sends to your Resend account email)
// For production: use your verified domain like 'Nexus Impacts <team@nexusimpacts.ai>'
// The format "Display Name <email>" shows "Display Name" in the recipient's inbox
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

interface SendEmailResult {
    success: boolean;
    id?: string;
    error?: string;
}

/**
 * Send an email via Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured - email will not be sent');
        return { success: false, error: 'Email service not configured' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text
            })
        });

        const data = await response.json() as { id?: string; message?: string };

        if (!response.ok) {
            console.error('Resend API error:', data);
            return { success: false, error: data.message || 'Failed to send email' };
        }

        return { success: true, id: data.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Send team invitation email
 */
export async function sendTeamInvitationEmail(params: {
    to: string;
    inviterName?: string;
    inviterEmail: string;
    organizationName: string;
    inviteToken: string;
    canAddImpactClaims: boolean;
}): Promise<SendEmailResult> {
    const inviteUrl = `${APP_URL}/invite/${params.inviteToken}`;
    const inviterDisplay = params.inviterName || params.inviterEmail;

    // Brand colors matching site (primary green #c0dfa1, grey text #465360)
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join ${params.organizationName}</title>
</head>
<body style="font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #465360; margin: 0; padding: 0; background-color: #fafafa;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, rgba(192,223,161,0.25) 0%, #fafafa 50%); min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto;">
                    <!-- Logo + brand header (matches login/invite page) -->
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 8px;">
                                        <img src="${APP_URL}/Nexuslogo.png" alt="Nexus" width="40" height="40" style="display: block; border-radius: 8px;" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <span style="font-size: 20px; font-weight: 200; color: #465360; letter-spacing: 0.02em;">Nexus Impacts</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Card -->
                    <tr>
                        <td style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(70,83,96,0.08); border: 1px solid rgba(255,255,255,0.8); overflow: hidden;">
                            <!-- Card header with green accent -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(192,223,161,0.25); border-bottom: 1px solid rgba(192,223,161,0.3);">
                                <tr>
                                    <td align="center" style="padding: 28px 24px;">
                                        <div style="width: 56px; height: 56px; background: rgba(192,223,161,0.4); border-radius: 50%; margin: 0 auto 12px; border: 1px solid rgba(192,223,161,0.5); line-height: 56px; text-align: center; font-size: 28px;">👋</div>
                                        <h1 style="color: #465360; margin: 0; font-size: 22px; font-weight: 600;">You're Invited!</h1>
                                        <p style="color: #465360; margin: 8px 0 0; font-size: 15px; opacity: 0.9;">${inviterDisplay} has invited you to join</p>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 24px;">
                                <tr>
                                    <td>
                                        <!-- Organization name -->
                                        <div style="background: rgba(192,223,161,0.12); border: 1px solid rgba(192,223,161,0.25); border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
                                            <span style="font-size: 18px; font-weight: 600; color: #465360;">${params.organizationName}</span>
                                        </div>
                                        <p style="font-size: 15px; margin: 0 0 16px; color: #465360;">
                                            <strong>What you'll be able to do:</strong>
                                        </p>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                            <tr><td style="padding: 6px 0; font-size: 14px; color: #465360;"><span style="color: #c0dfa1; margin-right: 8px;">✓</span> View all initiatives, KPIs, and evidence</td></tr>
                                            <tr><td style="padding: 6px 0; font-size: 14px; color: #465360;"><span style="color: #c0dfa1; margin-right: 8px;">✓</span> Create and edit data</td></tr>
                                            ${params.canAddImpactClaims ? '<tr><td style="padding: 6px 0; font-size: 14px; color: #465360;"><span style="color: #c0dfa1; margin-right: 8px;">✓</span> Create impact claims (stories)</td></tr>' : ''}
                                        </table>
                                        <!-- CTA button (primary green) -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" style="padding: 8px 0 20px;">
                                                    <a href="${inviteUrl}" style="display: inline-block; background: #c0dfa1; color: #465360; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">
                                            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
                                        </p>
                                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
                                        <p style="font-size: 12px; color: #6b7280; margin: 0;">
                                            If the button doesn't work, copy this link:<br>
                                            <a href="${inviteUrl}" style="color: #c0dfa1; word-break: break-all;">${inviteUrl}</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 16px; font-size: 12px; color: #6b7280;">
                            <p style="margin: 0;">Nexus Impacts</p>
                            <p style="margin: 4px 0 0 0;">AI-powered impact tracking for nonprofits</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

    const text = `
You've been invited to join ${params.organizationName}!

${inviterDisplay} has invited you to collaborate on ${params.organizationName} in Nexus Impacts.

What you'll be able to do:
- View all initiatives, KPIs, and evidence
- Create and edit data
${params.canAddImpactClaims ? '- Create impact claims (stories)' : ''}

Accept your invitation here: ${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

--
Nexus Impacts
AI-powered impact tracking for nonprofits
`;

    return sendEmail({
        to: params.to,
        subject: `You've been invited to join ${params.organizationName} on Nexus`,
        html,
        text
    });
}
