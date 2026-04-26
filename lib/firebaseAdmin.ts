import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREBASE ADMIN — server-only singleton (bypasses Firestore security rules)
//
// Required environment variables (server-only, no NEXT_PUBLIC_ prefix):
//   FIREBASE_ADMIN_PROJECT_ID     — e.g. "roofingleadapp"
//   FIREBASE_ADMIN_CLIENT_EMAIL   — e.g. "firebase-adminsdk-xxx@roofingleadapp.iam.gserviceaccount.com"
//   FIREBASE_ADMIN_PRIVATE_KEY    — the private key from the service account JSON,
//                                   with literal \n characters (Next.js resolves them)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });

export const adminDb = getFirestore(adminApp);
export { FieldValue };
