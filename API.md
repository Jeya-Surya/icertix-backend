# iCertiX REST API Specification

All API responses follow a unified response envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Errors return HTTP 4xx/5xx codes with structured error payloads:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "REQ-7F8A91"
  }
}
```

---

## 1. Authentication (`/api/auth`)

| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | None | Authenticate with email and password |
| `GET` | `/api/auth/me` | Bearer Token | Get current authenticated user profile |
| `POST` | `/api/auth/logout` | Bearer Token | Terminate user session and record audit |

---

## 2. Platform Administration (`/api/platform`) — Super Admin & Platform Admin

| Method | Path | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/platform/metrics` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | Global KPIs and system health |
| `GET` | `/api/platform/organisations` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | List all platform tenant organisations |
| `POST` | `/api/platform/organisations` | `SUPER_ADMIN` | Create new tenant organisation |
| `POST` | `/api/platform/organisations/:id/activate` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | Activate organisation |
| `POST` | `/api/platform/organisations/:id/suspend` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | Suspend organisation |
| `GET` | `/api/platform/users` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | List all platform and tenant users |
| `POST` | `/api/platform/users` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | Create platform user |
| `GET` | `/api/platform/settings` | `SUPER_ADMIN`, `PLATFORM_ADMIN` | View platform settings |
| `PATCH` | `/api/platform/settings` | `SUPER_ADMIN` | Update platform settings |

---

## 3. Organisations (`/api/organisations`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/organisations` | Authenticated | List organisations accessible to current user |
| `GET` | `/api/organisations/me` | Authenticated | Get current tenant profile |
| `GET` | `/api/organisations/:id` | `ORG_ADMIN`, `SUPER_ADMIN` | Get organisation details |
| `PATCH` | `/api/organisations/:id` | `ORG_ADMIN`, `SUPER_ADMIN` | Update organisation profile/signatories |

---

## 4. User Management (`/api/users`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `ORG_ADMIN`, `SUPER_ADMIN` | List organisation users (paginated) |
| `POST` | `/api/users` | `ORG_ADMIN`, `SUPER_ADMIN` | Create new user |
| `POST` | `/api/users/:id/activate` | `ORG_ADMIN`, `SUPER_ADMIN` | Activate user |
| `POST` | `/api/users/:id/deactivate` | `ORG_ADMIN`, `SUPER_ADMIN` | Deactivate user |

---

## 5. Candidate Management (`/api/candidates`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/candidates` | `ORG_ADMIN`, `ORG_STAFF` | List candidate records with search & filters |
| `GET` | `/api/candidates/:id` | `ORG_ADMIN`, `ORG_STAFF` | Get single candidate details |
| `POST` | `/api/candidates` | `ORG_ADMIN`, `ORG_STAFF` | Add new candidate |
| `POST` | `/api/candidates/import` | `ORG_ADMIN`, `ORG_STAFF` | Bulk import candidates (JSON/CSV) |
| `PATCH` | `/api/candidates/:id` | `ORG_ADMIN`, `ORG_STAFF` | Update candidate |
| `DELETE` | `/api/candidates/:id` | `ORG_ADMIN` | Delete candidate |

---

## 6. Academic Departments & Courses (`/api/departments`, `/api/courses`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/departments` | Authenticated | List departments |
| `POST` | `/api/departments` | `ORG_ADMIN` | Create department |
| `GET` | `/api/courses` | Authenticated | List courses with categories & filters |
| `GET` | `/api/courses/:id` | Authenticated | Get course details |
| `POST` | `/api/courses` | `ORG_ADMIN` | Create course |
| `PATCH` | `/api/courses/:id` | `ORG_ADMIN` | Update course |
| `DELETE` | `/api/courses/:id` | `ORG_ADMIN` | Delete course |

---

## 7. Certificate Templates & Versions (`/api/templates`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/templates` | Authenticated | List certificate templates |
| `GET` | `/api/templates/:id` | Authenticated | Get template and active Canva schema |
| `POST` | `/api/templates` | `ORG_ADMIN`, `ORG_STAFF` | Create template |
| `PATCH` | `/api/templates/:id` | `ORG_ADMIN`, `ORG_STAFF` | Save template working draft |
| `GET` | `/api/templates/:id/versions` | Authenticated | Get immutable version history |
| `POST` | `/api/templates/:id/versions` | `ORG_ADMIN`, `ORG_STAFF` | Publish immutable new version |
| `POST` | `/api/templates/:id/duplicate` | `ORG_ADMIN`, `ORG_STAFF` | Duplicate template |
| `DELETE` | `/api/templates/:id` | `ORG_ADMIN` | Delete template |

---

## 8. Certificate Generation & Issuance (`/api/certificates`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/certificates` | Authenticated | List issued certificate records |
| `GET` | `/api/certificates/:id` | Authenticated | Get certificate artifact details |
| `GET` | `/api/certificates/:id/download` | Authenticated | Download Vector SVG / PDF artifact |
| `POST` | `/api/certificates/generate` | `ORG_ADMIN`, `ORG_STAFF` | Batch generate & digitally sign certificates |
| `GET` | `/api/certificates/jobs/:jobId` | Authenticated | Check batch generation job status |

---

## 9. Credential Registry & Revocation (`/api/credentials`)

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/credentials` | Authenticated | Search & filter authoritative credentials |
| `GET` | `/api/credentials/:id` | Authenticated | Get credential details |
| `POST` | `/api/credentials/:id/revoke` | `ORG_ADMIN`, `SUPER_ADMIN` | Revoke credential with reason |

---

## 10. Public Verification (`/api/public/verify`)

| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public/verify/:credentialId` | **None (Public)** | 7-point cryptographic verification check |

---

## 11. Audit Trail, Emails & Subscriptions

| Method | Path | Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | `AUDITOR`, `ORG_ADMIN`, `SUPER_ADMIN` | View immutable audit logs |
| `GET` | `/api/emails` | `ORG_ADMIN`, `ORG_STAFF`, `SUPER_ADMIN` | View email delivery logs |
| `POST` | `/api/emails/:id/retry` | `ORG_ADMIN`, `ORG_STAFF` | Retry failed email dispatch |
| `GET` | `/api/reports/summary` | Authenticated | Analytics KPIs and monthly issuance |
| `GET` | `/api/subscriptions/plans` | Authenticated | List subscription plans |
| `GET` | `/api/subscriptions/usage` | Authenticated | Check tenant certificate quota usage |
