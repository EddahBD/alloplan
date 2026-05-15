import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

const CATEGORIES = [
  { id: "all", label: "All", icon: "grid-outline" as const },
  { id: "photography", label: "Photography", icon: "camera-outline" as const },
  { id: "decoration", label: "Decoration", icon: "color-palette-outline" as const },
  { id: "catering", label: "Catering", icon: "restaurant-outline" as const },
  { id: "music", label: "DJ / Music", icon: "musical-notes-outline" as const },
  { id: "venue", label: "Venues", icon: "location-outline" as const },
  { id: "transport", label: "Transport", icon: "car-outline" as const },
  { id: "makeup", label: "Makeup", icon: "brush-outline" as const },
  { id: "mc", label: "MC", icon: "mic-outline" as const },
  { id: "florist", label: "Florist", icon: "flower-outline" as const },
];

const SORT_OPTIONS = [
  { id: "rating", label: "Top Rated" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "newest", label: "Newest" },
];

interface VendorCard {
  id: number;
  userId: number;
  businessName?: string | null;
  bio?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  subscriptionTier: "basic" | "pro" | "premium";
  coverImage?: string | null;
  isAvailable: boolean;
  ownerName: string;
  isFeatured: boolean;
  isTopRated: boolean;
  minPrice?: number | null;
}

function VendorCardItem({ vendor, colors }: { vendor: VendorCard; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      testID={`vendor-card-${vendor.id}`}
      activeOpacity={0.88}
      onPress={() => router.push(`/vendor/${vendor.id}` as never)}
      style={[styles.vendorCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      {/* Cover Image */}
      <View style={[styles.coverContainer, { borderRadius: colors.radius }]}>
        {vendor.coverImage ? (
          <Image source={{ uri: vendor.coverImage }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="storefront-outline" size={36} color={colors.primary} />
          </View>
        )}
        {/* Badges */}
        <View style={styles.badgeRow}>
          {vendor.isTopRated && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Ionicons name="star" size={10} color="#0D1B2A" />
              <Text style={[styles.badgeText, { color: "#0D1B2A", fontFamily: "Poppins_600SemiBold" }]}>Top Rated</Text>
            </View>
          )}
          {vendor.isFeatured && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Ionicons name="sparkles" size={10} color="#fff" />
              <Text style={[styles.badgeText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Featured</Text>
            </View>
          )}
          {vendor.subscriptionTier !== "basic" && (
            <View style={[styles.badge, {
              backgroundColor: vendor.subscriptionTier === "premium" ? "#7C3AED" : "#1E3A5F",
            }]}>
              <Ionicons name="trophy" size={10} color="#fff" />
              <Text style={[styles.badgeText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                {vendor.subscriptionTier === "premium" ? "Premium" : "Pro"}
              </Text>
            </View>
          )}
        </View>
        {/* Availability */}
        <View style={[styles.availabilityDot, { backgroundColor: vendor.isAvailable ? "#10B981" : "#6B7689" }]} />
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.vendorName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]} numberOfLines={1}>
            {vendor.businessName || vendor.ownerName}
          </Text>
          {vendor.verified && (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          )}
        </View>
        {vendor.businessType && (
          <Text style={[styles.vendorType, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]} numberOfLines={1}>
            {vendor.businessType}
          </Text>
        )}
        <View style={styles.cardFooter}>
          {vendor.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]} numberOfLines={1}>
                {vendor.location}
              </Text>
            </View>
          )}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text style={[styles.ratingText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
              {vendor.rating ? vendor.rating.toFixed(1) : "New"}
            </Text>
            {vendor.reviewCount > 0 && (
              <Text style={[styles.reviewCount, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                ({vendor.reviewCount})
              </Text>
            )}
          </View>
        </View>
        {vendor.minPrice && (
          <Text style={[styles.priceText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
            From TZS {vendor.minPrice.toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [showSort, setShowSort] = useState(false);
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<VendorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const fetchVendors = useCallback(async (reset = false) => {
    const currentPage = reset ? 1 : page;
    if (!reset && loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        page: String(currentPage),
        limit: "20",
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (activeCategory !== "all") params.set("category", activeCategory);

      const data = await apiRequest<{ vendors: VendorCard[]; total: number; hasMore: boolean }>(
        `/vendors?${params.toString()}`
      );
      if (reset) {
        setVendors(data.vendors);
        setPage(2);
      } else {
        setVendors((prev) => [...prev, ...data.vendors]);
        setPage((p) => p + 1);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [activeCategory, debouncedQuery, sortBy, page, loading]);

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await apiRequest<{ vendors: VendorCard[] }>("/vendors/featured?limit=6");
      setFeaturedVendors(data.vendors);
    } catch {}
  }, []);

  useEffect(() => {
    setPage(1);
    setVendors([]);
    fetchVendors(true);
    fetchFeatured();
  }, [activeCategory, debouncedQuery, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setVendors([]);
    await Promise.all([fetchVendors(true), fetchFeatured()]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Marketplace
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              testID="map-view-btn"
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/vendor-map" as never)}
            >
              <Ionicons name="map-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="sort-btn"
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowSort(!showSort)}
            >
              <Ionicons name="options-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort dropdown */}
        {showSort && (
          <View style={[styles.sortDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortOption, sortBy === opt.id && { backgroundColor: colors.secondary }]}
                onPress={() => { setSortBy(opt.id); setShowSort(false); }}
              >
                <Text style={[styles.sortOptionText, { color: sortBy === opt.id ? colors.primary : colors.foreground, fontFamily: sortBy === opt.id ? "Poppins_600SemiBold" : "Poppins_400Regular" }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search bar */}
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.searchBar, { backgroundColor: colors.muted, borderRadius: colors.radius }]}
          onPress={() => router.push("/search" as never)}
          testID="search-bar"
        >
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Search vendors, services...
          </Text>
        </TouchableOpacity>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                testID={`category-${cat.id}`}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: 999,
                  },
                ]}
              >
                <Ionicons name={cat.icon} size={14} color={active ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.categoryLabel, { color: active ? "#fff" : colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={vendors}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {/* Featured Vendors */}
            {featuredVendors.length > 0 && (
              <View style={styles.featuredSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                    Featured Vendors
                  </Text>
                  <View style={[styles.featuredBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Ionicons name="sparkles" size={12} color={colors.primary} />
                    <Text style={[styles.featuredBadgeText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Pro</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
                  {featuredVendors.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      testID={`featured-vendor-${v.id}`}
                      activeOpacity={0.88}
                      onPress={() => router.push(`/vendor/${v.id}` as never)}
                      style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                    >
                      <View style={[styles.featuredCover, { borderRadius: colors.radius }]}>
                        {v.coverImage ? (
                          <Image source={{ uri: v.coverImage }} style={styles.featuredCoverImg} />
                        ) : (
                          <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                          </View>
                        )}
                      </View>
                      <View style={styles.featuredBody}>
                        <Text style={[styles.featuredName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]} numberOfLines={1}>
                          {v.businessName || v.ownerName}
                        </Text>
                        {v.location && (
                          <Text style={[styles.featuredLocation, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]} numberOfLines={1}>
                            {v.location}
                          </Text>
                        )}
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={11} color={colors.accent} />
                          <Text style={[styles.ratingText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                            {v.rating ? v.rating.toFixed(1) : "New"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Results header */}
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {total > 0 ? `${total} vendor${total !== 1 ? "s" : ""}` : loading ? "" : "No vendors found"}
              </Text>
              <Text style={[styles.sortLabel, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => <VendorCardItem vendor={item} colors={colors} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={56} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                No vendors yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {debouncedQuery || activeCategory !== "all"
                  ? "Try adjusting your search or filters"
                  : "Be the first to list your services!"}
              </Text>
              <TouchableOpacity
                style={[styles.listBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                testID="become-vendor"
              >
                <Text style={[styles.listBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  List Your Services
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : hasMore ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchVendors()}>
              <Text style={[styles.loadMoreText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                Load more
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 26 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sortDropdown: { borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  sortOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  sortOptionText: { fontSize: 14 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 44 },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  categoriesRow: { gap: 8, paddingRight: 4 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  categoryLabel: { fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  vendorCard: { flex: 1, borderWidth: 1, overflow: "hidden" },
  coverContainer: { position: "relative", height: 120, overflow: "hidden" },
  coverImage: { width: "100%", height: "100%", resizeMode: "cover" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  badgeRow: { position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 4, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 9 },
  availabilityDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  cardBody: { padding: 10, gap: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  vendorName: { flex: 1, fontSize: 13 },
  vendorType: { fontSize: 11 },
  cardFooter: { gap: 3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 10, flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12 },
  reviewCount: { fontSize: 11 },
  priceText: { fontSize: 11, marginTop: 2 },
  featuredSection: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16 },
  featuredBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  featuredBadgeText: { fontSize: 11 },
  featuredRow: { gap: 12, paddingRight: 4 },
  featuredCard: { width: 160, borderWidth: 1, overflow: "hidden" },
  featuredCover: { height: 90, overflow: "hidden" },
  featuredCoverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  featuredBody: { padding: 10, gap: 3 },
  featuredName: { fontSize: 13 },
  featuredLocation: { fontSize: 11 },
  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  resultsCount: { fontSize: 12 },
  sortLabel: { fontSize: 12 },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  listBtn: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  listBtnText: { fontSize: 14 },
  footer: { paddingVertical: 20 },
  loadMoreBtn: { alignItems: "center", paddingVertical: 16 },
  loadMoreText: { fontSize: 14 },
});
