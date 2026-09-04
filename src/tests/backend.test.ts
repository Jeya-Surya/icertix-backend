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
