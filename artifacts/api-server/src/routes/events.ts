import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

function formatEvent(ev: typeof eventsTable.$inferSelect) {
  return {
    id: ev.id,
    userId: ev.userId,
    name: ev.name,
    type: ev.type,
    eventDate: ev.eventDate?.toISOString() ?? null,
    guestCount: ev.guestCount,
    location: ev.location,
    totalBudget: ev.totalBudget ? parseFloat(ev.totalBudget) : null,
    notes: ev.notes,
    status: ev.status,
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
  };
}

// ─── GET /events/my ───────────────────────────────────────────────────────────

router.get("/my", requireAccessToken, async (req, res) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.userId, req.user!.userId))
      .orderBy(desc(eventsTable.createdAt));

    res.json({ events: events.map(formatEvent) });
  } catch (err) {
    console.error("List events error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /events ─────────────────────────────────────────────────────────────

router.post("/", requireAccessToken, async (req, res) => {
  try {
    const { name, type, eventDate, guestCount, location, totalBudget, notes } =
      req.body as {
        name?: string;
        type?: string;
        eventDate?: string;
        guestCount?: number;
        location?: string;
        totalBudget?: number;
        notes?: string;
      };

    if (!name || !type) {
      res.status(400).json({ error: "name and type are required" });
      return;
    }

    const [event] = await db
      .insert(eventsTable)
      .values({
        userId: req.user!.userId,
        name,
        type,
        eventDate: eventDate ? new Date(eventDate) : null,
        guestCount: guestCount ?? null,
        location: location ?? null,
        totalBudget: totalBudget ? totalBudget.toFixed(2) : null,
        notes: notes ?? null,
        status: "planning",
      })
      .returning();

    res.status(201).json(formatEvent(event));
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /events/:id ──────────────────────────────────────────────────────────

router.get("/:id", requireAccessToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id as string);
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.id, eventId),
          eq(eventsTable.userId, req.user!.userId)
        )
      )
      .limit(1);

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json(formatEvent(event));
  } catch (err) {
    console.error("Get event error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /events/:id ──────────────────────────────────────────────────────────

router.put("/:id", requireAccessToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id as string);
    const { name, type, eventDate, guestCount, location, totalBudget, notes, status } =
      req.body as {
        name?: string;
        type?: string;
        eventDate?: string;
        guestCount?: number;
        location?: string;
        totalBudget?: number;
        notes?: string;
        status?: string;
      };

    const [existing] = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.id, eventId),
          eq(eventsTable.userId, req.user!.userId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const [updated] = await db
      .update(eventsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(eventDate !== undefined && { eventDate: eventDate ? new Date(eventDate) : null }),
        ...(guestCount !== undefined && { guestCount }),
        ...(location !== undefined && { location }),
        ...(totalBudget !== undefined && { totalBudget: totalBudget ? totalBudget.toFixed(2) : null }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(eq(eventsTable.id, eventId))
      .returning();

    res.json(formatEvent(updated));
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /events/:id ───────────────────────────────────────────────────────

router.delete("/:id", requireAccessToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id as string);

    const [existing] = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.id, eventId),
          eq(eventsTable.userId, req.user!.userId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
