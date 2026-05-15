import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/hooks/useApi";

interface VendorCard {
  id: number;
  businessName?: string | null;
  businessType?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount: number;
  verified: boolean;
  subscriptionTier: string;
  coverImage?: string | null;
  ownerName: string;
  isFeatured: boolean;
  isTopRated: boolean;
}

interface Service {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  basePrice: number;
  images: string[];
}

interface PackageDetail {
  id: number;
  serviceId: number;
  name: string;
  description?: string | null;
  price: number;
  inclusions: string[];
  durationHours?: number | null;
  isActive: boolean;
  service: Service;
  vendor: VendorCard;
}

export default function PackageDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: vendorId, packageId } = useLocalSearchParams<{ id: string; packageId: string }>();
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const data = await apiRequest<PackageDetail>(`/packages/${packageId}`);
      setPkg(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!pkg) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.border} />
        <Text style={[styles.errorText, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          Package not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtnFull, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[{ color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const vendor = pkg.vendor;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 + 34 : insets.bottom + 120 }}
      >
        {/* Vendor cover / hero */}
        <View style={styles.heroWrapper}>
          {vendor?.coverImage ? (
            <Image source={{ uri: vendor.coverImage }} style={styles.heroCover} />
          ) : (
            <LinearGradient colors={["#0D1B2A", "#1E3A5F"]} style={styles.heroCover} />
          )}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.heroOverlay} />

          {/* Back button */}
          <TouchableOpacity
            testID="back-btn"
            style={[styles.backBtn, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 }]}
            onPress={() => router.back()}
          >
            <View style={styles.backBtnCircle}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Package name overlay */}
          <View style={styles.heroContent}>
            <View style={[styles.categoryTag, { backgroundColor: colors.primary }]}>
              <Text style={[styles.categoryTagText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                {pkg.service.category}
              </Text>
            </View>
            <Text style={[styles.packageName, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
              {pkg.name}
            </Text>
            <Text style={[styles.packageServiceName, { color: "rgba(255,255,255,0.8)", fontFamily: "Poppins_400Regular" }]}>
              {pkg.service.name}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Price card */}
          <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                Package Price
              </Text>
              <Text style={[styles.price, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
                TZS {pkg.price.toLocaleString()}
              </Text>
            </View>
            {pkg.durationHours && (
              <View style={[styles.durationBadge, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={[styles.durationText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                  {pkg.durationHours}h
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {pkg.description && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                About This Package
              </Text>
              <Text style={[styles.description, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
                {pkg.description}
              </Text>
            </View>
          )}

          {/* Inclusions */}
          {pkg.inclusions.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                What's Included
              </Text>
              {pkg.inclusions.map((item, idx) => (
                <View key={idx} style={styles.inclusionRow}>
                  <View style={[styles.inclusionCheck, { backgroundColor: "#10B98120" }]}>
                    <Ionicons name="checkmark" size={14} color="#10B981" />
                  </View>
                  <Text style={[styles.inclusionText, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Vendor card */}
          {vendor && (
            <TouchableOpacity
              testID="vendor-card-link"
              onPress={() => router.push(`/vendor/${vendor.id}` as never)}
              style={[styles.vendorCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <View style={styles.vendorCardHeader}>
                <Text style={[styles.vendorCardLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  Provided by
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </View>
              <View style={styles.vendorCardBody}>
                <View style={[styles.vendorAvatar, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
                  {vendor.coverImage ? (
                    <Image source={{ uri: vendor.coverImage }} style={styles.vendorAvatarImg} />
                  ) : (
                    <Ionicons name="storefront-outline" size={24} color={colors.primary} />
                  )}
                </View>
                <View style={styles.vendorInfo}>
                  <View style={styles.vendorNameRow}>
                    <Text style={[styles.vendorName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                      {vendor.businessName || vendor.ownerName}
                    </Text>
                    {vendor.verified && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    )}
                    {vendor.isTopRated && (
                      <View style={[styles.topBadge, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.topBadgeText, { color: "#0D1B2A", fontFamily: "Poppins_600SemiBold" }]}>Top</Text>
                      </View>
                    )}
                  </View>
                  {vendor.businessType && (
                    <Text style={[styles.vendorType, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                      {vendor.businessType}
                    </Text>
                  )}
                  {vendor.location && (
                    <View style={styles.vendorLocation}>
                      <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.vendorLocationText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {vendor.location}
                      </Text>
                    </View>
                  )}
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color={colors.accent} />
                    <Text style={[styles.ratingText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                      {vendor.rating ? vendor.rating.toFixed(1) : "New"}
                    </Text>
                    <Text style={[styles.reviewCount, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                      ({vendor.reviewCount} reviews)
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 8 }]}>
        <View style={styles.ctaPrice}>
          <Text style={[styles.ctaPriceLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>Total</Text>
          <Text style={[styles.ctaPriceValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            TZS {pkg.price.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          testID="book-now-btn"
          style={[styles.bookBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={[styles.bookBtnText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
            Book Now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 18 },
  backBtnFull: { paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  heroWrapper: { height: 220, position: "relative" },
  heroCover: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 140 },
  backBtn: { position: "absolute", top: 0, left: 16, paddingBottom: 12 },
  backBtnCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  heroContent: { position: "absolute", bottom: 20, left: 20, right: 20, gap: 6 },
  categoryTag: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  categoryTagText: { fontSize: 11 },
  packageName: { fontSize: 22, lineHeight: 30 },
  packageServiceName: { fontSize: 13 },
  content: { padding: 16, gap: 12 },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderWidth: 1 },
  priceLabel: { fontSize: 12 },
  price: { fontSize: 26, marginTop: 2 },
  durationBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  durationText: { fontSize: 15 },
  section: { padding: 16, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 16 },
  description: { fontSize: 14, lineHeight: 22 },
  inclusionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  inclusionCheck: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1 },
  inclusionText: { flex: 1, fontSize: 14, lineHeight: 22 },
  vendorCard: { padding: 14, borderWidth: 1, gap: 10 },
  vendorCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  vendorCardLabel: { fontSize: 12 },
  vendorCardBody: { flexDirection: "row", gap: 12 },
  vendorAvatar: { width: 56, height: 56, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  vendorAvatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  vendorInfo: { flex: 1, gap: 4 },
  vendorNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  vendorName: { flex: 1, fontSize: 15 },
  topBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  topBadgeText: { fontSize: 9 },
  vendorType: { fontSize: 12 },
  vendorLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  vendorLocationText: { fontSize: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13 },
  reviewCount: { fontSize: 12 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, gap: 16 },
  ctaPrice: { gap: 2 },
  ctaPriceLabel: { fontSize: 12 },
  ctaPriceValue: { fontSize: 20 },
  bookBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  bookBtnText: { fontSize: 16 },
});
