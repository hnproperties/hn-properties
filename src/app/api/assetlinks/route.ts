import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Digital Asset Links — the file Android checks to confirm an APK is allowed to
 * open this site without a browser address bar.
 *
 * Both installable apps are Trusted Web Activities: an Android shell whose whole
 * job is to open hnproperties.co.in full screen. Android will only drop the
 * address bar if this file names the app's package and the SHA-256 fingerprint of
 * the key it was signed with. Without it the APK still runs, but with a browser
 * bar across the top, which rather defeats the point.
 *
 * Each app needs *two* fingerprints, and missing the second is what leaves the
 * address bar in place on a Play install:
 *
 *   - the key the APK was signed with locally, used when sideloading
 *   - the key Google re-signs with under Play App Signing, used by every install
 *     from the Play Store
 *
 * They are different keys. An app verified for one is not verified for the other,
 * and Android falls back to a Custom Tab — the blue bar with the URL and a close
 * button — rather than running as a Trusted Web Activity.
 *
 * So each variable takes a comma-separated list. Set:
 *
 *   TWA_FINGERPRINT_APP   — marketplace app: "<upload key>,<Play signing key>"
 *   TWA_FINGERPRINT_CORE  — HN Core, same shape
 *
 * The Play signing key is under Play Console → Test and release → Setup →
 * App signing → "App signing key certificate" → SHA-256. Colons included.
 *
 * Missing values are skipped rather than emitted blank: a malformed entry causes a
 * verification failure that is considerably harder to diagnose than an absent one.
 */
const APPS = [
  { package: 'in.co.hnproperties.app', env: 'TWA_FINGERPRINT_APP' },
  { package: 'in.co.hnproperties.core', env: 'TWA_FINGERPRINT_CORE' },
];

export function GET() {
  const statements = APPS.flatMap((app) => {
    const raw = process.env[app.env];
    if (!raw) return [];

    // Split, trim and upper-case: Android matches these literally, and a stray
    // space or a lower-case hex digit is a failure that looks like no failure.
    const fingerprints = raw
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    if (!fingerprints.length) return [];

    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: app.package,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  });

  return NextResponse.json(statements, {
    headers: {
      'Content-Type': 'application/json',
      // Android caches this; a short window means a fingerprint correction is
      // picked up in minutes rather than after a redeploy nobody connects to it.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
