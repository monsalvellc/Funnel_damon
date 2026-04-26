import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let adminApp;

if (getApps().length > 0) {
  adminApp = getApps()[0];
} else {
  // 1. Extract the variables
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // 2. ONLY attempt to initialize with credentials if all three exist
  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // 3. If variables are missing (like during a local build), use a safe dummy setup
    console.warn('⚠️ Missing Firebase Admin environment variables. Using dummy init for build.');
    adminApp = initializeApp({ projectId: 'dummy-build-project' });
  }
}

export const adminDb = getFirestore(adminApp);
export { FieldValue };