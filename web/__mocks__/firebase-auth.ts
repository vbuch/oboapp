import type { User } from "firebase/auth";

/**
 * Mock Firebase Auth user for MSW mode
 * Provides a pre-authenticated user state
 */
export const MOCK_USER: User = {
  uid: "mock-user-123",
  email: "dev@example.com",
  displayName: "Mock Developer",
  photoURL: "/logo.png",
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: "2026-01-15T10:00:00Z",
    lastSignInTime: new Date().toISOString(),
  },
  providerData: [
    {
      providerId: "google.com",
      uid: "mock-user-123",
      displayName: "Mock Developer",
      email: "dev@example.com",
      phoneNumber: null,
      photoURL: null,
    },
  ],
  refreshToken: "mock-refresh-token",
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => "mock-id-token",
  getIdTokenResult: async () => ({
    token: "mock-id-token",
    claims: {},
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
    signInProvider: "google.com",
    signInSecondFactor: null,
  }),
  reload: async () => {},
  toJSON: () => ({
    uid: "mock-user-123",
    email: "dev@example.com",
    displayName: "Mock Developer",
  }),
  phoneNumber: null,
  providerId: "firebase",
};
