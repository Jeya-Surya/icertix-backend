/**
 * iCertiX - Modern Responsive HTML Email Templates
 */

const baseEmailLayout = (title: string, contentHtml: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1329;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1329;
      padding: 40px 15px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #111e38;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 40px 24px;
      background: linear-gradient(135deg, #0A2540 0%, #0d1b30 100%);
      border-bottom: 1px solid #1e293b;
      text-align: center;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      margin: 0;
    }
    .logo-badge {
      display: inline-block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      padding: 4px 10px;
      border-radius: 20px;
      margin-top: 6px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .body {
      padding: 36px 40px;
      line-height: 1.6;
      font-size: 15px;
      color: #cbd5e1;
    }
    .h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .card-highlight {
      background-color: #1a2744;
      border: 1px solid #2d3f66;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0284c7;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      text-align: center;
      margin: 16px 0;
      box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.3);
    }
    .btn-secondary {
      background-color: #1e293b;
      color: #94a3b8 !important;
      border: 1px solid #334155;
      font-size: 13px;
      padding: 8px 18px;
      margin-left: 8px;
    }
    .badge-crypto {
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #10b981;
      font-family: monospace;
      margin-top: 12px;
    }
    .footer {
      padding: 24px 40px;
      background-color: #0d172a;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .meta-table td {
      padding: 6px 0;
      font-size: 13px;
    }
    .meta-label {
      color: #94a3b8;
      width: 35%;
    }
    .meta-value {
      color: #f1f5f9;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-text">iCertiX</div>
        <div class="logo-badge">Cryptographically Verified Credential</div>
      </div>
      <div class="body">
        ${contentHtml}
      </div>
      <div class="footer">
        <p>This is an automated transmission from the <strong>iCertiX Sovereign Credential Network</strong>.</p>
        <p>Protected by SHA-256 cryptographic hashing & tamper-evident Ed25519 digital signatures.</p>
        <p>&copy; ${new Date().getFullYear()} iCertiX Inc. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export interface CredentialEmailProps {
  candidateName: string;
  courseName: string;
  organisationName: string;
  certificateNumber: string;
  verificationUrl: string;
  issueDate?: string;
  grade?: string;
}

export function renderCredentialIssuedEmail(props: CredentialEmailProps): { subject: string; html: string } {
  const subject = `Your Official Certificate for "${props.courseName}" is Ready`;
  const content = `
    <h1 class="h1">Congratulations, ${props.candidateName}! 🎉</h1>
    <p>We are delighted to inform you that <strong>${props.organisationName}</strong> has officially issued your verified digital credential for completing <strong>${props.courseName}</strong>.</p>
    
    <div class="card-highlight">
      <div style="font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Official Credential Record</div>
      <table class="meta-table">
        <tr>
          <td class="meta-label">Recipient:</td>
          <td class="meta-value">${props.candidateName}</td>
        </tr>
        <tr>
          <td class="meta-label">Program/Course:</td>
          <td class="meta-value">${props.courseName}</td>
        </tr>
        <tr>
          <td class="meta-label">Certificate ID:</td>
          <td class="meta-value" style="font-family: monospace; color: #38bdf8;">${props.certificateNumber}</td>
        </tr>
        <tr>
          <td class="meta-label">Issuing Authority:</td>
          <td class="meta-value">${props.organisationName}</td>
        </tr>
        ${props.issueDate ? `<tr><td class="meta-label">Issue Date:</td><td class="meta-value">${props.issueDate}</td></tr>` : ''}
        ${props.grade ? `<tr><td class="meta-label">Distinction / Grade:</td><td class="meta-value" style="color: #10b981;">${props.grade}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.verificationUrl}" class="btn" target="_blank">View & Verify Certificate &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      <strong>Permanent Proof:</strong> Your certificate is cryptographically anchored. You can share this credential link with employers, admissions boards, or on your LinkedIn profile.
    </p>

    <div class="badge-crypto">
      🔒 <span>Secured with Sovereign Cryptographic Hash Proof</span>
    </div>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}

export interface CredentialRevokedEmailProps {
  candidateName: string;
  courseName: string;
  organisationName: string;
  certificateNumber: string;
  reason: string;
}

export function renderCredentialRevokedEmail(props: CredentialRevokedEmailProps): { subject: string; html: string } {
  const subject = `Notice: Credential Status Update - ${props.certificateNumber}`;
  const content = `
    <h1 class="h1" style="color: #ef4444;">Notice: Credential Revoked</h1>
    <p>Dear ${props.candidateName},</p>
    <p>This is an official notice that the credential issued by <strong>${props.organisationName}</strong> for <strong>${props.courseName}</strong> has been revoked in the registry.</p>
    
    <div class="card-highlight" style="border-left: 4px solid #ef4444;">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Certificate ID:</td>
          <td class="meta-value" style="font-family: monospace;">${props.certificateNumber}</td>
        </tr>
        <tr>
          <td class="meta-label">Course:</td>
          <td class="meta-value">${props.courseName}</td>
        </tr>
        <tr>
          <td class="meta-label">Revocation Reason:</td>
          <td class="meta-value" style="color: #f87171;">${props.reason}</td>
        </tr>
        <tr>
          <td class="meta-label">Effective Date:</td>
          <td class="meta-value">${new Date().toISOString().split('T')[0]}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      If you believe this action was made in error, please contact your institution's registrar or administration office directly.
    </p>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}

export interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  resetToken?: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps): { subject: string; html: string } {
  const subject = `iCertiX - Password Reset Request`;
  const content = `
    <h1 class="h1">Reset Your Password</h1>
    <p>Hello ${props.name},</p>
    <p>We received a request to reset your password for your iCertiX account. Click the button below to choose a new password:</p>
    
    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.resetUrl}" class="btn" target="_blank">Reset My Password &rarr;</a>
    </div>

    ${props.resetToken ? `
    <div class="card-highlight" style="text-align: center;">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Your Security Verification Code:</div>
      <div style="font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #38bdf8;">${props.resetToken}</div>
    </div>
    ` : ''}

    <p style="font-size: 13px; color: #94a3b8;">
      This link will expire in <strong>${props.expiresInMinutes || 15} minutes</strong> for security reasons.
    </p>
    <p style="font-size: 12px; color: #64748b;">
      If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}

export interface UserInviteEmailProps {
  name: string;
  organisationName: string;
  role: string;
  loginUrl: string;
  temporaryPassword?: string;
}

export function renderUserInviteEmail(props: UserInviteEmailProps): { subject: string; html: string } {
  const subject = `You've been invited to join ${props.organisationName} on iCertiX`;
  const content = `
    <h1 class="h1">Welcome to the Team! 👋</h1>
    <p>Hello ${props.name},</p>
    <p>You have been invited to join <strong>${props.organisationName}</strong> on the iCertiX Digital Credential Platform as <strong>${props.role}</strong>.</p>
    
    <div class="card-highlight">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Institution:</td>
          <td class="meta-value">${props.organisationName}</td>
        </tr>
        <tr>
          <td class="meta-label">Assigned Role:</td>
          <td class="meta-value" style="color: #38bdf8;">${props.role}</td>
        </tr>
        ${props.temporaryPassword ? `
        <tr>
          <td class="meta-label">Temporary Password:</td>
          <td class="meta-value" style="font-family: monospace; color: #facc15;">${props.temporaryPassword}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.loginUrl}" class="btn" target="_blank">Access Your Account &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      We recommend updating your password immediately after your first sign in.
    </p>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}

export interface CandidateWelcomeEmailProps {
  name: string;
  organisationName: string;
  studentId: string;
  claimUrl: string;
}

export function renderCandidateWelcomeEmail(props: CandidateWelcomeEmailProps): { subject: string; html: string } {
  const subject = `Welcome to your ${props.organisationName} Credential Portal`;
  const content = `
    <h1 class="h1">Welcome, ${props.name}!</h1>
    <p>You have been enrolled in <strong>${props.organisationName}</strong>'s official digital credential portal on iCertiX.</p>
    
    <div class="card-highlight">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Institution:</td>
          <td class="meta-value">${props.organisationName}</td>
        </tr>
        <tr>
          <td class="meta-label">Your Candidate ID:</td>
          <td class="meta-value" style="font-family: monospace; color: #38bdf8; font-size: 16px;">${props.studentId}</td>
        </tr>
      </table>
    </div>

    <p>Activate your personal digital wallet to claim your certificates, access verifiable badges, and share your achievements directly with employers:</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.claimUrl}" class="btn" target="_blank">Activate My Candidate Portal &rarr;</a>
    </div>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}

export function renderTestEmail(toEmail: string): { subject: string; html: string } {
  const subject = `iCertiX - SMTP & Email Service Diagnostic Test`;
  const content = `
    <h1 class="h1" style="color: #10b981;">SMTP Service Operational! 🚀</h1>
    <p>This is an automated test email confirming that your email transporter configuration in <strong>iCertiX</strong> is properly connected and functioning.</p>
    
    <div class="card-highlight">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Target Recipient:</td>
          <td class="meta-value">${toEmail}</td>
        </tr>
        <tr>
          <td class="meta-label">Timestamp:</td>
          <td class="meta-value">${new Date().toISOString()}</td>
        </tr>
        <tr>
          <td class="meta-label">Delivery Mode:</td>
          <td class="meta-value" style="color: #10b981;">Live SMTP / SES Gateway</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      All credential issuances, invitations, and authentication recovery emails are fully enabled.
    </p>
  `;

  return { subject, html: baseEmailLayout(subject, content) };
}
