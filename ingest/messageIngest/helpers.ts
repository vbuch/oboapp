import { adminAuth } from "@/lib/firebase-admin";

/**
 * Helper: Verify authentication token and extract user info
 */
export async function verifyAuthToken(authHeader: string | null): Promise<{
  userId: string;
  userEmail: string | null;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing auth token");
  }

  const token = authHeader.split("Bearer ")[1];

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

/**
 * Helper: Validate message text
 */
export function validateMessageText(text: unknown): void {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid message text");
  }

  if (text.length > 5000) {
    throw new Error("Message text is too long (max 5000 characters)");
  }
}
