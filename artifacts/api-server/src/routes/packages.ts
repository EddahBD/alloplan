import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicePackagesTable,
  servicesTable,
  vendorProfilesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

function formatPackage(pkg: typeof servicePackagesTable.$inferSelect) {
  let inclusions: string[] = [];
  try {
    inclusions = JSON.parse(pkg.inclusions ?? "[]");
  } catch {}
  return {
    id: pkg.id,
    serviceId: pkg.serviceId,
    name: pkg.name,
    description: pkg.description,
    price: parseFloat(pkg.price),
    inclusions,
    durationHours: pkg.durationHours,
    isActive: pkg.isActive ?? true,
    createdAt: pkg.createdAt.toISOString(),
  };
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── GET /packages/:id ────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const packageId = parseInt(req.params.id as string);

    const [pkg] = await db
      .select()
      .from(servicePackagesTable)
      .where(eq(servicePackagesTable.id, packageId))
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "NotFound", message: "Package not found" });
      return;
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, pkg.serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Parent service not found" });
      return;
    }

    const [vendorRow] = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(eq(vendorProfilesTable.id, service.vendorId))
      .limit(1);

    res.json({
      ...formatPackage(pkg),
      service: {
        id: service.id,
        vendorId: service.vendorId,
        name: service.name,
        description: service.description,
        category: service.category,
        basePrice: parseFloat(service.basePrice),
        isActive: service.isActive ?? true,
        images: parseJsonArray(service.images),
        packagesCount: 0,
        createdAt: service.createdAt.toISOString(),
      },
      vendor: vendorRow
        ? {
            id: vendorRow.profile.id,
            userId: vendorRow.profile.userId,
            businessName: vendorRow.profile.businessName,
            bio: vendorRow.profile.bio,
            businessType: vendorRow.profile.businessType,
            location: vendorRow.profile.location,
            rating: vendorRow.profile.rating ? parseFloat(vendorRow.profile.rating) : null,
            reviewCount: vendorRow.profile.reviewCount ?? 0,
            verified: vendorRow.profile.verified ?? false,
            subscriptionTier: vendorRow.profile.subscriptionTier ?? "basic",
            coverImage: vendorRow.profile.coverImage,
            isAvailable: vendorRow.profile.isAvailable ?? true,
            ownerName: vendorRow.ownerName,
            isFeatured:
              vendorRow.profile.subscriptionTier === "premium" ||
              vendorRow.profile.subscriptionTier === "pro",
            isTopRated:
              (vendorRow.profile.rating ? parseFloat(vendorRow.profile.rating) : 0) >= 4.5 &&
              (vendorRow.profile.reviewCount ?? 0) >= 5,
            minPrice: parseFloat(service.basePrice),
          }
        : null,
    });
  } catch (err) {
    console.error("Get package error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── PATCH /packages/:id ──────────────────────────────────────────────────────

router.patch("/:id", requireAccessToken, async (req, res) => {
  try {
    const packageId = parseInt(req.params.id as string);

    const [pkg] = await db
      .select()
      .from(servicePackagesTable)
      .where(eq(servicePackagesTable.id, packageId))
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "NotFound", message: "Package not found" });
      return;
    }

    const [service] = await db
      .select({ vendorId: servicesTable.vendorId })
      .from(servicesTable)
      .where(eq(servicesTable.id, pkg.serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Parent service not found" });
      return;
    }

    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, service.vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }

    const { name, description, price, inclusions, durationHours, isActive } = req.body;
    const updateFields: Partial<typeof servicePackagesTable.$inferInsert> = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (price !== undefined) updateFields.price = String(price);
    if (inclusions !== undefined) updateFields.inclusions = JSON.stringify(inclusions);
    if (durationHours !== undefined) updateFields.durationHours = durationHours;
    if (isActive !== undefined) updateFields.isActive = isActive;

    const [updated] = await db
      .update(servicePackagesTable)
      .set(updateFields)
      .where(eq(servicePackagesTable.id, packageId))
      .returning();

    res.json(formatPackage(updated!));
  } catch (err) {
    console.error("Update package error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── DELETE /packages/:id ─────────────────────────────────────────────────────

router.delete("/:id", requireAccessToken, async (req, res) => {
  try {
    const packageId = parseInt(req.params.id as string);

    const [pkg] = await db
      .select()
      .from(servicePackagesTable)
      .where(eq(servicePackagesTable.id, packageId))
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "NotFound", message: "Package not found" });
      return;
    }

    const [service] = await db
      .select({ vendorId: servicesTable.vendorId })
      .from(servicesTable)
      .where(eq(servicesTable.id, pkg.serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Parent service not found" });
      return;
    }

    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, service.vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }

    await db
      .update(servicePackagesTable)
      .set({ isActive: false })
      .where(eq(servicePackagesTable.id, packageId));

    res.json({ message: "Package deleted" });
  } catch (err) {
    console.error("Delete package error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

export default router;
