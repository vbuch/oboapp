import { adminAuth } from "@/lib/firebase-admin";

/**
 * Helper: Verify authentication token and extract user info
 * In MSW mode, bypasses Firebase verification and returns mock user
 */
export async function verifyAuthToken(authHeader: string | null): Promise<{
  userId: string;
  userEmail: string | null;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing auth token");
  }

  const token = authHeader.split("Bearer ")[1];

  // MSW Mode: Bypass Firebase verification (ONLY in development)
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_MSW === "true" &&
    token === "mock-id-token"
  ) {
    return {
      userId: "mock-user-123",
      userEmail: "dev@example.com",
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      userId: decodedToken.uid,
      userEmail: decodedToken.email || null,
    };
  } catch (error) {
    console.error("Error verifying auth token:", error);
    throw new Error("Invalid auth token");
  }
}
