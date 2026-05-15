import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/hooks/useApi";

const EVENT_CATEGORIES = [
  { id: "wedding", label: "Wedding", icon: "heart" as const, color: "#FF6B35" },
  { id: "birthday", label: "Birthday", icon: "gift" as const, color: "#8B5CF6" },
  { id: "corporate", label: "Corporate", icon: "business" as const, color: "#1E3A5F" },
  { id: "graduation", label: "Graduation", icon: "school" as const, color: "#10B981" },
  { id: "concert", label: "Concert", icon: "musical-notes" as const, color: "#EF4444" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-circle" as const, color: "#6B7689" },
];

const QUICK_ACTIONS = [
  { id: "create", label: "Create Event", icon: "add-circle" as const, route: "/(tabs)/planner" as const },
  { id: "vendors", label: "Find Vendors", icon: "storefront" as const, route: "/(tabs)/marketplace" as const },
  { id: "wallet", label: "My Wallet", icon: "wallet" as const, route: "/(tabs)/wallet" as const },
  { id: "refer", label: "Refer & Earn", icon: "share-social" as const, route: "/(tabs)/profile" as const },
];

interface VendorCard {
  id: number;
  businessName?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  coverImage?: string | null;
  isAvailable: boolean;
  ownerName: string;
  isTopRated: boolean;
  isFeatured: boolean;
  minPrice?: number | null;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [trendingVendors, setTrendingVendors] = useState<VendorCard[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const data = await apiRequest<{ vendors: VendorCard[] }>("/vendors/trending?limit=6");
      setTrendingVendors(data.vendors);
    } catch {
      setTrendingVendors([]);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => { loadTrending(); }, [loadTrending]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.navy, colors.navyLight]}
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16 },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: "rgba(255,255,255,0.7)", fontFamily: "Poppins_400Regular" }]}>
              Good day,
            </Text>
            <Text style={[styles.userName, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>
              {firstName} 👋
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={() => {}}
              testID="notifications-btn"
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Wallet preview */}
        <View style={[styles.walletCard, { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: colors.radius }]}>
          <View>
            <Text style={[styles.walletLabel, { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular" }]}>
              Wallet Balance
            </Text>
            <Text style={[styles.walletAmount, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>
              TZS 0.00
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.topUpBtn, { backgroundColor: colors.primary, borderRadius: colors.radius / 2 }]}
            onPress={() => router.push("/(tabs)/wallet" as never)}
          >
            <Text style={[styles.topUpText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              Top Up
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={[styles.section, { paddingTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              testID={`action-${action.id}`}
              activeOpacity={0.8}
              onPress={() => router.push(action.route)}
              style={[
                styles.actionCard,
                { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary, borderRadius: colors.radius / 2 }]}>
                <Ionicons name={action.icon} size={24} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Trending Vendors */}
      <View style={[styles.section]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Trending Vendors
            </Text>
            <View style={[styles.fireBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={styles.fireEmoji}>🔥</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/marketplace" as never)}>
            <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>

        {trendingLoading ? (
          <View style={styles.trendingLoader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : trendingVendors.length === 0 ? (
          <View style={[styles.trendingEmpty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Ionicons name="storefront-outline" size={32} color={colors.border} />
            <Text style={[styles.trendingEmptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Vendors coming soon
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
            {trendingVendors.map((vendor) => (
              <TouchableOpacity
                key={vendor.id}
                testID={`trending-vendor-${vendor.id}`}
                activeOpacity={0.88}
                onPress={() => router.push(`/vendor/${vendor.id}` as never)}
                style={[styles.trendingCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                {/* Cover */}
                <View style={[styles.trendingCover, { borderRadius: colors.radius, overflow: "hidden" }]}>
                  {vendor.coverImage ? (
                    <Image source={{ uri: vendor.coverImage }} style={styles.trendingCoverImg} />
                  ) : (
                    <View style={[styles.trendingCoverPlaceholder, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                    </View>
                  )}
                  {vendor.isTopRated && (
                    <View style={[styles.topBadge, { backgroundColor: colors.accent }]}>
                      <Ionicons name="star" size={9} color="#0D1B2A" />
                      <Text style={[styles.topBadgeText, { color: "#0D1B2A", fontFamily: "Poppins_600SemiBold" }]}>Top</Text>
                    </View>
                  )}
                  <View style={[styles.availDot, { backgroundColor: vendor.isAvailable ? "#10B981" : "#6B7689" }]} />
                </View>
                {/* Info */}
                <View style={styles.trendingInfo}>
                  <Text style={[styles.trendingName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]} numberOfLines={1}>
                    {vendor.businessName || vendor.ownerName}
                  </Text>
                  {vendor.businessType && (
                    <Text style={[styles.trendingType, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]} numberOfLines={1}>
                      {vendor.businessType}
                    </Text>
                  )}
                  <View style={styles.trendingMeta}>
                    <Ionicons name="star" size={11} color={colors.accent} />
                    <Text style={[styles.trendingRating, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                      {vendor.rating ? vendor.rating.toFixed(1) : "New"}
                    </Text>
                    {vendor.reviewCount > 0 && (
                      <Text style={[styles.trendingReviews, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        ({vendor.reviewCount})
                      </Text>
                    )}
                  </View>
                  {vendor.minPrice && (
                    <Text style={[styles.trendingPrice, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                      From TZS {vendor.minPrice.toLocaleString()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Event Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            Plan by Event
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/marketplace" as never)}>
            <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
              Browse All
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {EVENT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              testID={`category-${cat.id}`}
              activeOpacity={0.8}
              style={[styles.categoryCard, { backgroundColor: cat.color + "18", borderRadius: colors.radius }]}
              onPress={() => router.push("/(tabs)/marketplace" as never)}
            >
              <View style={[styles.categoryIcon, { backgroundColor: cat.color + "22", borderRadius: 12 }]}>
                <Ionicons name={cat.icon} size={22} color={cat.color} />
              </View>
              <Text style={[styles.categoryLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Get Started Banner */}
      <View style={[styles.section]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/planner" as never)}
          testID="get-started-banner"
        >
          <LinearGradient
            colors={[colors.primary, "#FF8C5A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bannerCard, { borderRadius: colors.radius }]}
          >
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerTitle, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
                Plan Your First{"\n"}Event Today
              </Text>
              <Text style={[styles.bannerSub, { color: "rgba(255,255,255,0.85)", fontFamily: "Poppins_400Regular" }]}>
                AI helps you find the perfect vendors within your budget
              </Text>
              <View style={[styles.bannerBtn, { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10 }]}>
                <Text style={[styles.bannerBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  Get Started
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
            <View style={styles.bannerIcon}>
              <Ionicons name="sparkles" size={64} color="rgba(255,255,255,0.15)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Referral teaser */}
      <View style={[styles.section]}>
        <View
          style={[styles.referralCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
        >
          <View style={[styles.referralIcon, { backgroundColor: colors.accent + "22", borderRadius: 12 }]}>
            <Ionicons name="gift" size={24} color={colors.accent} />
          </View>
          <View style={styles.referralText}>
            <Text style={[styles.referralTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Earn by Referring
            </Text>
            <Text style={[styles.referralSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Share your code and earn 5% on every booking
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13 },
  userName: { fontSize: 24 },
  headerActions: { flexDirection: "row", gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  walletCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  walletLabel: { fontSize: 12 },
  walletAmount: { fontSize: 22, marginTop: 2 },
  topUpBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  topUpText: { fontSize: 13 },
  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, marginBottom: 12 },
  seeAll: { fontSize: 13 },
  fireBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  fireEmoji: { fontSize: 14 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47%",
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, textAlign: "center" },
  trendingLoader: { height: 160, alignItems: "center", justifyContent: "center" },
  trendingEmpty: { height: 100, alignItems: "center", justifyContent: "center", borderWidth: 1, gap: 8 },
  trendingEmptyText: { fontSize: 13 },
  trendingRow: { gap: 12, paddingRight: 4 },
  trendingCard: { width: 160, borderWidth: 1, overflow: "hidden" },
  trendingCover: { height: 110, position: "relative" },
  trendingCoverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  trendingCoverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  topBadgeText: { fontSize: 9 },
  availDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  trendingInfo: { padding: 10, gap: 3 },
  trendingName: { fontSize: 13 },
  trendingType: { fontSize: 11 },
  trendingMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  trendingRating: { fontSize: 12 },
  trendingReviews: { fontSize: 11 },
  trendingPrice: { fontSize: 11, marginTop: 2 },
  categoriesRow: { gap: 12, paddingRight: 20 },
  categoryCard: { padding: 14, alignItems: "center", gap: 8, width: 90 },
  categoryIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 12, textAlign: "center" },
  bannerCard: { padding: 24, flexDirection: "row", overflow: "hidden" },
  bannerContent: { flex: 1, gap: 8 },
  bannerTitle: { fontSize: 20, lineHeight: 28 },
  bannerSub: { fontSize: 13, lineHeight: 20 },
  bannerBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  bannerBtnText: { fontSize: 13 },
  bannerIcon: { position: "absolute", right: -10, bottom: -10 },
  referralCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1 },
  referralIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  referralText: { flex: 1 },
  referralTitle: { fontSize: 15 },
  referralSub: { fontSize: 12, lineHeight: 18, marginTop: 2 },
});
