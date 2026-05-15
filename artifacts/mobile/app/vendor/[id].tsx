import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  FlatList,
  Modal,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";
import { saveRecentlyViewed } from "@/hooks/useRecentlyViewed";

interface PortfolioItem {
  id: number;
  imageUrl: string;
  caption?: string | null;
  eventType?: string | null;
}

interface Package {
  id: number;
  serviceId: number;
  name: string;
  description?: string | null;
  price: number;
  inclusions: string[];
  durationHours?: number | null;
  isActive: boolean;
}

interface Service {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  basePrice: number;
  images: string[];
  packagesCount: number;
}

interface ReviewSummary {
  id: number;
  rating: number;
  comment?: string | null;
  reviewerName: string;
  createdAt: string;
}

interface VendorProfile {
  id: number;
  userId: number;
  businessName?: string | null;
  bio?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  subscriptionTier: string;
  coverImage?: string | null;
  responseTime?: string | null;
  isAvailable: boolean;
  ownerName: string;
  ownerProfileImage?: string | null;
  isFeatured: boolean;
  isTopRated: boolean;
  services: Service[];
  portfolio: PortfolioItem[];
  recentReviews: ReviewSummary[];
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={rating >= s ? "star" : rating >= s - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color={colors.accent}
        />
      ))}
    </View>
  );
}

export default function VendorProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"services" | "portfolio" | "reviews">("services");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [servicePackages, setServicePackages] = useState<Record<number, Package[]>>({});
  const [expandedService, setExpandedService] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiRequest<VendorProfile>(`/vendors/${id}`);
      setVendor(data);
      // Persist to recently viewed (best-effort, non-blocking)
      saveRecentlyViewed({
        id: data.id,
        businessName: data.businessName ?? null,
        businessType: data.businessType ?? null,
        location: data.location ?? null,
        rating: data.rating ?? null,
        coverImage: data.coverImage ?? null,
        subscriptionTier: data.subscriptionTier ?? "basic",
        isAvailable: data.isAvailable ?? true,
      });
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadPackages = async (serviceId: number) => {
    if (servicePackages[serviceId]) {
      setExpandedService(expandedService === serviceId ? null : serviceId);
      return;
    }
    try {
      const data = await apiRequest<{ packages: Package[] }>(`/services/${serviceId}/packages`);
      setServicePackages((prev) => ({ ...prev, [serviceId]: data.packages }));
      setExpandedService(serviceId);
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.border} />
        <Text style={[styles.errorText, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Vendor not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtnFull, { backgroundColor: colors.primary }]}>
          <Text style={[{ color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabs = [
    { id: "services" as const, label: "Services", count: vendor.services.length },
    { id: "portfolio" as const, label: "Portfolio", count: vendor.portfolio.length },
    { id: "reviews" as const, label: "Reviews", count: vendor.reviewCount },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <View style={styles.coverWrapper}>
          {vendor.coverImage ? (
            <Image source={{ uri: vendor.coverImage }} style={styles.cover} />
          ) : (
            <LinearGradient colors={["#0D1B2A", "#1E3A5F"]} style={styles.cover}>
              <Ionicons name="storefront-outline" size={64} color="rgba(255,255,255,0.2)" />
            </LinearGradient>
          )}
          {/* Back button */}
          <TouchableOpacity
            testID="back-btn"
            onPress={() => router.back()}
            style={[styles.backBtn, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 }]}
          >
            <View style={styles.backBtnCircle}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            style={styles.coverOverlay}
          />
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Badges row */}
          <View style={styles.badgesRow}>
            {vendor.isTopRated && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Ionicons name="star" size={11} color="#0D1B2A" />
                <Text style={[styles.badgeText, { color: "#0D1B2A", fontFamily: "Poppins_600SemiBold" }]}>Top Rated</Text>
              </View>
            )}
            {vendor.isFeatured && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={11} color="#fff" />
                <Text style={[styles.badgeText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Featured</Text>
              </View>
            )}
            {vendor.verified && (
              <View style={[styles.badge, { backgroundColor: "#10B98120" }]}>
                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                <Text style={[styles.badgeText, { color: "#10B981", fontFamily: "Poppins_600SemiBold" }]}>Verified</Text>
              </View>
            )}
            <View style={[styles.availBadge, { backgroundColor: vendor.isAvailable ? "#10B98120" : colors.muted }]}>
              <View style={[styles.availDot, { backgroundColor: vendor.isAvailable ? "#10B981" : colors.mutedForeground }]} />
              <Text style={[styles.availText, { color: vendor.isAvailable ? "#10B981" : colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                {vendor.isAvailable ? "Available" : "Unavailable"}
              </Text>
            </View>
          </View>

          {/* Name & type */}
          <Text style={[styles.businessName, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            {vendor.businessName || vendor.ownerName}
          </Text>
          {vendor.businessType && (
            <Text style={[styles.businessType, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {vendor.businessType}
            </Text>
          )}

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {vendor.rating ? vendor.rating.toFixed(1) : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>Rating</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {vendor.reviewCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>Reviews</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {vendor.services.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>Services</Text>
            </View>
          </View>

          {/* Location & response time */}
          <View style={styles.metaRow}>
            {vendor.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  {vendor.location}
                </Text>
              </View>
            )}
            {vendor.responseTime && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  Responds in {vendor.responseTime}
                </Text>
              </View>
            )}
          </View>

          {/* Bio */}
          {vendor.bio && (
            <Text style={[styles.bio, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
              {vendor.bio}
            </Text>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              testID="contact-vendor-btn"
              style={[styles.actionBtn, styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="share-vendor-btn"
              style={[styles.actionBtn, styles.outlineBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.primary : colors.mutedForeground, fontFamily: activeTab === tab.id ? "Poppins_600SemiBold" : "Poppins_400Regular" }]}>
                {tab.label}
                {tab.count > 0 && ` (${tab.count})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {/* Services */}
          {activeTab === "services" && (
            <View style={styles.section}>
              {vendor.services.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="briefcase-outline" size={40} color={colors.border} />
                  <Text style={[styles.emptyTabText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                    No services listed yet
                  </Text>
                </View>
              ) : (
                vendor.services.map((service) => (
                  <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TouchableOpacity onPress={() => loadPackages(service.id)} style={styles.serviceHeader}>
                      <View style={[styles.serviceIcon, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
                        <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.serviceInfo}>
                        <Text style={[styles.serviceName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                          {service.name}
                        </Text>
                        <Text style={[styles.serviceCategory, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                          {service.category} · From TZS {service.basePrice.toLocaleString()}
                        </Text>
                        {service.packagesCount > 0 && (
                          <Text style={[styles.packagesHint, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                            {service.packagesCount} package{service.packagesCount !== 1 ? "s" : ""} available
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={expandedService === service.id ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </TouchableOpacity>
                    {service.description && (
                      <Text style={[styles.serviceDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {service.description}
                      </Text>
                    )}

                    {/* Packages */}
                    {expandedService === service.id && servicePackages[service.id] && (
                      <View style={styles.packagesContainer}>
                        {servicePackages[service.id].length === 0 ? (
                          <Text style={[styles.noPackagesText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                            No packages yet
                          </Text>
                        ) : (
                          servicePackages[service.id].map((pkg) => (
                            <TouchableOpacity
                              key={pkg.id}
                              testID={`package-${pkg.id}`}
                              onPress={() => router.push(`/vendor/${id}/package/${pkg.id}` as never)}
                              style={[styles.packageChip, { backgroundColor: colors.secondary, borderColor: colors.primary + "40", borderRadius: 10 }]}
                            >
                              <View style={styles.packageChipHeader}>
                                <Text style={[styles.packageName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                                  {pkg.name}
                                </Text>
                                <Text style={[styles.packagePrice, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
                                  TZS {pkg.price.toLocaleString()}
                                </Text>
                              </View>
                              {pkg.durationHours && (
                                <Text style={[styles.packageDuration, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                                  {pkg.durationHours}h coverage
                                </Text>
                              )}
                              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* Portfolio */}
          {activeTab === "portfolio" && (
            <View style={styles.section}>
              {vendor.portfolio.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="images-outline" size={40} color={colors.border} />
                  <Text style={[styles.emptyTabText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                    No portfolio photos yet
                  </Text>
                </View>
              ) : (
                <View style={styles.portfolioGrid}>
                  {vendor.portfolio.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      testID={`portfolio-item-${item.id}`}
                      onPress={() => setLightboxImage(item.imageUrl)}
                      style={[styles.portfolioItem, { borderRadius: colors.radius, overflow: "hidden" }]}
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.portfolioImg} />
                      {item.caption && (
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.6)"]}
                          style={styles.portfolioOverlay}
                        >
                          <Text style={[styles.portfolioCaption, { fontFamily: "Poppins_400Regular" }]} numberOfLines={1}>
                            {item.caption}
                          </Text>
                        </LinearGradient>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Reviews */}
          {activeTab === "reviews" && (
            <View style={styles.section}>
              {/* Rating summary */}
              {vendor.rating && (
                <View style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.ratingBig, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                    {vendor.rating.toFixed(1)}
                  </Text>
                  <View style={styles.ratingStars}>
                    <StarRating rating={vendor.rating} size={16} />
                    <Text style={[styles.ratingCount, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                      {vendor.reviewCount} review{vendor.reviewCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              )}

              {vendor.recentReviews.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="star-outline" size={40} color={colors.border} />
                  <Text style={[styles.emptyTabText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                    No reviews yet
                  </Text>
                </View>
              ) : (
                vendor.recentReviews.map((review) => (
                  <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewerAvatar, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.reviewerInitial, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
                          {review.reviewerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.reviewerInfo}>
                        <Text style={[styles.reviewerName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                          {review.reviewerName}
                        </Text>
                        <StarRating rating={review.rating} size={12} />
                      </View>
                      <Text style={[styles.reviewDate, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {new Date(review.createdAt).toLocaleDateString("en-TZ", { month: "short", day: "numeric" })}
                      </Text>
                    </View>
                    {review.comment && (
                      <Text style={[styles.reviewComment, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
                        {review.comment}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Lightbox */}
      <Modal visible={!!lightboxImage} transparent animationType="fade">
        <Pressable style={styles.lightbox} onPress={() => setLightboxImage(null)}>
          {lightboxImage && (
            <Image source={{ uri: lightboxImage }} style={styles.lightboxImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={[styles.lightboxClose, { top: insets.top + 16 }]} onPress={() => setLightboxImage(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 18 },
  backBtnFull: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  coverWrapper: { height: 240, position: "relative" },
  cover: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  backBtn: { position: "absolute", top: 0, left: 16, paddingBottom: 12 },
  backBtnCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  coverOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  profileCard: { marginHorizontal: 16, marginTop: -16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10 },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 11 },
  businessName: { fontSize: 22 },
  businessType: { fontSize: 13 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  statItem: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 30 },
  metaRow: { gap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13 },
  bio: { fontSize: 13, lineHeight: 22 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { flex: 1, justifyContent: "center" },
  outlineBtn: { borderWidth: 1.5, paddingHorizontal: 14 },
  actionBtnText: { fontSize: 15 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginTop: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13 },
  tabContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { gap: 12 },
  emptyTab: { alignItems: "center", paddingTop: 32, gap: 10 },
  emptyTabText: { fontSize: 14 },
  serviceCard: { borderWidth: 1, padding: 14, gap: 8 },
  serviceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1, gap: 2 },
  serviceName: { fontSize: 15 },
  serviceCategory: { fontSize: 12 },
  packagesHint: { fontSize: 11 },
  serviceDesc: { fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
  packagesContainer: { gap: 8, paddingTop: 4 },
  noPackagesText: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  packageChip: { padding: 12, borderWidth: 1, gap: 4 },
  packageChipHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  packageName: { fontSize: 14, flex: 1 },
  packagePrice: { fontSize: 14 },
  packageDuration: { fontSize: 12 },
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portfolioItem: { width: "48%", aspectRatio: 1, position: "relative" },
  portfolioImg: { width: "100%", height: "100%" },
  portfolioOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 6 },
  portfolioCaption: { color: "#fff", fontSize: 10 },
  ratingCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderWidth: 1, marginBottom: 4 },
  ratingBig: { fontSize: 40 },
  ratingStars: { gap: 6 },
  ratingCount: { fontSize: 12, marginTop: 4 },
  reviewCard: { borderWidth: 1, padding: 14, gap: 10 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  reviewerInitial: { fontSize: 18 },
  reviewerInfo: { flex: 1, gap: 4 },
  reviewerName: { fontSize: 14 },
  reviewDate: { fontSize: 11 },
  reviewComment: { fontSize: 13, lineHeight: 20 },
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", right: 16 },
});
