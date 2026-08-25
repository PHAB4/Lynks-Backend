import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"

const firebaseConfig = {
  apiKey: "AIzaSyBHSs8jnX9Z4qcoBC10GAM1uC6RWFSU5H8",
  authDomain: "lynks-gen-ai.firebaseapp.com",
  projectId: "lynks-gen-ai",
  storageBucket: "lynks-gen-ai.firebasestorage.app",
  messagingSenderId: "843593216653",
  appId: "1:843593216653:web:f50507d52fa0c9d488e8c4",
  measurementId: "G-67D91L8XEN",
}

const app = initializeApp(firebaseConfig)
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null
export default app
