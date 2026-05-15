import { Router } from "express";
import { db } from "@workspace/db";
import {
  bookingsTable,
  walletAccountsTable,
  walletTransactionsTable,
  notificationsTable,
  vendorProfilesTable,
  servicesTable,
  servicePackagesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

const PLATFORM_FEE_RATE = 0.05; // 5%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingRef(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let ref = "BK-";
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

async function getOrCreateWallet(userId: number) {
  const [existing] = await db
    .select()
    .from(walletAccountsTable)
    .where(eq(walletAccountsTable.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(walletAccountsTable)
    .values({ userId, balance: "0", pendingBalance: "0", totalEarned: "0", totalWithdrawn: "0" })
    .returning();
  return created;
}

async function createNotification(
  userId: number,
  title: string,
  body: string,
  type: string,
  data?: object
) {
  try {
    await db.insert(notificationsTable).values({
      userId,
      title,
      body,
      type,
      data: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    // Non-critical — log but don't fail the request
  }
}

function formatBooking(booking: typeof bookingsTable.$inferSelect & {
  customerName?: string;
  vendorName?: string;
  serviceName?: string;
  packageName?: string;
}) {
  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    eventId: booking.eventId,
    customerId: booking.customerId,
    vendorId: booking.vendorId,
    serviceId: booking.serviceId,
    packageId: booking.packageId,
    status: booking.status,
    totalAmount: parseFloat(booking.totalAmount),
    platformFee: booking.platformFee ? parseFloat(booking.platformFee) : null,
    vendorAmount: booking.vendorAmount ? parseFloat(booking.vendorAmount) : null,
    escrowStatus: booking.escrowStatus,
    eventDate: booking.eventDate?.toISOString() ?? null,
    eventLocation: booking.eventLocation,
    notes: booking.notes,
    cancellationReason: booking.cancellationReason,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    customerName: booking.customerName,
    vendorName: booking.vendorName,
    serviceName: booking.serviceName,
    packageName: booking.packageName,
  };
}

// ─── GET /bookings/fee-estimate ───────────────────────────────────────────────

router.get("/fee-estimate", requireAccessToken, async (req, res) => {
  const amount = parseFloat(req.query.amount as string);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const platformFee = amount * PLATFORM_FEE_RATE;
  const vendorAmount = amount - platformFee;
  res.json({ amount, platformFee, vendorAmount, feeRate: PLATFORM_FEE_RATE });
});

// ─── GET /bookings/my ─────────────────────────────────────────────────────────

router.get("/my", requireAccessToken, async (req, res) => {
  try {
    const { statusGroup } = req.query as { statusGroup?: string };
    const customerId = req.user!.userId;

    const statusFilters = (() => {
      if (statusGroup === "upcoming")
        return ["pending", "confirmed", "in_progress"] as const;
      if (statusGroup === "completed") return ["completed"] as const;
      if (statusGroup === "cancelled") return ["cancelled"] as const;
      return undefined;
    })();

    const rows = await db
      .select({
        booking: bookingsTable,
        customerName: usersTable.name,
        vendorProfile: vendorProfilesTable,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(usersTable.id, bookingsTable.customerId))
      .leftJoin(vendorProfilesTable, eq(vendorProfilesTable.id, bookingsTable.vendorId))
      .where(
        and(
          eq(bookingsTable.customerId, customerId),
          statusFilters ? inArray(bookingsTable.status, statusFilters) : undefined
        )
      )
      .orderBy(desc(bookingsTable.createdAt));

    // Enrich with service + package names
    const bookings = await Promise.all(
      rows.map(async (r) => {
        let serviceName: string | undefined;
        let packageName: string | undefined;
        if (r.booking.serviceId) {
          const [svc] = await db
            .select({ name: servicesTable.name })
            .from(servicesTable)
            .where(eq(servicesTable.id, r.booking.serviceId))
            .limit(1);
          serviceName = svc?.name;
        }
        if (r.booking.packageId) {
          const [pkg] = await db
            .select({ name: servicePackagesTable.name })
            .from(servicePackagesTable)
            .where(eq(servicePackagesTable.id, r.booking.packageId))
            .limit(1);
          packageName = pkg?.name;
        }
        return formatBooking({
          ...r.booking,
          customerName: r.customerName,
          vendorName: r.vendorProfile?.businessName ?? undefined,
          serviceName,
          packageName,
        });
      })
    );

    res.json({ bookings });
  } catch (err) {
    console.error("List my bookings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /bookings/vendor ─────────────────────────────────────────────────────

router.get("/vendor", requireAccessToken, async (req, res) => {
  try {
    const { statusGroup } = req.query as { statusGroup?: string };
    const userId = req.user!.userId;

    const [vendorProfile] = await db
      .select({ id: vendorProfilesTable.id })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.userId, userId))
      .limit(1);

    if (!vendorProfile) {
      res.status(404).json({ error: "Vendor profile not found" });
      return;
    }

    const statusFilters = (() => {
      if (statusGroup === "upcoming")
        return ["pending", "confirmed", "in_progress"] as const;
      if (statusGroup === "completed") return ["completed"] as const;
      if (statusGroup === "cancelled") return ["cancelled"] as const;
      return undefined;
    })();

    const rows = await db
      .select({
        booking: bookingsTable,
        customerName: usersTable.name,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(usersTable.id, bookingsTable.customerId))
      .where(
        and(
          eq(bookingsTable.vendorId, vendorProfile.id),
          statusFilters ? inArray(bookingsTable.status, statusFilters) : undefined
        )
      )
      .orderBy(desc(bookingsTable.createdAt));

    const bookings = await Promise.all(
      rows.map(async (r) => {
        let serviceName: string | undefined;
        let packageName: string | undefined;
        if (r.booking.serviceId) {
          const [svc] = await db
            .select({ name: servicesTable.name })
            .from(servicesTable)
            .where(eq(servicesTable.id, r.booking.serviceId))
            .limit(1);
          serviceName = svc?.name;
        }
        if (r.booking.packageId) {
          const [pkg] = await db
            .select({ name: servicePackagesTable.name })
            .from(servicePackagesTable)
            .where(eq(servicePackagesTable.id, r.booking.packageId))
            .limit(1);
          packageName = pkg?.name;
        }
        return formatBooking({
          ...r.booking,
          customerName: r.customerName,
          vendorName: undefined,
          serviceName,
          packageName,
        });
      })
    );

    res.json({ bookings });
  } catch (err) {
    console.error("List vendor bookings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /bookings/:id ────────────────────────────────────────────────────────

router.get("/:id", requireAccessToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id as string);
    const userId = req.user!.userId;

    const [row] = await db
      .select({
        booking: bookingsTable,
        customerName: usersTable.name,
        vendorBusinessName: vendorProfilesTable.businessName,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(usersTable.id, bookingsTable.customerId))
      .leftJoin(vendorProfilesTable, eq(vendorProfilesTable.id, bookingsTable.vendorId))
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Check access: customer or vendor associated with booking
    const [vendorProfile] = await db
      .select({ id: vendorProfilesTable.id })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.userId, userId))
      .limit(1);

    const isCustomer = row.booking.customerId === userId;
    const isVendor = vendorProfile && row.booking.vendorId === vendorProfile.id;

    if (!isCustomer && !isVendor && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let serviceName: string | undefined;
    let packageName: string | undefined;
    if (row.booking.serviceId) {
      const [svc] = await db
        .select({ name: servicesTable.name })
        .from(servicesTable)
        .where(eq(servicesTable.id, row.booking.serviceId))
        .limit(1);
      serviceName = svc?.name;
    }
    if (row.booking.packageId) {
      const [pkg] = await db
        .select({ name: servicePackagesTable.name })
        .from(servicePackagesTable)
        .where(eq(servicePackagesTable.id, row.booking.packageId))
        .limit(1);
      packageName = pkg?.name;
    }

    res.json(
      formatBooking({
        ...row.booking,
        customerName: row.customerName,
        vendorName: row.vendorBusinessName ?? undefined,
        serviceName,
        packageName,
      })
    );
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /bookings ───────────────────────────────────────────────────────────

router.post("/", requireAccessToken, async (req, res) => {
  try {
    const {
      vendorId,
      serviceId,
      packageId,
      eventDate,
      eventLocation,
      notes,
      totalAmount: manualAmount,
      eventId,
    } = req.body as {
      vendorId?: number;
      serviceId?: number;
      packageId?: number;
      eventDate?: string;
      eventLocation?: string;
      notes?: string;
      totalAmount?: number;
      eventId?: number;
    };

    if (!vendorId) {
      res.status(400).json({ error: "vendorId is required" });
      return;
    }

    const customerId = req.user!.userId;

    // Verify vendor exists
    const [vendorProfile] = await db
      .select({ id: vendorProfilesTable.id, userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, vendorId))
      .limit(1);

    if (!vendorProfile) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }

    // Customer cannot book themselves
    if (vendorProfile.userId === customerId) {
      res.status(400).json({ error: "Cannot book your own vendor profile" });
      return;
    }

    // Determine total amount — and validate package/service ownership
    let totalAmount = manualAmount ?? 0;
    let resolvedServiceId = serviceId ?? null;

    if (packageId) {
      // Validate package exists, is active, AND belongs to the specified vendor
      const [pkg] = await db
        .select({
          price: servicePackagesTable.price,
          isActive: servicePackagesTable.isActive,
          serviceId: servicePackagesTable.serviceId,
          svcVendorId: servicesTable.vendorId,
        })
        .from(servicePackagesTable)
        .innerJoin(servicesTable, eq(servicesTable.id, servicePackagesTable.serviceId))
        .where(and(
          eq(servicePackagesTable.id, packageId),
          eq(servicesTable.vendorId, vendorId),
          eq(servicePackagesTable.isActive, true),
          eq(servicesTable.isActive, true),
        ))
        .limit(1);

      if (!pkg) {
        res.status(404).json({ error: "Package not found, inactive, or does not belong to this vendor" });
        return;
      }
      totalAmount = parseFloat(pkg.price);
      resolvedServiceId = pkg.serviceId;
    } else if (serviceId && totalAmount === 0) {
      // Validate service belongs to vendor
      const [svc] = await db
        .select({ basePrice: servicesTable.basePrice })
        .from(servicesTable)
        .where(and(
          eq(servicesTable.id, serviceId),
          eq(servicesTable.vendorId, vendorId),
          eq(servicesTable.isActive, true),
        ))
        .limit(1);
      if (!svc) {
        res.status(404).json({ error: "Service not found, inactive, or does not belong to this vendor" });
        return;
      }
      totalAmount = parseFloat(svc.basePrice);
    }

    if (totalAmount <= 0) {
      res.status(400).json({ error: "Invalid booking amount" });
      return;
    }

    const platformFee = totalAmount * PLATFORM_FEE_RATE;
    const vendorAmount = totalAmount - platformFee;

    // Fast pre-check: get/create wallet and do an optimistic balance check for quick UX feedback.
    // The authoritative check happens inside the transaction with a row lock.
    const customerWallet = await getOrCreateWallet(customerId);
    const preCheckBalance = parseFloat(customerWallet.balance ?? "0");
    if (preCheckBalance < totalAmount) {
      res.status(402).json({
        error: "InsufficientFunds",
        message: "Insufficient wallet balance",
        balance: preCheckBalance,
        required: totalAmount,
        shortfall: totalAmount - preCheckBalance,
      });
      return;
    }

    // Generate booking ref (retry on collision)
    let bookingRef = generateBookingRef();
    for (let attempt = 0; attempt < 3; attempt++) {
      const [existing] = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(eq(bookingsTable.bookingRef, bookingRef))
        .limit(1);
      if (!existing) break;
      bookingRef = generateBookingRef();
    }

    // Execute booking + wallet debit atomically.
    // Re-read the wallet WITH a row-level lock inside the transaction to prevent
    // double-spend under concurrent requests.
    let newBooking: typeof bookingsTable.$inferSelect;
    try {
      [newBooking] = await db.transaction(async (tx) => {
        // Lock the wallet row — prevents concurrent bookings from reading a stale balance
        const lockedRows = await tx.execute(
          sql`SELECT id, balance FROM wallet_accounts WHERE id = ${customerWallet.id} FOR UPDATE`
        );
        const lockedWallet = (lockedRows as unknown as { rows: { id: number; balance: string }[] }).rows?.[0]
          ?? { id: customerWallet.id, balance: customerWallet.balance };

        const currentBalance = parseFloat(lockedWallet.balance ?? "0");
        if (currentBalance < totalAmount) {
          throw Object.assign(new Error("InsufficientFunds"), {
            code: "INSUFFICIENT_FUNDS",
            balance: currentBalance,
            required: totalAmount,
            shortfall: totalAmount - currentBalance,
          });
        }

        const newBalance = currentBalance - totalAmount;

        // Debit customer wallet
        await tx
          .update(walletAccountsTable)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(walletAccountsTable.id, customerWallet.id));

        await tx.insert(walletTransactionsTable).values({
          walletId: customerWallet.id,
          type: "debit",
          amount: totalAmount.toFixed(2),
          reference: bookingRef,
          description: `Booking payment – held in escrow (${bookingRef})`,
          balanceBefore: currentBalance.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
        });

        // Create booking
        return await tx
          .insert(bookingsTable)
          .values({
            bookingRef,
            eventId: eventId ?? null,
            customerId,
            vendorId,
            serviceId: resolvedServiceId,
            packageId: packageId ?? null,
            status: "pending",
            totalAmount: totalAmount.toFixed(2),
            platformFee: platformFee.toFixed(2),
            vendorAmount: vendorAmount.toFixed(2),
            escrowStatus: "held",
            eventDate: eventDate ? new Date(eventDate) : null,
            eventLocation: eventLocation ?? null,
            notes: notes ?? null,
          })
          .returning();
      });
    } catch (txErr: unknown) {
      if (txErr instanceof Error && txErr.message === "InsufficientFunds") {
        const e = txErr as Error & { balance: number; required: number; shortfall: number };
        res.status(402).json({
          error: "InsufficientFunds",
          message: "Insufficient wallet balance",
          balance: e.balance ?? 0,
          required: e.required ?? totalAmount,
          shortfall: e.shortfall ?? 0,
        });
        return;
      }
      throw txErr;
    }

    // Notify vendor
    await createNotification(
      vendorProfile.userId,
      "New Booking Request",
      `You have a new booking request (${bookingRef}). Review and accept or decline.`,
      "booking",
      { bookingId: newBooking!.id, bookingRef }
    );

    res.status(201).json(formatBooking(newBooking!));
  } catch (err) {
    console.error("Create booking error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /bookings/:id/status ───────────────────────────────────────────────

router.patch("/:id/status", requireAccessToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id as string);
    const { status, reason } = req.body as { status?: string; reason?: string };
    const userId = req.user!.userId;

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Resolve vendor profile for current user if vendor
    const [myVendorProfile] = await db
      .select({ id: vendorProfilesTable.id, userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.userId, userId))
      .limit(1);

    const isCustomer = booking.customerId === userId;
    const isVendor = myVendorProfile && booking.vendorId === myVendorProfile.id;

    if (!isCustomer && !isVendor && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const currentStatus = booking.status;
    const totalAmount = parseFloat(booking.totalAmount);

    // ── Vendor transitions ────────────────────────────────────────────────────
    if (isVendor) {
      // Accept: pending → confirmed
      if (status === "confirmed" && currentStatus === "pending") {
        await db
          .update(bookingsTable)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(bookingsTable.id, bookingId));

        await createNotification(
          booking.customerId,
          "Booking Confirmed!",
          `Your booking ${booking.bookingRef} has been accepted by the vendor.`,
          "booking",
          { bookingId: booking.id }
        );

        res.json({ status: "confirmed" });
        return;
      }

      // Reject: pending → cancelled + refund
      if (status === "cancelled" && currentStatus === "pending") {
        const customerWallet = await getOrCreateWallet(booking.customerId);
        const custBalance = parseFloat(customerWallet.balance ?? "0");

        await db.transaction(async (tx) => {
          const newBalance = custBalance + totalAmount;
          await tx
            .update(walletAccountsTable)
            .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
            .where(eq(walletAccountsTable.id, customerWallet.id));

          await tx.insert(walletTransactionsTable).values({
            walletId: customerWallet.id,
            type: "credit",
            amount: totalAmount.toFixed(2),
            reference: booking.bookingRef,
            description: `Booking refund – vendor declined (${booking.bookingRef})`,
            balanceBefore: custBalance.toFixed(2),
            balanceAfter: newBalance.toFixed(2),
          });

          await tx
            .update(bookingsTable)
            .set({
              status: "cancelled",
              escrowStatus: "refunded",
              cancellationReason: reason ?? "Vendor declined",
              updatedAt: new Date(),
            })
            .where(eq(bookingsTable.id, bookingId));
        });

        await createNotification(
          booking.customerId,
          "Booking Declined",
          `Your booking ${booking.bookingRef} was declined. A full refund has been issued to your wallet.`,
          "booking",
          { bookingId: booking.id }
        );

        res.json({ status: "cancelled", escrowStatus: "refunded" });
        return;
      }

      // Mark in progress: confirmed → in_progress
      if (status === "in_progress" && currentStatus === "confirmed") {
        await db
          .update(bookingsTable)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(eq(bookingsTable.id, bookingId));

        await createNotification(
          booking.customerId,
          "Service Started",
          `Your event service for booking ${booking.bookingRef} is now underway.`,
          "booking",
          { bookingId: booking.id }
        );

        res.json({ status: "in_progress" });
        return;
      }

      // Mark completed (service delivered): in_progress → completed
      if (status === "completed" && currentStatus === "in_progress") {
        await db
          .update(bookingsTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(bookingsTable.id, bookingId));

        await createNotification(
          booking.customerId,
          "Service Completed – Please Confirm",
          `The vendor has marked booking ${booking.bookingRef} as completed. Please confirm to release payment.`,
          "booking",
          { bookingId: booking.id }
        );

        res.json({ status: "completed" });
        return;
      }
    }

    // ── Customer transitions ──────────────────────────────────────────────────
    if (isCustomer) {
      // Confirm completion → release escrow to vendor
      if (status === "completed" && currentStatus === "completed" && booking.escrowStatus === "held") {
        const vendorUserId = await (async () => {
          const [vp] = await db
            .select({ userId: vendorProfilesTable.userId })
            .from(vendorProfilesTable)
            .where(eq(vendorProfilesTable.id, booking.vendorId))
            .limit(1);
          return vp?.userId;
        })();

        if (!vendorUserId) {
          res.status(404).json({ error: "Vendor not found" });
          return;
        }

        const vendorAmount = parseFloat(booking.vendorAmount ?? "0");
        const vendorWallet = await getOrCreateWallet(vendorUserId);
        const vendorBalance = parseFloat(vendorWallet.balance ?? "0");

        await db.transaction(async (tx) => {
          const newVendorBalance = vendorBalance + vendorAmount;
          const newTotalEarned =
            parseFloat(vendorWallet.totalEarned ?? "0") + vendorAmount;

          await tx
            .update(walletAccountsTable)
            .set({
              balance: newVendorBalance.toFixed(2),
              totalEarned: newTotalEarned.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(walletAccountsTable.id, vendorWallet.id));

          await tx.insert(walletTransactionsTable).values({
            walletId: vendorWallet.id,
            type: "credit",
            amount: vendorAmount.toFixed(2),
            reference: booking.bookingRef,
            description: `Service payment released – escrow (${booking.bookingRef})`,
            balanceBefore: vendorBalance.toFixed(2),
            balanceAfter: newVendorBalance.toFixed(2),
          });

          await tx
            .update(bookingsTable)
            .set({ escrowStatus: "released", updatedAt: new Date() })
            .where(eq(bookingsTable.id, bookingId));
        });

        await createNotification(
          vendorUserId,
          "Payment Released!",
          `The customer has confirmed delivery for ${booking.bookingRef}. TZS ${vendorAmount.toLocaleString()} has been credited to your wallet.`,
          "payment",
          { bookingId: booking.id }
        );

        res.json({ status: "completed", escrowStatus: "released" });
        return;
      }
    }

    res.status(400).json({
      error: "InvalidTransition",
      message: `Cannot transition from '${currentStatus}' to '${status}' for your role`,
    });
  } catch (err) {
    console.error("Update booking status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /bookings/:id/cancel ────────────────────────────────────────────────

router.post("/:id/cancel", requireAccessToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id as string);
    const { reason } = req.body as { reason?: string };
    const userId = req.user!.userId;

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const [myVendorProfile] = await db
      .select({ id: vendorProfilesTable.id })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.userId, userId))
      .limit(1);

    const isCustomer = booking.customerId === userId;
    const isVendor = myVendorProfile && booking.vendorId === myVendorProfile.id;

    if (!isCustomer && !isVendor) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!["pending", "confirmed"].includes(booking.status ?? "")) {
      res.status(400).json({
        error: "Cannot cancel a booking that is in progress or already completed/cancelled",
      });
      return;
    }

    const totalAmount = parseFloat(booking.totalAmount);
    // Full refund for pending; full refund for confirmed (vendor hasn't started)
    const refundAmount = totalAmount;

    const customerWallet = await getOrCreateWallet(booking.customerId);
    const custBalance = parseFloat(customerWallet.balance ?? "0");

    await db.transaction(async (tx) => {
      const newBalance = custBalance + refundAmount;
      await tx
        .update(walletAccountsTable)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(walletAccountsTable.id, customerWallet.id));

      await tx.insert(walletTransactionsTable).values({
        walletId: customerWallet.id,
        type: "credit",
        amount: refundAmount.toFixed(2),
        reference: booking.bookingRef,
        description: `Booking cancellation refund (${booking.bookingRef})`,
        balanceBefore: custBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
      });

      await tx
        .update(bookingsTable)
        .set({
          status: "cancelled",
          escrowStatus: "refunded",
          cancellationReason: reason ?? "Cancelled by user",
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, bookingId));
    });

    // Notify the other party
    const [vendorUser] = await db
      .select({ userId: vendorProfilesTable.userId })
      .from(vendorProfilesTable)
      .where(eq(vendorProfilesTable.id, booking.vendorId))
      .limit(1);

    if (isCustomer && vendorUser) {
      await createNotification(
        vendorUser.userId,
        "Booking Cancelled",
        `Booking ${booking.bookingRef} has been cancelled by the customer.`,
        "booking",
        { bookingId: booking.id }
      );
    } else if (isVendor) {
      await createNotification(
        booking.customerId,
        "Booking Cancelled",
        `Your booking ${booking.bookingRef} has been cancelled. A full refund of TZS ${refundAmount.toLocaleString()} has been issued.`,
        "booking",
        { bookingId: booking.id }
      );
    }

    res.json({ status: "cancelled", escrowStatus: "refunded", refundAmount });
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /bookings/wallet/balance ─────────────────────────────────────────────
// Minimal wallet balance endpoint for booking flow (full wallet in Task 4)

router.get("/wallet/balance", requireAccessToken, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user!.userId);
    res.json({
      balance: parseFloat(wallet.balance ?? "0"),
      pendingBalance: parseFloat(wallet.pendingBalance ?? "0"),
    });
  } catch (err) {
    console.error("Get wallet balance error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /bookings/wallet/top-up (demo only — real M-Pesa in Task 4) ─────────

router.post("/wallet/top-up", requireAccessToken, async (req, res) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (!amount || amount <= 0 || amount > 10000000) {
      res.status(400).json({ error: "Amount must be between 1 and 10,000,000" });
      return;
    }

    const wallet = await getOrCreateWallet(req.user!.userId);
    const before = parseFloat(wallet.balance ?? "0");
    const after = before + amount;

    await db.transaction(async (tx) => {
      await tx
        .update(walletAccountsTable)
        .set({ balance: after.toFixed(2), updatedAt: new Date() })
        .where(eq(walletAccountsTable.id, wallet.id));

      await tx.insert(walletTransactionsTable).values({
        walletId: wallet.id,
        type: "credit",
        amount: amount.toFixed(2),
        reference: `TOPUP-${Date.now()}`,
        description: "Wallet top-up (demo)",
        balanceBefore: before.toFixed(2),
        balanceAfter: after.toFixed(2),
      });
    });

    res.json({ balance: after, added: amount });
  } catch (err) {
    console.error("Top-up error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
