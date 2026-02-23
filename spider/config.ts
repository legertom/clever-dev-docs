export const BASE_URL = "https://dev.clever.com";

export const CONCURRENCY = 5;
export const REQUEST_DELAY_MS = 300;
export const MAX_CHUNK_TOKENS = 1500;
export const MIN_CHUNK_TOKENS = 100;

export const OUTPUT_DIR = "docs";
export const CHUNKS_DIR = "docs/chunks";
export const MANIFEST_FILE = "docs/manifest.json";

// All known doc page paths, organized by section.
// The spider will also discover linked pages it finds during crawling.
export const SEED_URLS: Record<string, string[]> = {
  "Getting Started": [
    "/docs/getting-started",
    "/docs/security",
    "/docs/integration-types",
  ],
  "What's New": [
    "/docs/new-in-api-v3",
    "/docs/api-v31",
    "/docs/migrating-to-api-30",
    "/docs/migrating-from-v2x-contacts-to-v3x-contacts",
    "/docs/contacts-migrations-concept-guide",
    "/docs/updating-to-use-tls-12-on-connect-to-clever-api",
  ],
  "LMS Connect (v3.1)": [
    "/docs/lms-connect-overview",
    "/docs/core-concepts",
    "/docs/api-reference",
    "/docs/lms-connect-beginners-guide",
    "/docs/lms-connect-lti-13-sso",
    "/docs/lti-13-sso-setup-and-end-user-behavior",
    "/docs/lms-connect-output-behavior",
    "/docs/submitting-schoology-submissions",
    "/docs/clever-lms-connect-grade-passback-api-error-responses",
  ],
  "APIs & Data Model": [
    "/docs/api-overview",
    "/docs/working-with-the-clever-api",
    "/docs/exploring-the-clever-api",
    "/docs/error-messages",
    "/docs/paging-and-limits",
    "/docs/data-model",
    "/docs/schema-1",
    "/docs/links",
    "/docs/districts",
    "/docs/schools",
    "/docs/terms",
    "/docs/courses",
    "/docs/resources",
    "/docs/sections",
    "/docs/users",
    "/docs/extension-fields",
    "/docs/libraries",
  ],
  "District Rostering (Secure Sync)": [
    "/docs/district-getting-started",
    "/docs/onboarding",
    "/docs/ss-design",
    "/docs/student-contacts",
    "/docs/data-changes",
    "/docs/data-model-quirks-and-supported-features-district-integrations",
    "/docs/sync-testing",
    "/docs/sync-troubleshooting",
    "/docs/events-api",
    "/docs/events-testing",
  ],
  "Attendance Data (v3.1)": [
    "/docs/attendance-data-how-does-it-work",
    "/docs/attendance-data-overview",
    "/docs/attendance-data-pagination",
  ],
  "Clever SSO": [
    "/docs/sso-overview",
    "/docs/getting-started-with-clever-sso",
    "/docs/district-sso",
    "/docs/setting-up-district-sso",
    "/docs/best-practices-edge-cases",
    "/docs/il-security",
    "/docs/multi-role-users-in-clever",
    "/docs/library-sso",
    "/docs/setting-up-library-sso-and-rostering",
    "/docs/clever-library-user-flow",
    "/docs/clever-library-rostering",
    "/docs/data-model-quirks-and-supported-features-classroom-integrations",
    "/docs/district-sso-vs-library-sso",
    "/docs/testing-your-sso-integration",
    "/docs/testing-district-sso",
    "/docs/testing-library",
    "/docs/clever-sso-assets",
  ],
  Certifications: [
    "/docs/certification-overview",
    "/docs/certification-types",
    "/docs/secure-sync-certification-guide",
    "/docs/district-sso-certification-guide",
    "/docs/library-certification-guide",
    "/docs/submit-for-certification",
    "/docs/going-live",
  ],
  "OAuth and OIDC": [
    "/docs/oauth-oidc-overview",
    "/docs/the-userinfo-endpoint",
    "/docs/migrating-to-oidc",
    "/docs/oauth-implementation",
    "/docs/oidc-implementation",
    "/docs/example-oauth-walkthrough",
  ],
  SAML: [
    "/docs/saml-overview",
    "/docs/saml-getting-started",
  ],
  Guides: [
    "/docs/moodle-sso-integration-guide",
  ],
  "Clever with iOS": [
    "/docs/ios",
    "/docs/il-native-ios",
    "/docs/liwc-ios-update",
  ],
};

// Flatten all seed URLs into a list with section metadata
export function getAllSeedUrls(): Array<{ path: string; section: string }> {
  const urls: Array<{ path: string; section: string }> = [];
  for (const [section, paths] of Object.entries(SEED_URLS)) {
    for (const path of paths) {
      urls.push({ path, section });
    }
  }
  return urls;
}
