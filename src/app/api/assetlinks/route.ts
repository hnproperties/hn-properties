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
 * Fingerprints come from the environment because they are a property of the
 * signing keys, not of this codebase, and they differ between the key used locally
 * and the one Google Play re-signs with. Set:
 *
 *   TWA_FINGERPRINT_APP   — for the marketplace app
 *   TWA_FINGERPRINT_CORE  — for HN Core
 *
 * Both are the "SHA-256 certificate fingerprint" shown under Play Console →
 * Release → Setup → App signing. Colons included, uppercase hex.
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
    const fingerprint = process.env[app.env];
    if (!fingerprint) return [];
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: app.package,
          sha256_cert_fingerprints: [fingerprint],
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
