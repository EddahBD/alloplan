import { Router } from "express";
import { db } from "@workspace/db";
import { portfolioItemsTable, vendorProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

// ─── DELETE /portfolio/:id ────────────────────────────────────────────────────

router.delete("/:id", requireAccessToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id as string);

    const [item] = await db
      .select()
      .from(portfolioItemsTable)
      .where(eq(portfolioItemsTable.id, itemId))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "NotFound", message: "Portfolio item not found" });
      return;
    }

    // Verify ownership
    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, item.vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }

    await db.delete(portfolioItemsTable).where(eq(portfolioItemsTable.id, itemId));
    res.json({ message: "Portfolio item deleted" });
  } catch (err) {
    console.error("Delete portfolio item error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

export default router;
