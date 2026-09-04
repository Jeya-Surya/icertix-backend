/**
 * iCertiX - Cryptographic & Hashing Service
 * 
 * Provides:
 * - Canonical JSON payload sorting and normalization
 * - SHA-256 cryptographic digest calculation
 * - Digital signature generation abstraction (HSM/KMS development implementation)
 * - Signature verification abstraction
 * - Unique Credential ID generation (e.g. ICX-2026-7F8A91C2)
 */

import crypto from 'crypto';
import { CredentialSignatureMetadata } from '../../shared/types';

export class CryptoService {
  private static readonly MOCK_SIGNING_KEY_ID = 'HSM-ICX-ED25519-PROD01';
  private static readonly ALGORITHM = 'SHA256withEd25519';

  /**
   * Deterministically normalizes and canonicalizes a JSON object (RFC 8785)
   */
  public static canonicalize(obj: Record<string, any>): string {
    const sortKeys = (input: any): any => {
      if (input === null || typeof input !== 'object') return input;
      if (Array.isArray(input)) return input.map(sortKeys);
      return Object.keys(input)
        .sort()
        .reduce((acc: Record<string, any>, key: string) => {
          acc[key] = sortKeys(input[key]);
          return acc;
        }, {});
    };
    return JSON.stringify(sortKeys(obj));
  }

  /**
   * Generates a SHA-256 hex digest of a canonical string or object
   */
  public static hashSha256(data: string | Record<string, any>): string {
    const rawString = typeof data === 'string' ? data : this.canonicalize(data);
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Generates an authoritative digital signature for a credential payload digest
   */
  public static signCredential(
    hashDigest: string,
    keyId: string = this.MOCK_SIGNING_KEY_ID
  ): CredentialSignatureMetadata {
    const timestamp = new Date().toISOString();
    // Simulate HMAC/Ed25519 digital signature proof
    const signatureProof = crypto
      .createHmac('sha256', `ICERTIX_HSM_SECRET_${keyId}`)
      .update(`${hashDigest}:${timestamp}`)
      .digest('hex');

    return {
      algorithm: this.ALGORITHM,
      signature: `SIG_${signatureProof.slice(0, 48).toUpperCase()}`,
      keyId,
      timestamp,
      publicKeyFingerprint: `FP-${crypto.createHash('sha256').update(keyId).digest('hex').slice(0, 16).toUpperCase()}`
    };
  }

  /**
   * Verifies the cryptographic signature of a credential
   */
  public static verifySignature(
    hashDigest: string,
    sigData: CredentialSignatureMetadata
  ): boolean {
    if (!sigData || !sigData.signature || !sigData.keyId) return false;
    const expected = crypto
      .createHmac('sha256', `ICERTIX_HSM_SECRET_${sigData.keyId}`)
      .update(`${hashDigest}:${sigData.timestamp}`)
      .digest('hex');
    const expectedSig = `SIG_${expected.slice(0, 48).toUpperCase()}`;
    return sigData.signature === expectedSig;
  }

  /**
   * Generates a globally unique Credential ID format: ICX-YYYY-XXXXXXXX
   */
  public static generateCredentialId(): string {
    const year = new Date().getFullYear();
    const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ICX-${year}-${randHex}`;
  }

  /**
   * Generates an official Certificate Serial Number: CERT-YYYY-XXXXX
   */
  public static generateCertificateNumber(orgCode: string = 'ICX'): string {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `${orgCode}-${year}-${randomSuffix}`;
  }
}
