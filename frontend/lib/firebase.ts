import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAH-JSDZbvhb2zZQRoi9S1IBNVno6Xz7Ic',
  authDomain: 'lynks-frontend.firebaseapp.com',
  projectId: 'lynks-frontend',
  storageBucket: 'lynks-frontend.firebasestorage.app',
  messagingSenderId: '671816729941',
  appId: '1:671816729941:web:69f5e1fbb195e21ea59bdc',
  measurementId: 'G-12DGNWN05V',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)
export default app
