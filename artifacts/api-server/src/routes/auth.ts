import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, walletAccountsTable, referralCodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  signToken,
  signRefreshToken,
  signResetToken,
  verifyToken,
  requireAccessToken,
} from "../middlewares/auth";

const router = Router();

// Generate a unique referral code with collision-safe retry
function generateReferralCode(name: string): string {
  const base = name.replace(/\s+/g, "").substring(0, 6).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

async function generateUniqueReferralCode(name: string, maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferralCode(name);
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  // Fallback: timestamp-based code guaranteed unique
  return `REF${Date.now().toString(36).toUpperCase()}`;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role = "customer", referralCode } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Validation", message: "Name, email and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Validation", message: "Password must be at least 6 characters" });
      return;
    }

    // Check if email already exists
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Conflict", message: "Email already registered" });
      return;
    }

    // Resolve referral
    let referredById: number | undefined;
    if (referralCode) {
      const [referrer] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.referralCode, referralCode.toUpperCase()))
        .limit(1);
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const myReferralCode = await generateUniqueReferralCode(name);

    const [user] = await db
      .insert(usersTable)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim(),
        role: role === "vendor" ? "vendor" : "customer",
        referralCode: myReferralCode,
        referredBy: referredById,
      })
      .returning();

    if (!user) {
      res.status(500).json({ error: "Server", message: "Failed to create user" });
      return;
    }

    // Create wallet account
    await db.insert(walletAccountsTable).values({ userId: user.id });

    // Create referral code record
    await db.insert(referralCodesTable).values({ userId: user.id, code: myReferralCode });

    const tokenPayload = { userId: user.id, email: user.email, role: user.role as "customer" | "vendor" | "admin" };
    const token = signToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? null,
        role: user.role,
        profileImage: user.profileImage ?? null,
        referralCode: user.referralCode ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Validation", message: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role as "customer" | "vendor" | "admin" };
    const token = signToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? null,
        role: user.role,
        profileImage: user.profileImage ?? null,
        referralCode: user.referralCode ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAccessToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      profileImage: user.profileImage ?? null,
      referralCode: user.referralCode ?? null,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "Validation", message: "refreshToken required" });
      return;
    }

    const raw = verifyToken(refreshToken) as {
      userId: number;
      email: string;
      role: string;
      tokenType?: string;
    };
    if (raw.tokenType !== "refresh") {
      res.status(401).json({ error: "Unauthorized", message: "Not a refresh token" });
      return;
    }
    const role = (["customer", "vendor", "admin"] as const).includes(raw.role as "customer" | "vendor" | "admin")
      ? (raw.role as "customer" | "vendor" | "admin")
      : "customer" as const;
    const newToken = signToken({ userId: raw.userId, email: raw.email, role });
    const newRefreshToken = signRefreshToken({ userId: raw.userId, email: raw.email, role });

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid refresh token" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Validation", message: "Email is required" });
      return;
    }
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to avoid email enumeration
    if (user) {
      // Generate a short-lived, purpose-scoped reset token
      const _resetToken = signResetToken({ userId: user.id, email: user.email });
      // TODO: deliver _resetToken via email service (e.g. SendGrid / Mailgun)
      // Do NOT log the token — it is a credential-equivalent secret
    }
    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: "Validation", message: "token and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Validation", message: "Password must be at least 6 characters" });
      return;
    }

    let payload: { userId: number; tokenType?: string };
    try {
      payload = verifyToken(token) as { userId: number; tokenType?: string };
    } catch {
      res.status(400).json({ error: "InvalidToken", message: "Invalid or expired reset token" });
      return;
    }

    if (payload.tokenType !== "reset") {
      res.status(400).json({ error: "InvalidToken", message: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, payload.userId));

    res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

// POST /api/auth/push-token
router.post("/push-token", requireAccessToken, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== "string") {
      res.status(400).json({ error: "Validation", message: "pushToken is required" });
      return;
    }

    await db
      .update(usersTable)
      .set({ pushToken, updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.userId));

    res.json({ message: "Push token registered" });
  } catch (err) {
    console.error("Push token error:", err);
    res.status(500).json({ error: "Server", message: "Internal server error" });
  }
});

export default router;
