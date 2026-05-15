import { Router } from "express";
import { db } from "@workspace/db";
import {
  vendorProfilesTable,
  usersTable,
  servicesTable,
  servicePackagesTable,
  portfolioItemsTable,
  reviewsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, like, or, desc, asc, sql, count } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function buildVendorCard(profile: typeof vendorProfilesTable.$inferSelect & { ownerName: string; ownerProfileImage: string | null }) {
  const minPriceRow = await db
    .select({ minPrice: sql<string>`MIN(${servicesTable.basePrice})` })
    .from(servicesTable)
    .where(and(eq(servicesTable.vendorId, profile.id), eq(servicesTable.isActive, true)));

  const minPrice = minPriceRow[0]?.minPrice ? parseFloat(minPriceRow[0].minPrice) : null;

  return {
    id: profile.id,
    userId: profile.userId,
    businessName: profile.businessName,
    bio: profile.bio,
    businessType: profile.businessType,
    location: profile.location,
    rating: profile.rating ? parseFloat(profile.rating) : null,
    reviewCount: profile.reviewCount ?? 0,
    verified: profile.verified ?? false,
    subscriptionTier: profile.subscriptionTier ?? "basic",
    coverImage: profile.coverImage,
    isAvailable: profile.isAvailable ?? true,
    ownerName: profile.ownerName,
    isFeatured: profile.subscriptionTier === "premium" || profile.subscriptionTier === "pro",
    isTopRated: (profile.rating ? parseFloat(profile.rating) : 0) >= 4.5 && (profile.reviewCount ?? 0) >= 5,
    minPrice,
  };
}

// ─── GET /vendors ─────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const {
      q,
      category,
      location,
      minPrice,
      maxPrice,
      minRating,
      available,
      sortBy = "relevance",
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions = [];

    if (available === "true") {
      conditions.push(eq(vendorProfilesTable.isAvailable, true));
    }

    if (minRating) {
      conditions.push(gte(vendorProfilesTable.rating, minRating));
    }

    if (location) {
      conditions.push(like(vendorProfilesTable.location, `%${location}%`));
    }

    // Category filter via services
    let vendorIdsFromCategory: number[] = [];
    if (category && category !== "all") {
      const rows = await db
        .selectDistinct({ vendorId: servicesTable.vendorId })
        .from(servicesTable)
        .where(and(eq(servicesTable.category, category), eq(servicesTable.isActive, true)));
      vendorIdsFromCategory = rows.map((r) => r.vendorId);
      if (vendorIdsFromCategory.length === 0) {
        res.json({ vendors: [], total: 0, page: pageNum, limit: limitNum, hasMore: false });
        return;
      }
    }

    // Price filter via services
    let vendorIdsFromPrice: number[] = [];
    if (minPrice || maxPrice) {
      const priceRows = await db
        .selectDistinct({ vendorId: servicesTable.vendorId })
        .from(servicesTable)
        .where(
          and(
            minPrice ? gte(servicesTable.basePrice, minPrice) : undefined,
            maxPrice ? lte(servicesTable.basePrice, maxPrice) : undefined,
            eq(servicesTable.isActive, true)
          )
        );
      vendorIdsFromPrice = priceRows.map((r) => r.vendorId);
      // No vendors satisfy the price criteria → return empty immediately
      if (vendorIdsFromPrice.length === 0) {
        res.json({ vendors: [], total: 0, page: pageNum, limit: limitNum, hasMore: false });
        return;
      }
    }

    // Text search
    if (q) {
      conditions.push(
        or(
          like(vendorProfilesTable.businessName, `%${q}%`),
          like(vendorProfilesTable.bio, `%${q}%`),
          like(vendorProfilesTable.businessType, `%${q}%`),
          like(vendorProfilesTable.location, `%${q}%`)
        )
      );
    }

    const allProfiles = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Filter by vendorIds from category/price
    let filtered = allProfiles;
    if (vendorIdsFromCategory.length > 0) {
      filtered = filtered.filter((r) => vendorIdsFromCategory.includes(r.profile.id));
    }
    if (vendorIdsFromPrice.length > 0) {
      filtered = filtered.filter((r) => vendorIdsFromPrice.includes(r.profile.id));
    }

    // Tier weight: premium=2, pro=1, basic=0
    const tierWeight = (tier: string | null): number =>
      tier === "premium" ? 2 : tier === "pro" ? 1 : 0;

    // For rating/newest/relevance: sort before pagination (no enrichment needed)
    if (sortBy === "relevance") {
      // Default ranking: tier first (premium > pro > basic), then by rating within tier
      filtered.sort((a, b) => {
        const tierDiff = tierWeight(b.profile.subscriptionTier) - tierWeight(a.profile.subscriptionTier);
        if (tierDiff !== 0) return tierDiff;
        return parseFloat(b.profile.rating ?? "0") - parseFloat(a.profile.rating ?? "0");
      });
    } else if (sortBy === "rating") {
      // Explicit rating sort: rating primary, tier as tiebreaker
      filtered.sort((a, b) => {
        const ratingDiff = parseFloat(b.profile.rating ?? "0") - parseFloat(a.profile.rating ?? "0");
        if (ratingDiff !== 0) return ratingDiff;
        return tierWeight(b.profile.subscriptionTier) - tierWeight(a.profile.subscriptionTier);
      });
    } else if (sortBy === "newest") {
      filtered.sort((a, b) => b.profile.createdAt.getTime() - a.profile.createdAt.getTime());
    }

    const total = filtered.length;

    let vendors: Awaited<ReturnType<typeof buildVendorCard>>[];

    if (sortBy === "price_asc" || sortBy === "price_desc") {
      // Price sort requires enrichment (minPrice query per vendor).
      // Enrich all filtered results first, then sort globally, then paginate.
      const allEnriched = await Promise.all(
        filtered.map((r) => buildVendorCard({ ...r.profile, ownerName: r.ownerName, ownerProfileImage: r.ownerProfileImage }))
      );
      if (sortBy === "price_asc") {
        allEnriched.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
      } else {
        allEnriched.sort((a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0));
      }
      vendors = allEnriched.slice(offset, offset + limitNum);
    } else {
      const paged = filtered.slice(offset, offset + limitNum);
      vendors = await Promise.all(
        paged.map((r) => buildVendorCard({ ...r.profile, ownerName: r.ownerName, ownerProfileImage: r.ownerProfileImage }))
      );
    }

    res.json({ vendors, total, page: pageNum, limit: limitNum, hasMore: offset + limitNum < total });
  } catch (err) {
    console.error("List vendors error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/trending ────────────────────────────────────────────────────

router.get("/trending", async (req, res) => {
  try {
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);

    const profiles = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(eq(vendorProfilesTable.isAvailable, true))
      .orderBy(desc(vendorProfilesTable.reviewCount), desc(vendorProfilesTable.rating))
      .limit(limit);

    const vendors = await Promise.all(
      profiles.map((r) => buildVendorCard({ ...r.profile, ownerName: r.ownerName, ownerProfileImage: r.ownerProfileImage }))
    );

    res.json({ vendors });
  } catch (err) {
    console.error("Trending vendors error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/featured ────────────────────────────────────────────────────

router.get("/featured", async (req, res) => {
  try {
    const limit = Math.min(20, parseInt(req.query.limit as string) || 6);

    const profiles = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(
        and(
          eq(vendorProfilesTable.isAvailable, true),
          or(
            eq(vendorProfilesTable.subscriptionTier, "premium"),
            eq(vendorProfilesTable.subscriptionTier, "pro")
          )
        )
      )
      .orderBy(desc(vendorProfilesTable.rating))
      .limit(limit);

    const vendors = await Promise.all(
      profiles.map((r) => buildVendorCard({ ...r.profile, ownerName: r.ownerName, ownerProfileImage: r.ownerProfileImage }))
    );

    res.json({ vendors });
  } catch (err) {
    console.error("Featured vendors error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/my-profile ──────────────────────────────────────────────────

router.get("/my-profile", requireAccessToken, async (req, res) => {
  try {
    const [row] = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(eq(vendorProfilesTable.userId, req.user!.userId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "NotFound", message: "Vendor profile not found" });
      return;
    }

    const profile = await buildFullProfile(row.profile, row.ownerName, row.ownerProfileImage);
    res.json(profile);
  } catch (err) {
    console.error("My vendor profile error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── PUT /vendors/my-profile ──────────────────────────────────────────────────

router.put("/my-profile", requireAccessToken, async (req, res) => {
  try {
    const { businessName, bio, businessType, location, coverImage, responseTime } = req.body;

    const [existing] = await db
      .select({ id: vendorProfilesTable.id })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.userId, req.user!.userId))
      .limit(1);

    let profile: typeof vendorProfilesTable.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(vendorProfilesTable)
        .set({ businessName, bio, businessType, location, coverImage, responseTime, updatedAt: new Date() })
        .where(eq(vendorProfilesTable.userId, req.user!.userId))
        .returning();
      profile = updated!;
    } else {
      const [created] = await db
        .insert(vendorProfilesTable)
        .values({ userId: req.user!.userId, businessName, bio, businessType, location, coverImage, responseTime })
        .returning();
      profile = created!;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const full = await buildFullProfile(profile, user!.name, user!.profileImage);
    res.json(full);
  } catch (err) {
    console.error("Upsert vendor profile error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/:id ─────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);
    if (isNaN(vendorId)) {
      res.status(400).json({ error: "Validation", message: "Invalid vendor ID" });
      return;
    }

    const [row] = await db
      .select({
        profile: vendorProfilesTable,
        ownerName: usersTable.name,
        ownerProfileImage: usersTable.profileImage,
      })
      .from(vendorProfilesTable)
      .innerJoin(usersTable, eq(vendorProfilesTable.userId, usersTable.id))
      .where(eq(vendorProfilesTable.id, vendorId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "NotFound", message: "Vendor not found" });
      return;
    }

    const profile = await buildFullProfile(row.profile, row.ownerName, row.ownerProfileImage);
    res.json(profile);
  } catch (err) {
    console.error("Get vendor error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── PATCH /vendors/:id/availability ─────────────────────────────────────────

router.patch("/:id/availability", requireAccessToken, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);
    const { isAvailable } = req.body;

    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ error: "Validation", message: "isAvailable must be boolean" });
      return;
    }

    // Verify ownership
    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not your vendor profile" });
      return;
    }

    await db
      .update(vendorProfilesTable)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(vendorProfilesTable.id, vendorId));

    res.json({ isAvailable });
  } catch (err) {
    console.error("Toggle availability error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/:id/services ────────────────────────────────────────────────

router.get("/:id/services", async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);
    const services = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.vendorId, vendorId), eq(servicesTable.isActive, true)))
      .orderBy(asc(servicesTable.createdAt));

    const enriched = await Promise.all(services.map(enrichService));
    res.json({ services: enriched });
  } catch (err) {
    console.error("List services error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── POST /vendors/:id/services ──────────────────────────────────────────────

router.post("/:id/services", requireAccessToken, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);

    // Verify ownership
    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not your vendor profile" });
      return;
    }

    const { name, description, category, basePrice, images = [] } = req.body;

    if (!name || !category || basePrice === undefined) {
      res.status(400).json({ error: "Validation", message: "name, category, and basePrice are required" });
      return;
    }

    // Normalize category to lowercase canonical form matching marketplace filters
    const normalizedCategory = String(category).toLowerCase();

    const [service] = await db
      .insert(servicesTable)
      .values({
        vendorId,
        name,
        description,
        category: normalizedCategory,
        basePrice: String(basePrice),
        images: JSON.stringify(images),
      })
      .returning();

    res.status(201).json(await enrichService(service!));
  } catch (err) {
    console.error("Create service error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── GET /vendors/:id/portfolio ───────────────────────────────────────────────

router.get("/:id/portfolio", async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);
    const items = await db
      .select()
      .from(portfolioItemsTable)
      .where(eq(portfolioItemsTable.vendorId, vendorId))
      .orderBy(asc(portfolioItemsTable.sortOrder), desc(portfolioItemsTable.createdAt));

    res.json({ items });
  } catch (err) {
    console.error("List portfolio error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── POST /vendors/:id/portfolio ─────────────────────────────────────────────

router.post("/:id/portfolio", requireAccessToken, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id as string);

    // Verify ownership
    const [vendor] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, vendorId))
      .limit(1);

    if (!vendor || vendor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Not your vendor profile" });
      return;
    }

    const { imageUrl, caption, eventType, sortOrder = 0 } = req.body;

    if (!imageUrl) {
      res.status(400).json({ error: "Validation", message: "imageUrl is required" });
      return;
    }

    const [item] = await db
      .insert(portfolioItemsTable)
      .values({ vendorId, imageUrl, caption, eventType, sortOrder })
      .returning();

    res.status(201).json(item!);
  } catch (err) {
    console.error("Add portfolio item error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// ─── Helper: buildFullProfile ─────────────────────────────────────────────────

async function buildFullProfile(
  profile: typeof vendorProfilesTable.$inferSelect,
  ownerName: string,
  ownerProfileImage: string | null
) {
  const [servicesRows, portfolioRows, reviewsRows] = await Promise.all([
    db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.vendorId, profile.id), eq(servicesTable.isActive, true)))
      .orderBy(asc(servicesTable.createdAt)),
    db
      .select()
      .from(portfolioItemsTable)
      .where(eq(portfolioItemsTable.vendorId, profile.id))
      .orderBy(asc(portfolioItemsTable.sortOrder))
      .limit(20),
    db
      .select({ review: reviewsTable, reviewerName: usersTable.name })
      .from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.reviewerId, usersTable.id))
      .where(eq(reviewsTable.vendorId, profile.id))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(5),
  ]);

  const services = await Promise.all(servicesRows.map(enrichService));

  return {
    id: profile.id,
    userId: profile.userId,
    businessName: profile.businessName,
    bio: profile.bio,
    businessType: profile.businessType,
    location: profile.location,
    rating: profile.rating ? parseFloat(profile.rating) : null,
    reviewCount: profile.reviewCount ?? 0,
    verified: profile.verified ?? false,
    subscriptionTier: profile.subscriptionTier ?? "basic",
    coverImage: profile.coverImage,
    responseTime: profile.responseTime,
    isAvailable: profile.isAvailable ?? true,
    ownerName,
    ownerProfileImage,
    isFeatured: profile.subscriptionTier === "premium" || profile.subscriptionTier === "pro",
    isTopRated:
      (profile.rating ? parseFloat(profile.rating) : 0) >= 4.5 &&
      (profile.reviewCount ?? 0) >= 5,
    services,
    portfolio: portfolioRows,
    recentReviews: reviewsRows.map((r) => ({
      id: r.review.id,
      rating: r.review.rating,
      comment: r.review.comment,
      reviewerName: r.reviewerName,
      createdAt: r.review.createdAt.toISOString(),
    })),
    createdAt: profile.createdAt.toISOString(),
  };
}

// ─── Helper: enrichService ─────────────────────────────────────────────────────

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

export default router;
