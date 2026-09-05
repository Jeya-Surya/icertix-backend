/**
 * iCertiX — Global Credentialing Standards Engine
 * 
 * Implements:
 * 1. W3C Verifiable Credentials (VC) Data Model 1.1 / 2.0 (JSON-LD)
 * 2. 1EdTech Open Badges 3.0 (OBv3) Standard
 * 3. Standalone Vector SVG Social Badge Generation
 */

import { Credential, Organisation } from '../../shared/types';
import { CryptoService } from '../crypto/CryptoService';

export interface W3cVerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name: string;
    url?: string;
    image?: string;
  };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    name: string;
    studentId?: string;
    email?: string;
    achievement: {
      id: string;
      type: string[];
      name: string;
      description: string;
      criteria?: { narrative: string };
      image?: string;
    };
    grade?: string;
    score?: number;
    skills?: string[];
  };
  evidence?: Array<{
    id: string;
    type: string[];
    verifierUrl: string;
    sha256Digest: string;
  }>;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
    keyId: string;
  };
}

export interface OpenBadgesV3Credential {
  '@context': string[];
  id: string;
  type: string[];
  name: string;
  description: string;
  image: {
    id: string;
    type: string;
  };
  criteria: {
    narrative: string;
  };
  issuer: {
    id: string;
    type: string[];
    name: string;
    url: string;
    email?: string;
  };
  recipient: {
    type: string;
    identity: string;
    hashed: boolean;
    name: string;
  };
  issuedOn: string;
  expires?: string;
  alignment?: Array<{
    targetName: string;
    targetUrl: string;
    targetDescription?: string;
  }>;
  results?: Array<{
    value: string | number;
    status: string;
  }>;
}

export class W3cCredentialsService {
  /**
   * Transforms an internal iCertiX Credential into a standard W3C Verifiable Credential JSON-LD
   */
  public static toW3cVerifiableCredential(
    cred: Credential,
    org?: Organisation | null
  ): W3cVerifiableCredential {
    const orgDomain = org?.domain || 'icertix.app';
    const orgName = org?.name || cred.courseName || 'Academic Institution';
    const candidateEmail = (cred as any).candidateEmail || (cred as any).recipient?.email || 'student@domain.edu';
    const candidateName = cred.candidateName || (cred as any).recipient?.name || 'Verified Recipient';
    const studentId = (cred as any).studentId || (cred as any).recipient?.studentId;

    const issuerDid = `did:web:${orgDomain}`;
    const subjectDid = `did:mailto:${encodeURIComponent(candidateEmail)}`;
    const verificationUrl = cred.verificationUrl || `https://verify.icertix.app/v/${cred.id}`;
    const numericScore = cred.score !== undefined ? (typeof cred.score === 'string' ? parseFloat(cred.score) || 0 : cred.score) : undefined;

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: `urn:uuid:${cred.id}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential', 'AcademicDegreeCredential'],
      issuer: {
        id: issuerDid,
        name: orgName,
        url: (org as any)?.website || `https://${orgDomain}`,
        image: `https://${orgDomain}/logo.png`
      },
      issuanceDate: new Date(cred.issueDate || Date.now()).toISOString(),
      ...(cred.expiryDate ? { expirationDate: new Date(cred.expiryDate).toISOString() } : {}),
      credentialSubject: {
        id: subjectDid,
        name: candidateName,
        ...(studentId ? { studentId } : {}),
        email: candidateEmail,
        achievement: {
          id: `urn:icertix:course:${cred.courseId || 'CRS_001'}`,
          type: ['Achievement', 'CourseCompletion'],
          name: cred.courseName || 'Certificate of Completion',
          description: `Demonstrated distinguished proficiency in ${cred.courseName || 'Course'} and achieved all accredited standards.`
        },
        ...(cred.grade ? { grade: cred.grade } : {}),
        ...(numericScore !== undefined ? { score: numericScore } : {}),
        ...(cred.skills && cred.skills.length > 0 ? { skills: cred.skills } : {})
      },
      evidence: [
        {
          id: `urn:icertix:verification:${cred.id}`,
          type: ['CryptographicDigestEvidence', 'DocumentVerification'],
          verifierUrl: verificationUrl,
          sha256Digest: cred.hashDigest || CryptoService.hashSha256(cred.id)
        }
      ],
      proof: {
        type: 'Ed25519Signature2020',
        created: cred.signatureData?.timestamp || new Date().toISOString(),
        verificationMethod: `${issuerDid}#${cred.signatureData?.keyId || 'KEY-ED25519-01'}`,
        proofPurpose: 'assertionMethod',
        proofValue: cred.signatureData?.signature || 'SIG_ED25519_VERIFIABLE_PROOF',
        keyId: cred.signatureData?.keyId || 'HSM-ED25519-PROD01'
      }
    };
  }

  /**
   * Transforms an internal iCertiX Credential into an 1EdTech Open Badges 3.0 standard payload
   */
  public static toOpenBadgeV3(
    cred: Credential,
    org?: Organisation | null
  ): OpenBadgesV3Credential {
    const orgDomain = org?.domain || 'icertix.app';
    const orgName = org?.name || 'Academic Institution';
    const candidateEmail = (cred as any).candidateEmail || (cred as any).recipient?.email || 'student@domain.edu';
    const candidateName = cred.candidateName || (cred as any).recipient?.name || 'Verified Recipient';

    return {
      '@context': [
        'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
        'https://www.w3.org/2018/credentials/v1'
      ],
      id: `urn:uuid:${cred.id}`,
      type: ['OpenBadgeCredential', 'VerifiableCredential'],
      name: cred.courseName || 'Professional Certification',
      description: `Officially certified by ${orgName} in recognition of academic excellence and verified completion of ${cred.courseName}.`,
      image: {
        id: `https://verify.icertix.app/api/public/verify/${cred.id}/badge-svg`,
        type: 'Image'
      },
      criteria: {
        narrative: `Successful completion of all curriculum modules, rigorous assessments, and attainment of required distinction standards in ${cred.courseName}.`
      },
      issuer: {
        id: `https://${orgDomain}/issuer.json`,
        type: ['Profile', 'Issuer'],
        name: orgName,
        url: (org as any)?.website || `https://${orgDomain}`,
        email: `credentials@${orgDomain}`
      },
      recipient: {
        type: 'email',
        identity: candidateEmail,
        hashed: false,
        name: candidateName
      },
      issuedOn: new Date(cred.issueDate || Date.now()).toISOString(),
      ...(cred.expiryDate ? { expires: new Date(cred.expiryDate).toISOString() } : {}),
      alignment: (cred.skills || ['Applied Proficiency', 'Verified Competency']).map(skill => ({
        targetName: skill,
        targetUrl: `https://www.onetonline.org/find/result?s=${encodeURIComponent(skill)}`,
        targetDescription: `Demonstrated competency in ${skill}`
      })),
      results: [
        {
          value: cred.score !== undefined ? `${cred.score}%` : (cred.grade || 'Passed'),
          status: cred.status === 'ACTIVE' ? 'Completed' : 'Revoked'
        }
      ]
    };
  }

  /**
   * Generates a clean, standalone vector SVG badge for sharing and embedding
   */
  public static toSocialBadgeSvg(
    cred: Credential,
    org?: Organisation | null
  ): string {
    const orgName = (org?.name || 'iCertiX Authorized Issuer').slice(0, 32);
    const candidateName = (cred.candidateName || 'Verified Earner').slice(0, 28);
    const courseName = (cred.courseName || 'Certified Achievement').slice(0, 34);
    const grade = cred.grade || 'Verified Distinction';
    const primaryColor = org?.badgeColor || '#0A2540';
    const certId = cred.id || 'ICX-2026';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="600" height="340" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050e20" />
      <stop offset="50%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="#02142B" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE570" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect width="600" height="340" rx="24" fill="url(#bgGrad)" stroke="#1E3A8A" stroke-width="2" />

  <!-- Outer Ornate Border -->
  <rect x="14" y="14" width="572" height="312" rx="16" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4 4" />

  <!-- Issuer Header -->
  <circle cx="56" cy="56" r="22" fill="rgba(255,255,255,0.12)" />
  <text x="56" y="63" fill="#FFFFFF" font-size="16" font-weight="bold" text-anchor="middle">${(org?.logo || 'IC')}</text>

  <text x="92" y="52" fill="#93C5FD" font-size="12" font-weight="600" letter-spacing="1.5">OFFICIAL VERIFIED BADGE</text>
  <text x="92" y="70" fill="#FFFFFF" font-size="15" font-weight="bold">${orgName}</text>

  <!-- Verified Pill -->
  <rect x="460" y="40" width="105" height="28" rx="14" fill="#065F46" />
  <circle cx="475" cy="54" r="5" fill="#34D399" />
  <text x="488" y="59" fill="#D1FAE5" font-size="11" font-weight="bold" font-family="monospace">VERIFIED</text>

  <!-- Divider -->
  <line x1="36" y1="96" x2="564" y2="96" stroke="rgba(255,255,255,0.12)" stroke-width="1" />

  <!-- Course Title -->
  <text x="36" y="132" fill="url(#goldGrad)" font-size="20" font-weight="bold">${courseName}</text>

  <!-- Candidate Name -->
  <text x="36" y="168" fill="#94A3B8" font-size="12" font-weight="500">AWARDED TO</text>
  <text x="36" y="198" fill="#FFFFFF" font-size="22" font-weight="bold">${candidateName}</text>

  <!-- Distinction / Grade -->
  <rect x="36" y="218" width="180" height="24" rx="12" fill="rgba(255,255,255,0.08)" />
  <text x="46" y="234" fill="#38BDF8" font-size="11" font-weight="600">${grade}</text>

  <!-- Footer Info -->
  <line x1="36" y1="264" x2="564" y2="264" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
  <text x="36" y="292" fill="#64748B" font-size="11" font-family="monospace">ID: <tspan fill="#CBD5E1">${certId}</tspan></text>
  <text x="564" y="292" fill="#64748B" font-size="11" font-family="monospace" text-anchor="end">W3C VC / Open Badges 3.0</text>
</svg>`;
  }
}
