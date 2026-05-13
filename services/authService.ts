//authService.ts

import { auth } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail 
} from "firebase/auth";

export const authService = {
  register: async (email: string, password: string, name?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(userCredential.user, { displayName: name });
    }
    return userCredential.user;
  },

  login: async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  logout: async () => {
    return await signOut(auth);
  },

  getCurrentUser: async () => {
    return auth.currentUser;
  },

  sendPasswordReset: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Password reset error:", error);
      throw new Error(error.message || "Failed to send password reset email.");
    }
  }
};