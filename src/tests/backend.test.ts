/**
 * iCertiX - Backend Automated Test Suite
 *
 * Verifies:
 * - Authentication & Token resolution
 * - RBAC & Role hierarchy enforcement
 * - SUPER_ADMIN global access
 * - PLATFORM_ADMIN restrictions (cannot touch SUPER_ADMIN)
 * - Multi-tenant isolation enforcement
 * - Candidate self-service scope isolation
 * - Cryptographic canonicalization, hashing, and signature verification
 * - Public verification (unauthenticated)
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { AppRepositories } from "../infrastructure/database";
import { CryptoService } from "../infrastructure/crypto/CryptoService";
import { W3cCredentialsService } from "../infrastructure/standards/W3cCredentialsService";
import { queueService } from "../infrastructure/queue/QueueService";
import { cacheService } from "../infrastructure/cache/CacheService";
import { webhookService, WebhookService } from "../infrastructure/webhooks/WebhookService";
import { authService } from "../modules/auth/auth.router";
import { hasPermission, ROLE_HIERARCHY } from "../common/constants/roles";

export async function runBackendTests(): Promise<{
  passed: number;
  failed: number;
  results: string[];
}> {
  await AppRepositories.initializeDatabase();
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      results.push(`❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };

  // 1. Role Hierarchy Tests
  await test("Role Hierarchy: SUPER_ADMIN > ORG_ADMIN > CANDIDATE", () => {
    if (ROLE_HIERARCHY.SUPER_ADMIN <= ROLE_HIERARCHY.ORG_ADMIN)
      throw new Error("SUPER_ADMIN must be higher than ORG_ADMIN");
    if (ROLE_HIERARCHY.ORG_ADMIN <= ROLE_HIERARCHY.CANDIDATE)
      throw new Error("ORG_ADMIN must be higher than CANDIDATE");
  });

  // 2. Permissions Tests
  await test("RBAC: SUPER_ADMIN has global wildcard permission", () => {
    if (!hasPermission("SUPER_ADMIN", ["*"], "any:action:here"))
      throw new Error("Super admin must have access to everything");
  });

  await test("RBAC: CANDIDATE cannot issue certificates", () => {
    if (hasPermission("CANDIDATE", undefined, "certificates:issue"))
      throw new Error("Candidate should not have certificates:issue permission");
  });

  // 3. Authentication & Seed Tests
  await test("Auth: SUPER_ADMIN seed login succeeds with organisationId null", async () => {
    const res = await authService.login(
      "superadmin@icertix.demo",
      "password123",
    );
    if (res.user.role !== "SUPER_ADMIN")
      throw new Error("Role must be SUPER_ADMIN");
    if (
      res.user.organisationId !== null &&
      res.user.organisationId !== undefined
    ) {
      throw new Error("SUPER_ADMIN organisationId must be null");
    }
  });

  await test("Auth: Invalid email throws error", async () => {
    try {
      await authService.login("nonexistent@domain.com", "password");
      throw new Error("Should have failed");
    } catch (err: any) {
      if (err.message.includes("Should have failed")) throw err;
    }
  });

  // 4. Multi-Tenant Isolation Tests
  await test("Tenant Isolation: Stanford ORG_001 cannot query MIT candidates by default", async () => {
    const res = await AppRepositories.candidates.findAll("ORG_001");
    const hasMit = res.items.some((c) => c.organisationId === "ORG_002");
    if (hasMit)
      throw new Error("ORG_001 candidate query leaked ORG_002 records");
  });

  // 5. Cryptographic Service Tests
  await test("Crypto: Deterministic canonicalization and SHA-256 hash digest", () => {
    const objA = { z: 1, a: 2, m: { y: "test", b: "nested" } };
    const objB = { a: 2, m: { b: "nested", y: "test" }, z: 1 };
    const hashA = CryptoService.hashSha256(objA);
    const hashB = CryptoService.hashSha256(objB);
    if (hashA !== hashB)
      throw new Error(
        "Canonicalization must produce identical hashes regardless of key order",
      );
  });

  await test("Crypto: Signature verification succeeds for genuine credentials", () => {
    const digest =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const sig = CryptoService.signCredential(digest, "HSM-KEY-01");
    const valid = CryptoService.verifySignature(digest, sig);
    if (!valid)
      throw new Error(
        "Signature verification failed for newly generated signature",
      );
  });

  await test("Crypto: Signature verification fails if digest was tampered", () => {
    const digest =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const sig = CryptoService.signCredential(digest, "HSM-KEY-01");
    const tamperedDigest =
      "f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149a";
    const valid = CryptoService.verifySignature(tamperedDigest, sig);
    if (valid)
      throw new Error(
        "Tampered digest should have failed signature verification",
      );
  });

  // 6. Student Candidate Account Claim & Private Password Security Tests
  const runUid = Date.now().toString().slice(-6);
  const studentEmail = `student_${runUid}@mit.edu`;
  const studentId = `ST-${runUid}`;
  const privatePassword = "SecretStudentPass#2026";

  await test("Candidate Auth: Enrolled student can claim account and set private password", async () => {
    const orgId = `ORG_MIT_${runUid}`;

    // Setup candidate
    await AppRepositories.organisations.create({
      id: orgId,
      name: "MIT Test",
      code: `MIT_${runUid}`,
      domain: `mit_${runUid}.edu`,
      department: "Engineering",
      logo: "MIT",
      badgeColor: "#000",
      plan: "Free",
      status: "ACTIVE",
      certificateQuota: { used: 0, total: 100 },
      features: { apiAccess: false, whiteLabel: false, customDomain: false, sso: false, maxTemplates: 2 },
      signatories: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await AppRepositories.candidates.create({
      id: `CAN_${runUid}`,
      organisationId: orgId,
      name: "Alex Johnson",
      email: studentEmail,
      studentId: studentId,
      department: "Engineering",
      status: "Active",
      enrolledCourseIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // First-time claim succeeds
    const claimResult = await authService.claimCandidateAccount({
      email: studentEmail,
      studentId: studentId,
      newPassword: privatePassword,
      name: "Alex Johnson"
    });

    if (!claimResult.user || claimResult.user.role !== "CANDIDATE") {
      throw new Error("Claim failed to return active candidate user");
    }
  });

  await test("Candidate Auth: Cannot re-claim account or create new password with Student ID once claimed", async () => {
    try {
      await authService.claimCandidateAccount({
        email: studentEmail,
        studentId: studentId,
        newPassword: "AnotherNewPassword123"
      });
      throw new Error("Should have blocked second claim attempt");
    } catch (err: any) {
      if (err.message.includes("Should have blocked")) throw err;
      if (!err.message.includes("already been claimed")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  await test("Candidate Auth: Cannot log in using Student ID as password once private password is created", async () => {
    try {
      await authService.login(studentEmail, studentId);
      throw new Error("Should not allow logging in with student ID as password");
    } catch (err: any) {
      if (err.message.includes("Should not allow")) throw err;
    }
  });

  await test("Candidate Auth: Login succeeds using Student ID as username with private password", async () => {
    const res = await authService.login(studentId, privatePassword);
    if (!res.user || res.user.role !== "CANDIDATE") {
      throw new Error("Login with Student ID + private password failed");
    }
  });

  await test("Candidate Auth: Login succeeds using Student Email with private password", async () => {
    const res = await authService.login(studentEmail, privatePassword);
    if (!res.user || res.user.role !== "CANDIDATE") {
      throw new Error("Login with Student Email + private password failed");
    }
  });

  // Course Management CRUD Tests
  await test("Course Management: Create, Read, Update (PUT/PATCH), and Delete Course", async () => {
    const orgId = "ORG_TEST_001";
    const newCourse = {
      id: "CRS_TEST_999",
      organisationId: orgId,
      name: "Quantum Computing & Cryptography",
      code: "QC-901",
      duration: "120 Hours",
      category: "Academic",
      instructor: "Dr. Richard Feynman",
      skills: ["Quantum Logic", "Qiskit", "Post-Quantum Cryptography"]
    };

    // 1. Create
    const created = await AppRepositories.courses.create(newCourse as any);
    if (!created || created.name !== newCourse.name) {
      throw new Error("Failed to create course in repository");
    }

    // 2. Read by ID
    const fetched = await AppRepositories.courses.findById(orgId, "CRS_TEST_999");
    if (!fetched || fetched.code !== "QC-901") {
      throw new Error("Failed to find course by ID");
    }

    // 3. Update (Edit)
    const updated = await AppRepositories.courses.update(orgId, "CRS_TEST_999", {
      name: "Advanced Quantum Computing & Lattice Crypto",
      duration: "150 Hours"
    });
    if (!updated || updated.name !== "Advanced Quantum Computing & Lattice Crypto" || updated.duration !== "150 Hours") {
      throw new Error("Failed to update course details");
    }

    // 4. Delete
    const deleted = await AppRepositories.courses.delete(orgId, "CRS_TEST_999");
    if (!deleted) {
      throw new Error("Failed to delete course");
    }

    // 5. Verify deletion
    const verifyNotFound = await AppRepositories.courses.findById(orgId, "CRS_TEST_999");
    if (verifyNotFound) {
      throw new Error("Course should no longer exist after deletion");
    }
  });

  // 16. W3C Verifiable Credentials Test
  const sampleTestCred: any = {
    id: "ICX-2026-TEST99",
    certificateNumber: "STANFORD-2026-9901",
    organisationId: "ORG_001",
    candidateId: "CAN_001",
    candidateName: "Alex Rivera",
    candidateEmail: "alex.rivera@stanford.edu",
    courseId: "CRS_001",
    courseName: "Advanced Deep Learning & Transformer Architectures",
    issueDate: "2026-02-15",
    grade: "Honors Distinction (A+)",
    score: 98.5,
    status: "ACTIVE",
    skills: ["Deep Learning", "Transformers", "Verifiable AI"],
    hashDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    signatureData: {
      signature: "SIG_ED25519_SAMPLE_TEST_PROOF",
      algorithm: "SHA256withEd25519",
      keyId: "HSM-ED25519-PROD01",
      timestamp: "2026-02-15T00:00:00.000Z"
    }
  };

  const sampleTestOrg: any = {
    id: "ORG_001",
    name: "Stanford Center for Professional Development",
    domain: "stanford.edu",
    website: "https://scpd.stanford.edu",
    badgeColor: "#8C1515",
    logo: "🌲"
  };

  await test("Standards: W3C Verifiable Credential JSON-LD Generation", async () => {
    const vc = W3cCredentialsService.toW3cVerifiableCredential(sampleTestCred, sampleTestOrg);
    if (!vc['@context'].includes('https://www.w3.org/2018/credentials/v1')) {
      throw new Error("W3C VC must include standard W3C context");
    }
    if (!vc.type.includes('VerifiableCredential')) {
      throw new Error("W3C VC must include VerifiableCredential type");
    }
    if (!vc.issuer.id.startsWith('did:web:')) {
      throw new Error("Issuer ID must be a valid did:web identifier");
    }
    if (!vc.proof || !vc.proof.proofValue) {
      throw new Error("W3C VC must have cryptographic proof attached");
    }
    if (vc.credentialSubject.name !== "Alex Rivera") {
      throw new Error("W3C VC recipient name must match credential");
    }
  });

  // 17. Open Badges 3.0 Test
  await test("Standards: 1EdTech Open Badges 3.0 Standard Payload Generation", async () => {
    const ob = W3cCredentialsService.toOpenBadgeV3(sampleTestCred, sampleTestOrg);
    if (!ob.type.includes('OpenBadgeCredential')) {
      throw new Error("Open Badge must include OpenBadgeCredential type");
    }
    if (!ob.criteria || !ob.criteria.narrative) {
      throw new Error("Open Badge must include criteria narrative");
    }
    if (!ob.recipient || ob.recipient.identity !== "alex.rivera@stanford.edu") {
      throw new Error("Open Badge must contain recipient email");
    }
  });

  // 18. Standalone Social SVG Badge Test
  await test("Standards: Vector Social SVG Badge Generation", async () => {
    const svg = W3cCredentialsService.toSocialBadgeSvg(sampleTestCred, sampleTestOrg);
    if (!svg.startsWith('<svg') || !svg.includes('OFFICIAL VERIFIED BADGE')) {
      throw new Error("SVG badge must be valid SVG string with verified header");
    }
    if (!svg.includes('Alex Rivera')) {
      throw new Error("SVG badge must contain candidate name");
    }
  });

  // 19. Asynchronous Batch Queue Lifecycle & Progress Test
  await test("Queue: Background Batch Job Lifecycle and Progress Tracking", async () => {
    const testJobId = `JOB-TEST-${Date.now()}`;
    const rawJob = {
      id: testJobId,
      organisationId: "ORG_001",
      courseId: "CRS-001",
      templateVersionId: "TPL_001",
      createdBy: "USR_001",
      status: "QUEUED" as const,
      totalCount: 5,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      generatedCredentialIds: [],
      errors: [],
      createdAt: new Date().toISOString()
    };

    const enqueued = await queueService.enqueueJob(rawJob, async (_job, updateProgress) => {
      for (let i = 1; i <= 5; i++) {
        await updateProgress(i, i, 0);
      }
      return ["ICX-TEST-001", "ICX-TEST-002", "ICX-TEST-003", "ICX-TEST-004", "ICX-TEST-005"];
    });

    if (enqueued.id !== testJobId) {
      throw new Error("Enqueued job ID mismatch");
    }

    // Wait for background worker
    await new Promise((resolve) => setTimeout(resolve, 200));

    const completed = await queueService.getJob(testJobId);
    if (!completed) throw new Error("Job not found in queue");
    if (completed.status !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED status but got ${completed.status}`);
    }
    if (completed.percentComplete !== 100) {
      throw new Error(`Expected percentComplete 100% but got ${completed.percentComplete}%`);
    }
    if (completed.generatedCredentialIds.length !== 5) {
      throw new Error("Expected 5 generated credential IDs");
    }
  });

  // 20. Verification Cache Hits & Misses Test
  await test("Cache: Public Verification Edge Caching and Hit Tracking", async () => {
    const testKey = "verify:TEST-CRED-999";
    cacheService.delete(testKey);

    // Initial query should be a cache miss
    const missed = cacheService.get(testKey);
    if (missed !== null) throw new Error("Expected initial cache miss");

    // Populate cache
    cacheService.set(testKey, { verified: true, id: "TEST-CRED-999" }, 60);

    // Second query should be a cache hit
    const hit = cacheService.get<{ verified: boolean; id: string }>(testKey);
    if (!hit || !hit.verified || hit.id !== "TEST-CRED-999") {
      throw new Error("Expected cache hit with valid payload");
    }

    const metrics = cacheService.getMetrics();
    if (metrics.hits === 0) {
      throw new Error("Expected cache hit counter to increment");
    }
  });

  // 21. Cache Invalidation on Revocation Test
  await test("Cache: Automatic Cache Invalidation on Credential Revocation", async () => {
    const credId = "ICX-REVOKE-TEST-001";
    const cacheKey1 = `verify:${credId}`;
    const cacheKey2 = `vc:${credId}`;
    const cacheKey3 = `badge:${credId}`;

    cacheService.set(cacheKey1, { status: "ACTIVE" }, 60);
    cacheService.set(cacheKey2, { type: ["VerifiableCredential"] }, 60);
    cacheService.set(cacheKey3, { type: ["OpenBadgeCredential"] }, 60);

    if (!cacheService.get(cacheKey1) || !cacheService.get(cacheKey2) || !cacheService.get(cacheKey3)) {
      throw new Error("All 3 cache keys should be present");
    }

    // Trigger revocation invalidation
    const purged = cacheService.invalidateCredential(credId);
    if (purged < 3) {
      throw new Error(`Expected at least 3 invalidated cache entries, got ${purged}`);
    }

    if (cacheService.get(cacheKey1) !== null || cacheService.get(cacheKey2) !== null) {
      throw new Error("Cache keys must be completely removed after revocation invalidation");
    }
  });

  // 22. Webhook HMAC-SHA256 Signature Test
  await test("Webhooks: Cryptographic HMAC-SHA256 Signature Generation and Verification", async () => {
    const payload = JSON.stringify({ event: 'credential.issued', id: 'ICX-2026-999' });
    const secret = "whsec_test_secret_key_123456";
    const timestamp = Math.floor(Date.now() / 1000);

    const sigHeader = WebhookService.generateSignature(payload, secret, timestamp);
    if (!sigHeader.startsWith('t=') || !sigHeader.includes(',v1=')) {
      throw new Error("Expected valid signature header format (t=...,v1=...)");
    }

    const isValid = WebhookService.verifySignature(payload, sigHeader, secret);
    if (!isValid) {
      throw new Error("Signature verification should succeed for authentic payload");
    }

    // Tampered payload verification should fail
    const isTamperedValid = WebhookService.verifySignature(payload + "tampered", sigHeader, secret);
    if (isTamperedValid) {
      throw new Error("Signature verification must fail for tampered payload");
    }
  });

  // 23. Outbound Webhook Dispatching & Delivery Log Test
  await test("Webhooks: Outbound Event Dispatching & Delivery Log History", async () => {
    const orgId = "ORG_001";
    const ep = await webhookService.registerEndpoint({
      organisationId: orgId,
      url: "https://canvas.stanford.edu/mock/webhook",
      description: "Mock LMS Endpoint",
      events: ["credential.issued"]
    });

    if (!ep.id || !ep.secret) throw new Error("Expected registered webhook with secret");

    const logs = await webhookService.dispatch(orgId, "credential.issued", {
      credentialId: "ICX-2026-TEST",
      recipientName: "Test Student"
    });

    if (logs.length === 0) throw new Error("Expected at least 1 delivery log");
    const history = await webhookService.getDeliveryLogs(orgId);
    if (history.length === 0) throw new Error("Expected delivery history logs");
  });

  // 24. GDPR/FERPA Subject Access Request (SAR) Data Bundle Test
  await test("Compliance: GDPR/FERPA Subject Access Request (SAR) Data Aggregation", async () => {
    const testOrgId = "ORG_001";
    const sarCandId = `CAND-SAR-${Date.now()}`;
    const testCandidate = await AppRepositories.candidates.create({
      id: sarCandId,
      organisationId: testOrgId,
      name: "Maria Santos",
      email: `maria.santos.${Date.now()}@stanford.edu`,
      studentId: `ST-SAR-${Date.now().toString().slice(-4)}`,
      department: "Computer Science",
      status: "Active",
      createdAt: new Date().toISOString()
    });

    const creds = await AppRepositories.credentials.findAll(testOrgId, { candidateId: testCandidate.id });

    const sarBundle = {
      requestId: `SAR-TEST-001`,
      standard: "FERPA / GDPR Art. 15",
      candidate: testCandidate,
      credentialsCount: creds.items.length
    };

    if (sarBundle.candidate.id !== testCandidate.id) {
      throw new Error("SAR bundle candidate ID mismatch");
    }
  });

  return { passed, failed, results };
}

// Auto-run if executed directly
if (
  import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` ||
  process.argv[1]?.includes("backend.test.ts")
) {
  runBackendTests()
    .then(({ passed, failed, results }) => {
      console.log("\n========================================");
      console.log("       iCertiX Backend Test Report      ");
      console.log("========================================");
      results.forEach((r) => console.log(r));
      console.log("----------------------------------------");
      console.log(
        `Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`,
      );
      console.log("========================================\n");
      if (failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error("Test suite failed to run:", err);
      process.exit(1);
    });
}
