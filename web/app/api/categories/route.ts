import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { CATEGORIES } from "@/lib/category-constants";

/**
 * GET /api/categories
 *
 * Returns list of categories that exist in the database (have at least one finalized message).
 * Fetches all finalized messages and extracts unique categories in memory.
 * This approach uses only the basic finalizedAt != null query, avoiding the need for
 * additional composite indexes for category counting.
 *
 * Response: { categories: string[] }
 */
export async function GET() {
  try {
    const messagesRef = adminDb.collection("messages");

    // Fetch all finalized messages
    // This uses only the existing finalizedAt != null query, which works without additional indexes
    const snapshot = await messagesRef.where("finalizedAt", "!=", null).get();

    // Extract unique categories in memory
    const categorySet = new Set<string>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const categories = data.categories;

      if (
        !categories ||
        !Array.isArray(categories) ||
        categories.length === 0
      ) {
        // Uncategorized message
        categorySet.add("uncategorized");
      } else {
        // Real categories
        for (const category of categories) {
          if (CATEGORIES.includes(category)) {
            categorySet.add(category);
          }
        }
      }
    });

    return NextResponse.json({ categories: Array.from(categorySet) });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
