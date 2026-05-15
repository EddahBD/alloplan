/**
 * Payment Gateway Routes — Flutterwave (with mock/sandbox mode)
 *
 * Flow:
 *  1. Customer calls POST /payments/initiate with amount + purpose
 *  2. If FLUTTERWAVE_SECRET_KEY is set → real Flutterwave checkout link returned
 *     Otherwise → mock link returned (dev/demo mode)
 *  3. Customer completes payment on Flutterwave or mock page
 *  4. POST /payments/webhook receives confirmation → credits customer wallet
 *  5. Customer proceeds to booking creation (wallet balance now sufficient)
 *
 * Production setup: set FLUTTERWAVE_SECRET_KEY env var to go live.
 */

import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  walletAccountsTable,
  walletTransactionsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAccessToken } from "../middlewares/auth";

const router = Router();

const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY ?? "";
const FLW_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY ?? "";
const FLW_WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "";
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:3000";

const IS_MOCK_MODE = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Atomically credit a wallet using a FOR UPDATE row lock inside a transaction.
 * Returns the new balance.
 */
async function atomicCreditWallet(
  walletId: number,
  amount: number,
  reference: string,
  description: string
): Promise<number> {
  return await db.transaction(async (tx) => {
    const lockedRows = await tx.execute(
      sql`SELECT id, balance, total_earned FROM wallet_accounts WHERE id = ${walletId} FOR UPDATE`
    );
    const row = (lockedRows as unknown as { rows: { id: number; balance: string; total_earned: string }[] }).rows?.[0];
    if (!row) throw new Error("Wallet not found");

    const before = parseFloat(row.balance ?? "0");
    const after = before + amount;
    const newEarned = parseFloat(row.total_earned ?? "0") + amount;

    await tx
      .update(walletAccountsTable)
      .set({ balance: after.toFixed(2), totalEarned: newEarned.toFixed(2), updatedAt: new Date() })
      .where(eq(walletAccountsTable.id, walletId));

    await tx.insert(walletTransactionsTable).values({
      walletId,
      type: "credit",
      amount: amount.toFixed(2),
      reference,
      description,
      balanceBefore: before.toFixed(2),
      balanceAfter: after.toFixed(2),
    });

    return after;
  });
}

// ─── POST /payments/initiate ──────────────────────────────────────────────────

router.post("/initiate", requireAccessToken, async (req, res) => {
  try {
    const { amount, currency = "TZS", purpose = "Wallet Top-Up" } = req.body as {
      amount?: number;
      currency?: string;
      purpose?: string;
    };

    if (!amount || amount <= 0 || amount > 50_000_000) {
      res.status(400).json({ error: "Amount must be between 1 and 50,000,000" });
      return;
    }

    const userId = req.user!.userId;
    const txRef = `ALO-${userId}-${Date.now()}`;

    if (IS_MOCK_MODE) {
      // Demo/sandbox: return a mock payment link handled by /payments/mock-complete
      res.json({
        mode: "mock",
        txRef,
        amount,
        currency,
        checkoutUrl: `${BASE_URL}/api/payments/mock-complete?txRef=${txRef}&amount=${amount}&userId=${userId}`,
        message: "Mock mode: payment will be credited instantly (no real money moved)",
      });
      return;
    }

    // Real Flutterwave: create payment link
    const wallet = await getOrCreateWallet(userId);
    const payload = {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: `${BASE_URL}/api/payments/flw-redirect?txRef=${txRef}`,
      customer: {
        email: req.user!.email ?? `user${userId}@alloplan.app`,
        name: `User ${userId}`,
      },
      customizations: {
        title: "AlloPlan",
        description: purpose,
        logo: `${BASE_URL}/assets/logo.png`,
      },
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as {
      status: string;
      data?: { link: string };
      message?: string;
    };

    if (data.status !== "success" || !data.data?.link) {
      console.error("Flutterwave initiate error:", data);
      res.status(502).json({ error: "Payment gateway error", message: data.message });
      return;
    }

    res.json({
      mode: "flutterwave",
      txRef,
      amount,
      currency,
      checkoutUrl: data.data.link,
    });
  } catch (err) {
    console.error("Payment initiate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/mock-complete (dev only) ───────────────────────────────────
// Simulates a successful payment in demo mode and credits wallet.

router.get("/mock-complete", async (req, res) => {
  if (!IS_MOCK_MODE && process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Mock payments disabled in production" });
    return;
  }

  try {
    const { txRef, amount: amountStr, userId: userIdStr } = req.query as {
      txRef?: string;
      amount?: string;
      userId?: string;
    };

    if (!txRef || !amountStr || !userIdStr) {
      res.status(400).json({ error: "Missing required params" });
      return;
    }

    const amount = parseFloat(amountStr);
    const userId = parseInt(userIdStr);

    if (isNaN(amount) || amount <= 0 || isNaN(userId)) {
      res.status(400).json({ error: "Invalid params" });
      return;
    }

    // Idempotency: check if this txRef was already processed
    const [existing] = await db
      .select({ id: walletTransactionsTable.id })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.reference, txRef))
      .limit(1);

    if (existing) {
      res.json({ status: "already_processed", txRef });
      return;
    }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = await atomicCreditWallet(
      wallet.id,
      amount,
      txRef,
      `Wallet top-up via mock payment (${txRef})`
    );

    res.json({
      status: "success",
      txRef,
      amount,
      newBalance,
      message: "Mock payment processed. Wallet credited.",
    });
  } catch (err) {
    console.error("Mock complete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /payments/webhook (Flutterwave production webhook) ──────────────────

router.post("/webhook", async (req, res) => {
  try {
    // Verify Flutterwave webhook signature
    const signature = req.headers["verif-hash"] as string;
    if (FLW_WEBHOOK_HASH && signature !== FLW_WEBHOOK_HASH) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    const event = req.body as {
      event?: string;
      data?: {
        id: number;
        tx_ref: string;
        amount: number;
        currency: string;
        status: string;
        customer?: { email?: string };
      };
    };

    // Only process successful charge events
    if (event.event !== "charge.completed" || event.data?.status !== "successful") {
      res.json({ received: true, processed: false });
      return;
    }

    const { tx_ref: txRef, amount } = event.data;

    // Parse userId from txRef (format: ALO-{userId}-{timestamp})
    const parts = txRef.split("-");
    const userId = parseInt(parts[1]);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Cannot parse userId from txRef" });
      return;
    }

    // Idempotency: skip if already processed
    const [existing] = await db
      .select({ id: walletTransactionsTable.id })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.reference, txRef))
      .limit(1);

    if (existing) {
      res.json({ received: true, processed: false, reason: "duplicate" });
      return;
    }

    // Verify with Flutterwave (re-query the charge to confirm amount + status)
    if (!IS_MOCK_MODE) {
      const verifyRes = await fetch(
        `https://api.flutterwave.com/v3/transactions/${event.data.id}/verify`,
        { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } }
      );
      const verified = await verifyRes.json() as {
        status: string;
        data?: { status: string; amount: number; currency: string };
      };
      if (
        verified.status !== "success" ||
        verified.data?.status !== "successful" ||
        verified.data?.amount < amount
      ) {
        res.status(400).json({ error: "Payment verification failed" });
        return;
      }
    }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = await atomicCreditWallet(
      wallet.id,
      amount,
      txRef,
      `Wallet top-up via Flutterwave (${txRef})`
    );

    console.log(`[payments] Credited ${amount} to wallet of user ${userId}. New balance: ${newBalance}`);
    res.json({ received: true, processed: true, newBalance });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/flw-redirect (Flutterwave redirect after payment) ──────────

router.get("/flw-redirect", async (req, res) => {
  const { txRef, status, transaction_id } = req.query as {
    txRef?: string;
    status?: string;
    transaction_id?: string;
  };

  // Redirect back into the app — deep link to wallet screen
  if (status === "successful") {
    res.redirect(`/?payment=success&txRef=${txRef}`);
  } else {
    res.redirect(`/?payment=failed&txRef=${txRef}`);
  }
});

export default router;
