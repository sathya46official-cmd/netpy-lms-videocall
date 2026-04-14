import { Resend } from 'resend';

// Lazy initialization — only throw when actually trying to send,
// not at module load time (avoids build failures when key is not yet set)
function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith('re_your_')) {
    throw new Error('RESEND_API_KEY is not configured. Add it to .env.local');
  }
  return new Resend(key);
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organisation Admin',
  staff: 'Staff / Teacher',
  student: 'Student',
};

interface SendInviteEmailParams {
  toEmail: string;
  role: string;
  inviteUrl: string;
  invitedByName?: string;
  orgName?: string;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'about:blank';
    }
    return escapeHtml(url);
  } catch {
    return 'about:blank';
  }
}

export async function sendInviteEmail({
  toEmail,
  role,
  inviteUrl,
  invitedByName,
  orgName,
}: SendInviteEmailParams) {
  const resend = getResendClient();
  const roleLabel = ROLE_LABEL[role] ?? role;
  const platformName = orgName ? `${orgName} on Netpy LMS` : 'Netpy LMS';

  const safeToEmail = escapeHtml(toEmail);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safePlatformName = escapeHtml(platformName);
  const safeInviter = escapeHtml(invitedByName);
  const safeInviteUrl = sanitizeUrl(inviteUrl);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#f4f7fa;font-family:Inter,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#10b981,#0d9488);padding:36px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">📹 Netpy LMS</h1>
                  <p style="margin:8px 0 0;color:#d1fae5;font-size:14px;">Live Learning Platform</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  <h2 style="margin:0 0 12px;font-size:22px;color:#111827;font-weight:700;">You've been invited!</h2>
                  <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
                    ${safeInviter ? `<strong>${safeInviter}</strong> has invited you` : 'You have been invited'} to join
                    <strong>${safePlatformName}</strong> as a <strong>${safeRoleLabel}</strong>.
                  </p>
                  <p style="margin:0 0 32px;color:#6b7280;font-size:15px;line-height:1.6;">
                    Click the button below to set up your account. This link expires in <strong>72 hours</strong>.
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#10b981,#0d9488);border-radius:10px;">
                        <a href="${safeInviteUrl}"
                           style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                          Accept Invitation →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#065f46;">
                      🔒 This invite is for <strong>${safeToEmail}</strong> only. Please don't share it.
                    </p>
                  </div>
                  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
                    If the button doesn't work, copy this link:<br/>
                    <a href="${safeInviteUrl}" style="color:#10b981;">${safeInviteUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    © ${new Date().getFullYear()} Netpy LMS. If you didn't expect this, ignore it safely.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return resend.emails.send({
    from: 'Netpy LMS <onboarding@resend.dev>',
    to: toEmail,
    subject: `You're invited to join ${platformName} as ${roleLabel}`,
    html,
  });
}
