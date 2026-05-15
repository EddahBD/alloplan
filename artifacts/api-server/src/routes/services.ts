import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicesTable,
  servicePackagesTable,
  vendorProfilesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc, count } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function enrichService(service: typeof servicesTable.$inferSelect) {
  const [pkgCount] = await db
    .select({ cnt: count() })
    .from(servicePackagesTable)
    .where(and(eq(servicePackagesTable.serviceId, service.id), eq(servicePackagesTable.isActive, true)));

  return {
    id: service.id,
    vendorId: service.vendorId,
    name: service.name,
    description: service.description,
    category: service.category,
    basePrice: parseFloat(service.basePrice),
    isActive: service.isActive ?? true,
    images: parseJsonArray(service.images),
    packagesCount: pkgCount?.cnt ?? 0,
    createdAt: service.createdAt.toISOString(),
  };
}

// ─── PATCH /services/:id ──────────────────────────────────────────────────────

router.patch("/:id", requireAccessToken, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id as string);

    const [service] = await db
      .select({ vendorId: servicesTable.vendorId })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Service not found" });
      return;
    }

    // Verify ownership via vendor profile
    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, service.vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }

    const { name, description, category, basePrice, images, isActive } = req.body;
    const updateFields: Partial<typeof servicesTable.$inferInsert> = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (category !== undefined) updateFields.category = String(category).toLowerCase();
    if (basePrice !== undefined) updateFields.basePrice = String(basePrice);
    if (images !== undefined) updateFields.images = JSON.stringify(images);
    if (isActive !== undefined) updateFields.isActive = isActive;
    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(servicesTable)
      .set(updateFields)
      .where(eq(servicesTable.id, serviceId))
      .returning();

    res.json(await enrichService(updated!));
  } catch (err) {
    console.error("Update service error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── DELETE /services/:id ─────────────────────────────────────────────────────

router.delete("/:id", requireAccessToken, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id as string);

    const [service] = await db
      .select({ vendorId: servicesTable.vendorId })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Service not found" });
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

    await db.update(servicesTable).set({ isActive: false }).where(eq(servicesTable.id, serviceId));
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error("Delete service error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /services/:id/packages ──────────────────────────────────────────────

router.get("/:id/packages", async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id as string);

    const packages = await db
      .select()
      .from(servicePackagesTable)
      .where(and(eq(servicePackagesTable.serviceId, serviceId), eq(servicePackagesTable.isActive, true)))
      .orderBy(asc(servicePackagesTable.price));

    res.json({ packages: packages.map(formatPackage) });
  } catch (err) {
    console.error("List packages error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── POST /services/:id/packages ─────────────────────────────────────────────

router.post("/:id/packages", requireAccessToken, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id as string);

    const [service] = await db
      .select({ vendorId: servicesTable.vendorId })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!service) {
      res.status(404).json({ error: "NotFound", message: "Service not found" });
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

    const { name, description, price, inclusions = [], durationHours } = req.body;

    if (!name || price === undefined) {
      res.status(400).json({ error: "Validation", message: "name and price are required" });
      return;
    }

    const [pkg] = await db
      .insert(servicePackagesTable)
      .values({
        serviceId,
        name,
        description,
        price: String(price),
        inclusions: JSON.stringify(inclusions),
        durationHours,
      })
      .returning();

    res.status(201).json(formatPackage(pkg!));
  } catch (err) {
    console.error("Create package error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

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

export default router;
