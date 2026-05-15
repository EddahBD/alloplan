import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

const CATEGORIES = [
  "photography", "decoration", "catering", "music", "venue",
  "transport", "makeup", "mc", "florist",
];

const SORT_OPTIONS = [
  { id: "rating", label: "Top Rated" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "newest", label: "Newest" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any" },
  { value: "3", label: "3+ ★" },
  { value: "4", label: "4+ ★" },
  { value: "4.5", label: "4.5+ ★" },
];

const TANZANIA_CITIES = [
  "Dar es Salaam", "Arusha", "Mwanza", "Dodoma",
  "Mbeya", "Tanga", "Morogoro", "Zanzibar", "Kilimanjaro",
];

interface VendorCard {
  id: number;
  businessName?: string | null;
  bio?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  subscriptionTier: string;
  coverImage?: string | null;
  isAvailable: boolean;
  ownerName: string;
  isFeatured: boolean;
  isTopRated: boolean;
  minPrice?: number | null;
}

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSort, setSelectedSort] = useState("rating");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [location, setLocation] = useState("");

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const search = useCallback(async () => {
    const hasTextQuery = debouncedQuery || selectedCategory || location;
    const hasFilter = minRating || minPrice || maxPrice || onlyAvailable;
    if (!hasTextQuery && !hasFilter) {
      setVendors([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy: selectedSort, limit: "30" });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (onlyAvailable) params.set("available", "true");
      if (minRating) params.set("minRating", minRating);
      if (location) params.set("location", location);

      const data = await apiRequest<{ vendors: VendorCard[] }>(`/vendors?${params.toString()}`);
      setVendors(data.vendors);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedCategory, selectedSort, minPrice, maxPrice, onlyAvailable, minRating, location]);

  useEffect(() => {
    search();
  }, [debouncedQuery, selectedCategory, selectedSort, onlyAvailable, minRating, location]);

  const clearFilters = () => {
    setSelectedCategory("");
    setMinPrice("");
    setMaxPrice("");
    setOnlyAvailable(false);
    setSelectedSort("rating");
    setMinRating("");
    setLocation("");
  };

  const activeFilterCount = [selectedCategory, minPrice, maxPrice, minRating, location, onlyAvailable].filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}
              placeholder="Search vendors, services, locations..."
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={search}
              testID="search-input"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            testID="filter-btn"
            style={[styles.filterBtn, {
              backgroundColor: activeFilterCount > 0 ? colors.primary : colors.card,
              borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
            }]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? "#fff" : colors.foreground} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: "#fff" }]}>
                <Text style={[styles.filterBadgeText, { color: colors.primary }]}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active filter chips */}
        {(selectedCategory || onlyAvailable || minRating || location) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {selectedCategory && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.secondary, borderColor: colors.primary }]} onPress={() => setSelectedCategory("")}>
                <Text style={[styles.activeChipText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>{selectedCategory}</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </TouchableOpacity>
            )}
            {minRating && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.secondary, borderColor: colors.primary }]} onPress={() => setMinRating("")}>
                <Ionicons name="star" size={11} color={colors.primary} />
                <Text style={[styles.activeChipText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>{minRating}+</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </TouchableOpacity>
            )}
            {location && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.secondary, borderColor: colors.primary }]} onPress={() => setLocation("")}>
                <Ionicons name="location-outline" size={11} color={colors.primary} />
                <Text style={[styles.activeChipText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>{location}</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </TouchableOpacity>
            )}
            {onlyAvailable && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.secondary, borderColor: colors.primary }]} onPress={() => setOnlyAvailable(false)}>
                <Text style={[styles.activeChipText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Available</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* Results */}
      <FlatList
        data={vendors}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`search-result-${item.id}`}
            activeOpacity={0.85}
            onPress={() => router.push(`/vendor/${item.id}` as never)}
            style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <View style={[styles.resultCover, { borderRadius: colors.radius }]}>
              {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={styles.resultCoverImg} />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="storefront-outline" size={24} color={colors.primary} />
                </View>
              )}
            </View>
            <View style={styles.resultBody}>
              <View style={styles.resultHeader}>
                <Text style={[styles.resultName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]} numberOfLines={1}>
                  {item.businessName || item.ownerName}
                </Text>
                {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                {item.isTopRated && (
                  <View style={[styles.topRatedBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.topRatedText, { color: "#0D1B2A", fontFamily: "Poppins_600SemiBold" }]}>⭐ Top</Text>
                  </View>
                )}
              </View>
              {item.businessType && (
                <Text style={[styles.resultType, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{item.businessType}</Text>
              )}
              <View style={styles.resultMeta}>
                {item.location && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{item.location}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={11} color={colors.accent} />
                  <Text style={[styles.metaText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                    {item.rating ? item.rating.toFixed(1) : "New"} ({item.reviewCount})
                  </Text>
                </View>
              </View>
              {item.minPrice && (
                <Text style={[styles.priceText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                  From TZS {item.minPrice.toLocaleString()}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={(() => {
          const hasAny = debouncedQuery || selectedCategory || location || minRating || minPrice || maxPrice || onlyAvailable;
          if (!loading && hasAny) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={52} color={colors.border} />
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                  No results found
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  Try a different search term or adjust your filters
                </Text>
              </View>
            );
          }
          if (!hasAny) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={52} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  Search for vendors, services, or locations
                </Text>
              </View>
            );
          }
          return null;
        })()}
        ListHeaderComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      />

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.filterSheet, { backgroundColor: colors.background }]}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>Filters</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={[styles.clearText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category */}
              <Text style={[styles.filterLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                    style={[styles.categoryChip, {
                      backgroundColor: selectedCategory === cat ? colors.primary : colors.card,
                      borderColor: selectedCategory === cat ? colors.primary : colors.border,
                    }]}
                  >
                    <Text style={[styles.categoryChipText, {
                      color: selectedCategory === cat ? "#fff" : colors.foreground,
                      fontFamily: "Poppins_500Medium",
                    }]}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Location */}
              <Text style={[styles.filterLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Location</Text>
              <View style={[styles.locationInput, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Ionicons name="location-outline" size={16} color={colors.mutedForeground} />
                <TextInput
                  testID="location-filter-input"
                  style={[styles.locationTextInput, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}
                  placeholder="e.g. Dar es Salaam"
                  placeholderTextColor={colors.mutedForeground}
                  value={location}
                  onChangeText={setLocation}
                />
                {location.length > 0 && (
                  <TouchableOpacity onPress={() => setLocation("")}>
                    <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
                {TANZANIA_CITIES.map((city) => (
                  <TouchableOpacity
                    key={city}
                    testID={`city-chip-${city}`}
                    onPress={() => setLocation(location === city ? "" : city)}
                    style={[styles.categoryChip, {
                      backgroundColor: location === city ? colors.primary : colors.card,
                      borderColor: location === city ? colors.primary : colors.border,
                    }]}
                  >
                    <Text style={[styles.categoryChipText, {
                      color: location === city ? "#fff" : colors.foreground,
                      fontFamily: "Poppins_400Regular",
                    }]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Minimum Rating */}
              <Text style={[styles.filterLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Minimum Rating</Text>
              <View style={styles.ratingRow}>
                {RATING_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    testID={`rating-option-${opt.value}`}
                    onPress={() => setMinRating(opt.value)}
                    style={[
                      styles.ratingChip,
                      {
                        backgroundColor: minRating === opt.value ? colors.primary : colors.card,
                        borderColor: minRating === opt.value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {opt.value && <Ionicons name="star" size={12} color={minRating === opt.value ? "#fff" : colors.accent} />}
                    <Text style={[styles.ratingChipText, {
                      color: minRating === opt.value ? "#fff" : colors.foreground,
                      fontFamily: minRating === opt.value ? "Poppins_600SemiBold" : "Poppins_400Regular",
                    }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort */}
              <Text style={[styles.filterLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Sort By</Text>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.sortRow, selectedSort === opt.id && { backgroundColor: colors.secondary }]}
                  onPress={() => setSelectedSort(opt.id)}
                >
                  <Text style={[styles.sortRowText, { color: colors.foreground, fontFamily: selectedSort === opt.id ? "Poppins_600SemiBold" : "Poppins_400Regular" }]}>
                    {opt.label}
                  </Text>
                  {selectedSort === opt.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}

              {/* Price Range */}
              <Text style={[styles.filterLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Price Range (TZS)</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.priceInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="Min"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
                <Text style={{ color: colors.mutedForeground }}>—</Text>
                <TextInput
                  style={[styles.priceInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="Max"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>

              {/* Availability */}
              <View style={[styles.availRow, { borderColor: colors.border }]}>
                <Text style={[styles.availText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Available Now Only</Text>
                <Switch
                  testID="available-toggle"
                  value={onlyAvailable}
                  onValueChange={setOnlyAvailable}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              testID="apply-filters-btn"
              style={[styles.applyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => { setShowFilters(false); search(); }}
            >
              <Text style={[styles.applyBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Apply Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 4 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14 },
  filterBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  filterBadge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { fontSize: 9 },
  chipRow: { gap: 8, paddingHorizontal: 2 },
  chipRowH: { gap: 8, marginBottom: 8 },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  activeChipText: { fontSize: 12 },
  listContent: { padding: 16, gap: 12 },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 10 },
  resultCover: { width: 72, height: 72, overflow: "hidden" },
  resultCoverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  resultBody: { flex: 1, gap: 3 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  resultName: { flex: 1, fontSize: 14 },
  topRatedBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  topRatedText: { fontSize: 9 },
  resultType: { fontSize: 12 },
  resultMeta: { gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  priceText: { fontSize: 12 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  loader: { marginTop: 32 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  filterSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "92%", gap: 16 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filterTitle: { fontSize: 20 },
  clearText: { fontSize: 14 },
  filterLabel: { fontSize: 15, marginTop: 16, marginBottom: 10 },
  locationInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, gap: 8, marginBottom: 10 },
  locationTextInput: { flex: 1, fontSize: 14 },
  ratingRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  ratingChipText: { fontSize: 13 },
  categoryChipRow: { gap: 8, marginBottom: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  categoryChipText: { fontSize: 13 },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, marginBottom: 4 },
  sortRowText: { fontSize: 14 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  priceInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  availRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1, marginTop: 8 },
  availText: { fontSize: 14 },
  applyBtn: { paddingVertical: 14, alignItems: "center", marginTop: 16 },
  applyBtnText: { fontSize: 16 },
});
