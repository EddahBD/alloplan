import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["customer", "vendor", "admin"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "basic",
  "pro",
  "premium",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);
export const escrowStatusEnum = pgEnum("escrow_status", [
  "held",
  "released",
  "refunded",
]);
export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit",
  "debit",
]);
export const referralTypeEnum = pgEnum("referral_type", ["user", "vendor"]);
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "paid",
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: roleEnum("role").notNull().default("customer"),
  profileImage: text("profile_image"),
  pushToken: text("push_token"),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── Vendor Profiles ─────────────────────────────────────────────────────────

export const vendorProfilesTable = pgTable("vendor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  businessName: text("business_name"),
  bio: text("bio"),
  businessType: text("business_type"),
  location: text("location"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  verified: boolean("verified").default(false),
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("basic"),
  coverImage: text("cover_image"),
  responseTime: text("response_time"),
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVendorProfileSchema = createInsertSchema(
  vendorProfilesTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendorProfile = z.infer<typeof insertVendorProfileSchema>;
export type VendorProfile = typeof vendorProfilesTable.$inferSelect;

// ─── Services ────────────────────────────────────────────────────────────────

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  images: text("images"), // JSON array of image URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

// ─── Service Packages ────────────────────────────────────────────────────────

export const servicePackagesTable = pgTable("service_packages", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  inclusions: text("inclusions"), // JSON array of strings
  durationHours: integer("duration_hours"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServicePackageSchema = createInsertSchema(
  servicePackagesTable
).omit({ id: true, createdAt: true });
export type InsertServicePackage = z.infer<typeof insertServicePackageSchema>;
export type ServicePackage = typeof servicePackagesTable.$inferSelect;

// ─── Events ──────────────────────────────────────────────────────────────────

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // wedding, birthday, corporate, graduation, concert, other
  eventDate: timestamp("event_date"),
  guestCount: integer("guest_count"),
  location: text("location"),
  totalBudget: decimal("total_budget", { precision: 12, scale: 2 }),
  notes: text("notes"),
  status: text("status").default("planning"), // planning, active, completed, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;

// ─── Bookings ────────────────────────────────────────────────────────────────

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingRef: text("booking_ref").notNull().unique(),
  eventId: integer("event_id"),
  customerId: integer("customer_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  serviceId: integer("service_id"),
  packageId: integer("package_id"),
  status: bookingStatusEnum("status").default("pending"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }),
  vendorAmount: decimal("vendor_amount", { precision: 12, scale: 2 }),
  escrowStatus: escrowStatusEnum("escrow_status").default("held"),
  eventDate: timestamp("event_date"),
  eventLocation: text("event_location"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

// ─── Wallet Accounts ─────────────────────────────────────────────────────────

export const walletAccountsTable = pgTable("wallet_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  pendingBalance: decimal("pending_balance", { precision: 12, scale: 2 }).default("0"),
  totalEarned: decimal("total_earned", { precision: 12, scale: 2 }).default("0"),
  totalWithdrawn: decimal("total_withdrawn", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWalletAccountSchema = createInsertSchema(
  walletAccountsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalletAccount = z.infer<typeof insertWalletAccountSchema>;
export type WalletAccount = typeof walletAccountsTable.$inferSelect;

// ─── Wallet Transactions ─────────────────────────────────────────────────────

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: walletTransactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  reference: text("reference"),
  description: text("description"),
  balanceBefore: decimal("balance_before", { precision: 12, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWalletTransactionSchema = createInsertSchema(
  walletTransactionsTable
).omit({ id: true, createdAt: true });
export type InsertWalletTransaction = z.infer<
  typeof insertWalletTransactionSchema
>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;

// ─── Referral Codes ──────────────────────────────────────────────────────────

export const referralCodesTable = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  code: text("code").notNull().unique(),
  totalEarnings: decimal("total_earnings", {
    precision: 12,
    scale: 2,
  }).default("0"),
  totalReferrals: integer("total_referrals").default(0),
  clicks: integer("clicks").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralCodeSchema = createInsertSchema(
  referralCodesTable
).omit({ id: true, createdAt: true });
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralCode = typeof referralCodesTable.$inferSelect;

// ─── Referral Earnings ───────────────────────────────────────────────────────

export const referralEarningsTable = pgTable("referral_earnings", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  refereeId: integer("referee_id").notNull(),
  bookingId: integer("booking_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", {
    precision: 5,
    scale: 4,
  }).default("0.05"),
  type: referralTypeEnum("type").notNull(),
  status: referralStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralEarningSchema = createInsertSchema(
  referralEarningsTable
).omit({ id: true, createdAt: true });
export type InsertReferralEarning = z.infer<typeof insertReferralEarningSchema>;
export type ReferralEarning = typeof referralEarningsTable.$inferSelect;

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  reviewerId: integer("reviewer_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  vendorResponse: text("vendor_response"),
  isVerified: boolean("is_verified").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

// ─── Vendor Portfolio ────────────────────────────────────────────────────────

export const portfolioItemsTable = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  eventType: text("event_type"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortfolioItemSchema = createInsertSchema(
  portfolioItemsTable
).omit({ id: true, createdAt: true });
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;
export type PortfolioItem = typeof portfolioItemsTable.$inferSelect;

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(), // booking, payment, referral, review, chat, system
  data: text("data"), // JSON payload for deep linking
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(
  notificationsTable
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

// ─── Conversations ───────────────────────────────────────────────────────────

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  bookingId: integer("booking_id"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  customerUnread: integer("customer_unread").default(0),
  vendorUnread: integer("vendor_unread").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(
  conversationsTable
).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

// ─── Messages ────────────────────────────────────────────────────────────────

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // image, pdf, audio
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
