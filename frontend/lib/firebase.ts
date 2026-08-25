/* Firebase config — used when deploying to Firebase Hosting.
   Currently unused in app code; Supabase handles auth. */

let app: unknown = null

export async function initFirebase() {
  if (app || typeof window === "undefined") return app
  const { initializeApp } = await import("firebase/app")
  const firebaseConfig = {
    apiKey: "AIzaSyBHSs8jnX9Z4qcoBC10GAM1uC6RWFSU5H8",
    authDomain: "lynks-gen-ai.firebaseapp.com",
    projectId: "lynks-gen-ai",
    storageBucket: "lynks-gen-ai.firebasestorage.app",
    messagingSenderId: "843593216653",
    appId: "1:843593216653:web:f50507d52fa0c9d488e8c4",
    measurementId: "G-67D91L8XEN",
  }
  app = initializeApp(firebaseConfig)
  return app
}
