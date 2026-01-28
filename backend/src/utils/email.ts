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

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've been invited to join ${params.organizationName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #465360; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F0F1F4;">
    <div style="background: linear-gradient(135deg, #c0dfa1 0%, #90b171 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="${APP_URL}/Nexuslogo.png" alt="Nexus Impacts" style="height: 50px; margin-bottom: 15px;" />
        <h1 style="color: #465360; margin: 0; font-size: 24px; font-weight: 600;">You're Invited!</h1>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; margin-bottom: 20px; color: #465360;">
            <strong>${inviterDisplay}</strong> has invited you to collaborate on <strong>${params.organizationName}</strong> in Nexus Impacts.
        </p>
        
        <div style="background: #f4f9f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #c0dfa1;">
            <p style="margin: 0; font-size: 14px; color: #465360;">
                <strong>What you'll be able to do:</strong>
            </p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #465360;">
                <li>View all initiatives, KPIs, and evidence</li>
                <li>Create and edit data</li>
                ${params.canAddImpactClaims ? '<li>Create impact claims (stories)</li>' : ''}
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #c0dfa1 0%, #90b171 100%); color: #465360; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Accept Invitation
            </a>
        </div>
        
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #90b171; word-break: break-all;">${inviteUrl}</a>
        </p>
    </div>
    
    <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">Sent by <strong>Nexus Impacts</strong></p>
        <p style="margin: 5px 0 0 0;">AI-powered impact tracking for nonprofits</p>
    </div>
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
