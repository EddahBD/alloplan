import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, resolveObjectUrl } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  category: string;
  basePrice: number;
  packagesCount: number;
  isActive: boolean;
  description?: string | null;
}

interface PortfolioItem {
  id: number;
  imageUrl: string;
  caption?: string | null;
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
  services: Service[];
  portfolio: PortfolioItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  "Photography", "Decoration", "Catering", "DJ / Music", "Venue", "Transport",
  "Makeup Artist", "MC / Emcee", "Florist", "Event Planning", "Other",
];

// Canonical category values must match the marketplace filter IDs exactly.
// value = stored in DB / sent to API (lowercase); label = display text.
const SERVICE_CATEGORIES: { value: string; label: string }[] = [
  { value: "photography", label: "Photography" },
  { value: "decoration", label: "Decoration" },
  { value: "catering", label: "Catering" },
  { value: "music", label: "Music & DJ" },
  { value: "venue", label: "Venue Hire" },
  { value: "transport", label: "Transport" },
  { value: "makeup", label: "Makeup & Beauty" },
  { value: "mc", label: "MC & Hosting" },
  { value: "florist", label: "Flowers / Florist" },
  { value: "planning", label: "Event Planning" },
  { value: "other", label: "Other" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Uploads an image to object storage.
 * Returns a fully qualified URL the client can use in <Image> components.
 * Throws on any failure — callers must NOT fall back to local URIs.
 */
async function uploadImage(localUri: string, mimeType: string): Promise<string> {
  // 1. Request a presigned PUT URL from the backend
  const { uploadURL, objectPath } = await apiRequest<{ uploadURL: string; objectPath: string }>(
    "/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({ name: "portfolio.jpg", size: 0, contentType: mimeType }),
    },
  );

  // 2. Read the local file as a blob and PUT it to the presigned URL
  const fileResponse = await fetch(localUri);
  if (!fileResponse.ok) throw new Error("Failed to read local image file");
  const blob = await fileResponse.blob();

  const putResponse = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType },
  });
  if (!putResponse.ok) throw new Error(`Storage upload failed (${putResponse.status})`);

  // 3. Set ACL to public so React Native <Image> can render without bearer token
  await apiRequest("/storage/objects/set-acl", {
    method: "POST",
    body: JSON.stringify({ objectPath, visibility: "public" }),
  });

  // 4. Convert objectPath → absolute API URL usable in React Native <Image>
  return resolveObjectUrl(objectPath);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color,
}: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20", borderRadius: 12 }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{label}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VendorDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  // Profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editResponseTime, setEditResponseTime] = useState("");

  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcCategory, setSvcCategory] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDescription, setSvcDescription] = useState("");

  // Package management
  const [managingService, setManagingService] = useState<Service | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgDuration, setPkgDuration] = useState("");
  const [pkgInclusions, setPkgInclusions] = useState("");

  // Portfolio modal
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [portCaption, setPortCaption] = useState("");
  const [portPreviewUri, setPortPreviewUri] = useState("");
  const [portMimeType, setPortMimeType] = useState("image/jpeg");

  // ── Load profile ─────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<VendorProfile>("/vendors/my-profile");
      setProfile(data);
      setIsAvailable(data.isAvailable);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Availability toggle ──────────────────────────────────────────────────

  const toggleAvailability = async (val: boolean) => {
    if (!profile) return;
    setIsAvailable(val);
    try {
      await apiRequest(`/vendors/${profile.id}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: val }),
      });
    } catch {
      setIsAvailable(!val);
    }
  };

  // ── Profile edit ─────────────────────────────────────────────────────────

  const openProfileEdit = () => {
    setEditBusinessName(profile?.businessName ?? "");
    setEditBio(profile?.bio ?? "");
    setEditBusinessType(profile?.businessType ?? "");
    setEditLocation(profile?.location ?? "");
    setEditResponseTime(profile?.responseTime ?? "");
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const data = await apiRequest<VendorProfile>("/vendors/my-profile", {
        method: "PUT",
        body: JSON.stringify({
          businessName: editBusinessName,
          bio: editBio,
          businessType: editBusinessType,
          location: editLocation,
          responseTime: editResponseTime,
        }),
      });
      setProfile(data);
      setShowProfileModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Service CRUD ─────────────────────────────────────────────────────────

  const openAddService = () => {
    setEditingService(null);
    setSvcName(""); setSvcCategory(""); setSvcPrice(""); setSvcDescription("");
    setShowServiceModal(true);
  };

  const openEditService = (s: Service) => {
    setEditingService(s);
    setSvcName(s.name); setSvcCategory(s.category);
    setSvcPrice(String(s.basePrice)); setSvcDescription(s.description ?? "");
    setShowServiceModal(true);
  };

  const saveService = async () => {
    if (!profile) return;
    if (!svcName.trim() || !svcCategory || !svcPrice) {
      Alert.alert("Validation", "Name, category, and price are required.");
      return;
    }
    setSavingService(true);
    try {
      const body = { name: svcName.trim(), category: svcCategory, basePrice: parseFloat(svcPrice), description: svcDescription.trim() || null };
      if (editingService) {
        const updated = await apiRequest<Service>(`/services/${editingService.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setProfile((p) => p ? { ...p, services: p.services.map((s) => s.id === updated.id ? updated : s) } : p);
      } else {
        const created = await apiRequest<Service>(`/vendors/${profile.id}/services`, { method: "POST", body: JSON.stringify(body) });
        setProfile((p) => p ? { ...p, services: [created, ...p.services] } : p);
      }
      setShowServiceModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save service");
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = (service: Service) => {
    Alert.alert("Remove Service", `Remove "${service.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            await apiRequest(`/services/${service.id}`, { method: "DELETE" });
            setProfile((p) => p ? { ...p, services: p.services.filter((s) => s.id !== service.id) } : p);
          } catch { Alert.alert("Error", "Failed to remove service"); }
        },
      },
    ]);
  };

  // ── Package management ───────────────────────────────────────────────────

  const openManagePackages = async (service: Service) => {
    setManagingService(service);
    setPackagesLoading(true);
    setPackages([]);
    try {
      const data = await apiRequest<{ packages: Package[] }>(`/services/${service.id}/packages`);
      setPackages(data.packages);
    } catch { setPackages([]); } finally { setPackagesLoading(false); }
  };

  const openAddPackage = () => {
    setEditingPackage(null);
    setPkgName(""); setPkgDescription(""); setPkgPrice(""); setPkgDuration(""); setPkgInclusions("");
    setShowPackageModal(true);
  };

  const openEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPkgName(pkg.name); setPkgDescription(pkg.description ?? "");
    setPkgPrice(String(pkg.price));
    setPkgDuration(pkg.durationHours ? String(pkg.durationHours) : "");
    setPkgInclusions(pkg.inclusions.join(", "));
    setShowPackageModal(true);
  };

  const savePackage = async () => {
    if (!managingService) return;
    if (!pkgName.trim() || !pkgPrice) {
      Alert.alert("Validation", "Package name and price are required.");
      return;
    }
    setSavingPackage(true);
    try {
      const inclusions = pkgInclusions.split(",").map((s) => s.trim()).filter(Boolean);
      const body = {
        name: pkgName.trim(),
        description: pkgDescription.trim() || null,
        price: parseFloat(pkgPrice),
        inclusions,
        durationHours: pkgDuration ? parseInt(pkgDuration) : null,
      };
      if (editingPackage) {
        const updated = await apiRequest<Package>(`/packages/${editingPackage.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setPackages((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      } else {
        const created = await apiRequest<Package>(`/services/${managingService.id}/packages`, { method: "POST", body: JSON.stringify(body) });
        setPackages((prev) => [created, ...prev]);
        // Update service package count
        setProfile((p) => p ? {
          ...p,
          services: p.services.map((s) => s.id === managingService.id ? { ...s, packagesCount: s.packagesCount + 1 } : s),
        } : p);
      }
      setShowPackageModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save package");
    } finally {
      setSavingPackage(false);
    }
  };

  const deletePackage = (pkg: Package) => {
    Alert.alert("Remove Package", `Remove "${pkg.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            await apiRequest(`/packages/${pkg.id}`, { method: "DELETE" });
            setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
            setProfile((p) => p && managingService ? {
              ...p,
              services: p.services.map((s) => s.id === managingService.id ? { ...s, packagesCount: Math.max(0, s.packagesCount - 1) } : s),
            } : p);
          } catch { Alert.alert("Error", "Failed to remove package"); }
        },
      },
    ]);
  };

  // ── Portfolio upload ─────────────────────────────────────────────────────

  const pickAndUploadPortfolio = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setPortPreviewUri(asset.uri);
    setPortMimeType(asset.mimeType ?? "image/jpeg");
    setShowPortfolioModal(true);
  };

  const savePortfolio = async () => {
    if (!profile) return;
    if (!portPreviewUri) {
      Alert.alert("No image", "Please select an image first.");
      return;
    }
    setUploadingPortfolio(true);
    try {
      // Upload to object storage — returns a fully qualified API URL
      const imageUrl = await uploadImage(portPreviewUri, portMimeType);

      const item = await apiRequest<PortfolioItem>(`/vendors/${profile.id}/portfolio`, {
        method: "POST",
        body: JSON.stringify({ imageUrl, caption: portCaption.trim() || null }),
      });
      setProfile((p) => p ? { ...p, portfolio: [item, ...p.portfolio] } : p);
      setShowPortfolioModal(false);
      setPortPreviewUri(""); setPortCaption("");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to add photo");
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const deletePortfolioItem = (item: PortfolioItem) => {
    Alert.alert("Remove Photo", "Remove this photo from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            await apiRequest(`/portfolio/${item.id}`, { method: "DELETE" });
            setProfile((p) => p ? { ...p, portfolio: p.portfolio.filter((pi) => pi.id !== item.id) } : p);
          } catch { Alert.alert("Error", "Failed to remove photo"); }
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "Vendor";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 }}
      >
        {/* ─ Header ─ */}
        <View style={[styles.header, { backgroundColor: colors.navy, paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[{ color: "rgba(255,255,255,0.7)", fontFamily: "Poppins_400Regular", fontSize: 12 }]}>
                Vendor Dashboard
              </Text>
              <Text style={[{ color: "#fff", fontFamily: "Poppins_700Bold", fontSize: 22 }]}>
                {profile?.businessName || firstName}
              </Text>
            </View>
            <TouchableOpacity
              testID="edit-profile-btn"
              style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={openProfileEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={[styles.availCard, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.availLeft}>
              <View style={[styles.availDot, { backgroundColor: isAvailable ? "#10B981" : "#6B7689" }]} />
              <View>
                <Text style={[{ color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 15 }]}>
                  {isAvailable ? "Taking Bookings" : "Not Available"}
                </Text>
                <Text style={[{ color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular", fontSize: 12, marginTop: 2 }]}>
                  Toggle to control new bookings
                </Text>
              </View>
            </View>
            <Switch
              testID="availability-toggle"
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: "#444", true: "#10B981" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─ Stats ─ */}
        <View style={[styles.statsGrid, { paddingHorizontal: 16, paddingTop: 16 }]}>
          <StatCard label="Rating" value={profile?.rating ? profile.rating.toFixed(1) : "—"} icon="star" color={colors.accent} />
          <StatCard label="Reviews" value={String(profile?.reviewCount ?? 0)} icon="chatbubbles-outline" color="#8B5CF6" />
          <StatCard label="Services" value={String(profile?.services?.length ?? 0)} icon="briefcase-outline" color={colors.primary} />
          <StatCard label="Photos" value={String(profile?.portfolio?.length ?? 0)} icon="images-outline" color="#10B981" />
        </View>

        {/* ─ No profile prompt ─ */}
        {!profile && (
          <View style={[styles.card, { margin: 16, borderColor: colors.primary + "40", backgroundColor: colors.card, gap: 10, alignItems: "center" }]}>
            <Ionicons name="person-circle-outline" size={44} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Set Up Your Vendor Profile</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Create your profile to start receiving bookings.</Text>
            <TouchableOpacity
              testID="setup-profile-btn"
              style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: "row", gap: 8 }]}
              onPress={openProfileEdit}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={[styles.primaryBtnText, { color: "#fff" }]}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─ Profile summary ─ */}
        {profile && (
          <View style={[styles.card, { margin: 16, backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile</Text>
              <TouchableOpacity onPress={openProfileEdit}>
                <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 14 }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            {profile.businessType && <InfoRow icon="briefcase-outline" text={profile.businessType} colors={colors} />}
            {profile.location && <InfoRow icon="location-outline" text={profile.location} colors={colors} />}
            {profile.responseTime && <InfoRow icon="time-outline" text={`Responds in ${profile.responseTime}`} colors={colors} />}
            {profile.bio && (
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 13, lineHeight: 20, marginTop: 4 }]} numberOfLines={3}>
                {profile.bio}
              </Text>
            )}
            <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.primary + "15", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 8 }]}>
              <Ionicons name="trophy-outline" size={14} color={colors.primary} />
              <Text style={[{ color: colors.primary, fontFamily: "Poppins_600SemiBold", fontSize: 12 }]}>
                {((profile.subscriptionTier ?? "basic")[0] ?? "B").toUpperCase() + (profile.subscriptionTier ?? "basic").slice(1)} Plan
              </Text>
            </View>
          </View>
        )}

        {/* ─ Services ─ */}
        <View style={styles.sectionOuter}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Services</Text>
            <TouchableOpacity testID="add-service-btn" onPress={openAddService}>
              <View style={[styles.addBtn, { backgroundColor: colors.secondary }]}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 13 }]}>Add</Text>
              </View>
            </TouchableOpacity>
          </View>
          {!profile || profile.services.length === 0 ? (
            <EmptyCard icon="briefcase-outline" text="No services yet." onAction={openAddService} actionLabel="Add Service" colors={colors} />
          ) : (
            profile.services.map((service) => (
              <View key={service.id} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.itemIcon, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
                  <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: colors.foreground, fontFamily: "Poppins_600SemiBold", fontSize: 14 }]}>{service.name}</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 12 }]}>
                    {service.category} · TZS {service.basePrice.toLocaleString()} · {service.packagesCount} pkg
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`manage-packages-${service.id}`}
                  onPress={() => openManagePackages(service)}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="layers-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity testID={`edit-service-${service.id}`} onPress={() => openEditService(service)} style={{ padding: 6 }}>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-service-${service.id}`} onPress={() => deleteService(service)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ─ Portfolio ─ */}
        <View style={styles.sectionOuter}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Portfolio</Text>
            <TouchableOpacity testID="add-portfolio-btn" onPress={pickAndUploadPortfolio}>
              <View style={[styles.addBtn, { backgroundColor: colors.secondary }]}>
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 13 }]}>Add Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
          {!profile || profile.portfolio.length === 0 ? (
            <EmptyCard icon="images-outline" text="Add photos to showcase your work." onAction={pickAndUploadPortfolio} actionLabel="Add Photo" colors={colors} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                testID="add-portfolio-tile"
                onPress={pickAndUploadPortfolio}
                style={[styles.portAddTile, { borderColor: colors.primary, backgroundColor: colors.secondary, borderRadius: colors.radius }]}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
              {profile.portfolio.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onLongPress={() => deletePortfolioItem(item)}
                  testID={`portfolio-item-${item.id}`}
                  style={[styles.portThumb, { borderRadius: colors.radius, borderColor: colors.border }]}
                >
                  <Image source={{ uri: item.imageUrl }} style={styles.portThumbImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─ Quick actions ─ */}
        <View style={styles.sectionOuter}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Quick Actions</Text>
          {[
            {
              label: "View Public Profile",
              icon: "eye-outline" as const,
              desc: "See how customers see you",
              onPress: () => profile && router.push(`/vendor/${profile.id}` as never),
            },
            {
              label: "Upgrade Plan",
              icon: "trophy-outline" as const,
              desc: "Get more visibility & features",
              onPress: () => Alert.alert("Upgrade Plan", "Subscription plans coming soon! Contact support to upgrade early."),
            },
            {
              label: "Payout Settings",
              icon: "cash-outline" as const,
              desc: "Manage your payment info",
              onPress: () => Alert.alert("Payout Settings", "Payout configuration coming soon."),
            },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              testID={`action-${action.label}`}
              onPress={action.onPress}
              style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <View style={[styles.itemIcon, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
                <Ionicons name={action.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.foreground, fontFamily: "Poppins_600SemiBold", fontSize: 14 }]}>{action.label}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 12, marginTop: 2 }]}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ══ Profile Modal ══ */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <SheetHeader title={profile ? "Edit Profile" : "Create Profile"} onClose={() => setShowProfileModal(false)} colors={colors} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FormField label="Business Name" value={editBusinessName} onChange={setEditBusinessName}
                placeholder="e.g. Amani Photography Studio" colors={colors} testID="business-name-input" />
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Business Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {BUSINESS_TYPES.map((t) => (
                    <ChipBtn key={t} label={t} selected={editBusinessType === t} onPress={() => setEditBusinessType(t)} colors={colors} />
                  ))}
                </ScrollView>
              </View>
              <FormField label="Location / City" value={editLocation} onChange={setEditLocation}
                placeholder="e.g. Dar es Salaam, Tanzania" colors={colors} testID="location-input" />
              <FormField label="Bio / Description" value={editBio} onChange={setEditBio}
                placeholder="Tell customers about your services..." colors={colors} testID="bio-input" multiline />
              <FormField label="Response Time" value={editResponseTime} onChange={setEditResponseTime}
                placeholder="e.g. 1 hour, 24 hours" colors={colors} />
            </ScrollView>
            <SaveBtn onPress={saveProfile} loading={savingProfile} label={profile ? "Save Changes" : "Create Profile"} colors={colors} testID="save-profile-btn" />
          </View>
        </View>
      </Modal>

      {/* ══ Service Modal ══ */}
      <Modal visible={showServiceModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <SheetHeader title={editingService ? "Edit Service" : "Add Service"} onClose={() => setShowServiceModal(false)} colors={colors} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FormField label="Service Name *" value={svcName} onChange={setSvcName}
                placeholder="e.g. Wedding Photography" colors={colors} testID="service-name-input" />
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {SERVICE_CATEGORIES.map((c) => (
                    <ChipBtn key={c.value} label={c.label} selected={svcCategory === c.value} onPress={() => setSvcCategory(c.value)} colors={colors} />
                  ))}
                </ScrollView>
              </View>
              <FormField label="Base Price (TZS) *" value={svcPrice} onChange={setSvcPrice}
                placeholder="e.g. 250000" colors={colors} testID="service-price-input" keyboardType="numeric" />
              <FormField label="Description" value={svcDescription} onChange={setSvcDescription}
                placeholder="Describe what's included..." colors={colors} testID="service-description-input" multiline />
            </ScrollView>
            <SaveBtn onPress={saveService} loading={savingService} label={editingService ? "Save Service" : "Add Service"} colors={colors} testID="save-service-btn" />
          </View>
        </View>
      </Modal>

      {/* ══ Package Management Modal ══ */}
      <Modal visible={!!managingService && !showPackageModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <SheetHeader
              title={`Packages — ${managingService?.name ?? ""}`}
              onClose={() => setManagingService(null)}
              colors={colors}
            />
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 13 }]}>
                {packages.length} package{packages.length !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity testID="add-package-btn" onPress={openAddPackage}>
                <View style={[styles.addBtn, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 13 }]}>Add Package</Text>
                </View>
              </TouchableOpacity>
            </View>
            {packagesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : packages.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Ionicons name="layers-outline" size={32} color={colors.border} />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 13 }]}>
                  No packages yet. Add pricing tiers for this service.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {packages.map((pkg) => (
                  <View key={pkg.id} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginBottom: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: colors.foreground, fontFamily: "Poppins_600SemiBold", fontSize: 14 }]}>{pkg.name}</Text>
                      <Text style={[{ color: colors.primary, fontFamily: "Poppins_600SemiBold", fontSize: 13 }]}>
                        TZS {pkg.price.toLocaleString()}
                        {pkg.durationHours ? ` · ${pkg.durationHours}h` : ""}
                      </Text>
                      {pkg.inclusions.length > 0 && (
                        <Text style={[{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 11, marginTop: 2 }]} numberOfLines={2}>
                          {pkg.inclusions.join(" · ")}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity testID={`edit-package-${pkg.id}`} onPress={() => openEditPackage(pkg)} style={{ padding: 6 }}>
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity testID={`delete-package-${pkg.id}`} onPress={() => deletePackage(pkg)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ Package Add/Edit Modal ══ */}
      <Modal visible={showPackageModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <SheetHeader title={editingPackage ? "Edit Package" : "Add Package"} onClose={() => setShowPackageModal(false)} colors={colors} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FormField label="Package Name *" value={pkgName} onChange={setPkgName}
                placeholder="e.g. Gold Package" colors={colors} testID="package-name-input" />
              <FormField label="Price (TZS) *" value={pkgPrice} onChange={setPkgPrice}
                placeholder="e.g. 500000" colors={colors} testID="package-price-input" keyboardType="numeric" />
              <FormField label="Description" value={pkgDescription} onChange={setPkgDescription}
                placeholder="Describe what this package includes..." colors={colors} testID="package-description-input" multiline />
              <FormField label="Duration (hours)" value={pkgDuration} onChange={setPkgDuration}
                placeholder="e.g. 8" colors={colors} keyboardType="numeric" />
              <FormField label="Inclusions (comma-separated)" value={pkgInclusions} onChange={setPkgInclusions}
                placeholder="e.g. 200 edited photos, USB, online gallery" colors={colors} testID="package-inclusions-input" multiline />
            </ScrollView>
            <SaveBtn onPress={savePackage} loading={savingPackage} label={editingPackage ? "Save Package" : "Add Package"} colors={colors} testID="save-package-btn" />
          </View>
        </View>
      </Modal>

      {/* ══ Portfolio Upload Modal ══ */}
      <Modal visible={showPortfolioModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <SheetHeader title="Add Portfolio Photo" onClose={() => { setShowPortfolioModal(false); setPortPreviewUri(""); setPortCaption(""); }} colors={colors} />
            <View style={{ flex: 1, gap: 12 }}>
              {portPreviewUri ? (
                <TouchableOpacity onPress={pickAndUploadPortfolio}>
                  <Image source={{ uri: portPreviewUri }} style={[styles.portPreviewLarge, { borderRadius: colors.radius }]} resizeMode="cover" />
                  <View style={[styles.changePhotoOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={[{ color: "#fff", fontFamily: "Poppins_500Medium", fontSize: 12 }]}>Change Photo</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="pick-image-btn"
                  onPress={pickAndUploadPortfolio}
                  style={[styles.portPickerPlaceholder, { borderColor: colors.primary, backgroundColor: colors.secondary, borderRadius: colors.radius }]}
                >
                  <Ionicons name="camera-outline" size={36} color={colors.primary} />
                  <Text style={[{ color: colors.primary, fontFamily: "Poppins_500Medium", fontSize: 14, marginTop: 8 }]}>
                    Choose from Library
                  </Text>
                </TouchableOpacity>
              )}
              <FormField label="Caption (optional)" value={portCaption} onChange={setPortCaption}
                placeholder="Describe this photo..." colors={colors} testID="portfolio-caption-input" />
            </View>
            <SaveBtn
              onPress={savePortfolio}
              loading={uploadingPortfolio}
              label={uploadingPortfolio ? "Uploading…" : "Add to Portfolio"}
              colors={colors}
              testID="save-portfolio-btn"
              disabled={!portPreviewUri}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function InfoRow({ icon, text, colors }: { icon: keyof typeof Ionicons.glyphMap; text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={15} color={colors.mutedForeground} />
      <Text style={{ color: colors.foreground, fontFamily: "Poppins_400Regular", fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function EmptyCard({ icon, text, onAction, actionLabel, colors }: {
  icon: keyof typeof Ionicons.glyphMap; text: string; onAction: () => void; actionLabel: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Ionicons name={icon} size={36} color={colors.border} />
      <Text style={{ color: colors.mutedForeground, fontFamily: "Poppins_400Regular", fontSize: 13, textAlign: "center" }}>{text}</Text>
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]} onPress={onAction}>
        <Text style={[styles.primaryBtnText, { color: "#fff" }]}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ChipBtn({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
        backgroundColor: selected ? colors.primary : colors.card,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: selected ? "#fff" : colors.foreground, fontFamily: "Poppins_400Regular", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormField({ label, value, onChange, placeholder, colors, testID, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; testID?: string; multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && styles.inputMulti, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

function SheetHeader({ title, onClose, colors }: { title: string; onClose: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sheetHeader}>
      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
      <TouchableOpacity onPress={onClose}>
        <Ionicons name="close" size={24} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

function SaveBtn({ onPress, loading, label, colors, testID, disabled }: {
  onPress: () => void; loading: boolean; label: string; colors: ReturnType<typeof useColors>;
  testID?: string; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 8 }, (loading || disabled) && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.primaryBtnText, { color: "#fff" }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  availCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12 },
  availLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  statCard: { flex: 1, minWidth: "44%", padding: 14, alignItems: "center", gap: 6, borderWidth: 1 },
  statIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 8 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 17, textAlign: "center" },
  cardSub: { fontFamily: "Poppins_400Regular", fontSize: 13, textAlign: "center" },
  sectionOuter: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 17 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1 },
  itemIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  portAddTile: { width: 80, height: 80, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed" },
  portThumb: { width: 80, height: 80, borderWidth: 1, overflow: "hidden" },
  portThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  portPreviewLarge: { width: "100%", height: 200, position: "relative" },
  portPickerPlaceholder: { height: 180, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed" },
  changePhotoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  emptyCard: { padding: 24, alignItems: "center", gap: 10, borderWidth: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontFamily: "Poppins_700Bold", fontSize: 20 },
  formGroup: { gap: 8, marginBottom: 12 },
  fieldLabel: { fontFamily: "Poppins_500Medium", fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputMulti: { minHeight: 100 },
  primaryBtn: { paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { fontFamily: "Poppins_700Bold", fontSize: 16 },
});
