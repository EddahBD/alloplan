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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  "Photography", "Decoration", "Catering", "DJ / Music", "Venue", "Transport",
  "Makeup Artist", "MC / Emcee", "Florist", "Event Planning", "Other",
];

const SERVICE_CATEGORIES = [
  "Photography", "Decoration", "Catering", "Music & DJ", "Venue Hire",
  "Transport", "Makeup & Beauty", "MC & Hosting", "Flowers", "Planning", "Other",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  // Profile edit modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editResponseTime, setEditResponseTime] = useState("");

  // Service add/edit modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcCategory, setSvcCategory] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcDescription, setSvcDescription] = useState("");

  // Portfolio add modal
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [savingPortfolio, setSavingPortfolio] = useState(false);
  const [portImageUrl, setPortImageUrl] = useState("");
  const [portCaption, setPortCaption] = useState("");

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
    setSvcName("");
    setSvcCategory("");
    setSvcPrice("");
    setSvcDescription("");
    setShowServiceModal(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setSvcName(service.name);
    setSvcCategory(service.category);
    setSvcPrice(String(service.basePrice));
    setSvcDescription(service.description ?? "");
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
      const body = {
        name: svcName.trim(),
        category: svcCategory,
        basePrice: parseFloat(svcPrice),
        description: svcDescription.trim() || null,
      };
      if (editingService) {
        // PATCH existing service
        const updated = await apiRequest<Service>(`/services/${editingService.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                services: prev.services.map((s) =>
                  s.id === updated.id ? updated : s,
                ),
              }
            : prev,
        );
      } else {
        // POST new service
        const created = await apiRequest<Service>(`/vendors/${profile.id}/services`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setProfile((prev) =>
          prev ? { ...prev, services: [created, ...prev.services] } : prev,
        );
      }
      setShowServiceModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save service");
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (service: Service) => {
    Alert.alert(
      "Remove Service",
      `Remove "${service.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/services/${service.id}`, { method: "DELETE" });
              setProfile((prev) =>
                prev
                  ? { ...prev, services: prev.services.filter((s) => s.id !== service.id) }
                  : prev,
              );
            } catch {
              Alert.alert("Error", "Failed to remove service");
            }
          },
        },
      ],
    );
  };

  // ── Portfolio CRUD ───────────────────────────────────────────────────────

  const openAddPortfolio = () => {
    setPortImageUrl("");
    setPortCaption("");
    setShowPortfolioModal(true);
  };

  const savePortfolio = async () => {
    if (!profile) return;
    if (!portImageUrl.trim()) {
      Alert.alert("Validation", "Please enter an image URL.");
      return;
    }
    setSavingPortfolio(true);
    try {
      const item = await apiRequest<PortfolioItem>(`/vendors/${profile.id}/portfolio`, {
        method: "POST",
        body: JSON.stringify({
          imageUrl: portImageUrl.trim(),
          caption: portCaption.trim() || null,
        }),
      });
      setProfile((prev) =>
        prev ? { ...prev, portfolio: [item, ...prev.portfolio] } : prev,
      );
      setShowPortfolioModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to add photo");
    } finally {
      setSavingPortfolio(false);
    }
  };

  const deletePortfolioItem = (item: PortfolioItem) => {
    Alert.alert("Remove Photo", "Remove this photo from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/portfolio/${item.id}`, { method: "DELETE" });
            setProfile((prev) =>
              prev
                ? { ...prev, portfolio: prev.portfolio.filter((p) => p.id !== item.id) }
                : prev,
            );
          } catch {
            Alert.alert("Error", "Failed to remove photo");
          }
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
              <Text style={[styles.headerGreeting, { color: "rgba(255,255,255,0.7)", fontFamily: "Poppins_400Regular" }]}>
                Vendor Dashboard
              </Text>
              <Text style={[styles.headerName, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
                {profile?.businessName || firstName}
              </Text>
            </View>
            <TouchableOpacity
              testID="edit-profile-btn"
              style={[styles.editBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={openProfileEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.availCard, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.availLeft}>
              <View style={[styles.availDot, { backgroundColor: isAvailable ? "#10B981" : "#6B7689" }]} />
              <View>
                <Text style={[styles.availTitle, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  {isAvailable ? "Taking Bookings" : "Not Available"}
                </Text>
                <Text style={[styles.availSubtitle, { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular" }]}>
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
          <StatCard label="Portfolio" value={String(profile?.portfolio?.length ?? 0)} icon="images-outline" color="#10B981" />
        </View>

        {/* ─ No profile prompt ─ */}
        {!profile && (
          <View style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radius, margin: 16 }]}>
            <Ionicons name="person-circle-outline" size={44} color={colors.primary} />
            <Text style={[styles.setupTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Set Up Your Vendor Profile
            </Text>
            <Text style={[styles.setupText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Create your profile to start receiving bookings and showcase your services.
            </Text>
            <TouchableOpacity
              testID="setup-profile-btn"
              style={[styles.setupBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={openProfileEdit}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={[styles.setupBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Create Profile
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─ Profile summary ─ */}
        {profile && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, margin: 16 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Profile</Text>
              <TouchableOpacity onPress={openProfileEdit}>
                <Text style={[styles.editLink, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            {profile.businessType && (
              <View style={styles.profileRow}>
                <Ionicons name="briefcase-outline" size={15} color={colors.mutedForeground} />
                <Text style={[styles.profileValue, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>{profile.businessType}</Text>
              </View>
            )}
            {profile.location && (
              <View style={styles.profileRow}>
                <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
                <Text style={[styles.profileValue, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>{profile.location}</Text>
              </View>
            )}
            {profile.responseTime && (
              <View style={styles.profileRow}>
                <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                <Text style={[styles.profileValue, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
                  Responds in {profile.responseTime}
                </Text>
              </View>
            )}
            {profile.bio && (
              <Text style={[styles.profileBio, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]} numberOfLines={3}>
                {profile.bio}
              </Text>
            )}
            <View style={[styles.tierBadge, { backgroundColor: colors.primary + "15", borderRadius: 8, marginTop: 8 }]}>
              <Ionicons name="trophy-outline" size={14} color={colors.primary} />
              <Text style={[styles.tierText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                {(profile.subscriptionTier ?? "basic").charAt(0).toUpperCase() + (profile.subscriptionTier ?? "basic").slice(1)} Plan
              </Text>
            </View>
          </View>
        )}

        {/* ─ Services ─ */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>My Services</Text>
            <TouchableOpacity testID="add-service-btn" onPress={openAddService}>
              <View style={[styles.addBtn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Add</Text>
              </View>
            </TouchableOpacity>
          </View>
          {!profile || profile.services.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Ionicons name="briefcase-outline" size={36} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                No services yet. Add your first service!
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                onPress={openAddService}
              >
                <Text style={[styles.emptyActionText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Add Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            profile.services.map((service) => (
              <View key={service.id} style={[styles.serviceItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.serviceIconBox, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
                  <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={[styles.serviceName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>{service.name}</Text>
                  <Text style={[styles.serviceMeta, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                    {service.category} · TZS {service.basePrice.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`edit-service-${service.id}`}
                  onPress={() => openEditService(service)}
                  style={styles.serviceAction}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`delete-service-${service.id}`}
                  onPress={() => deleteService(service)}
                  style={styles.serviceAction}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ─ Portfolio ─ */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Portfolio</Text>
            <TouchableOpacity testID="add-portfolio-btn" onPress={openAddPortfolio}>
              <View style={[styles.addBtn, { backgroundColor: colors.secondary, borderRadius: 8 }]}>
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>Add Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
          {!profile || profile.portfolio.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Ionicons name="images-outline" size={36} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                Add photos to showcase your work
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                onPress={openAddPortfolio}
              >
                <Text style={[styles.emptyActionText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>Add Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioRow}>
              {/* Add tile */}
              <TouchableOpacity
                testID="add-portfolio-tile"
                onPress={openAddPortfolio}
                style={[styles.portfolioAddTile, { borderColor: colors.primary, borderRadius: colors.radius, backgroundColor: colors.secondary }]}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </TouchableOpacity>
              {profile.portfolio.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onLongPress={() => deletePortfolioItem(item)}
                  testID={`portfolio-item-${item.id}`}
                  style={[styles.portfolioThumb, { borderRadius: colors.radius, overflow: "hidden", borderColor: colors.border }]}
                >
                  <Image source={{ uri: item.imageUrl }} style={styles.portfolioThumbImg} />
                  <View style={[styles.portDeleteHint, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
                    <Ionicons name="trash-outline" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─ Quick actions ─ */}
        <View style={styles.sectionOuter}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold", marginBottom: 12 }]}>Quick Actions</Text>
          {[
            { label: "View Public Profile", icon: "eye-outline" as const, desc: "See how customers see you" },
            { label: "Upgrade Plan", icon: "trophy-outline" as const, desc: "Get more visibility & features" },
            { label: "Payout Settings", icon: "cash-outline" as const, desc: "Manage your payment info" },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              testID={`action-${action.label}`}
              style={[styles.actionItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
                <Ionicons name={action.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>{action.label}</Text>
                <Text style={[styles.actionDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════
          Profile Edit Modal
      ══════════════════════════════════════════ */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {profile ? "Edit Profile" : "Create Profile"}
              </Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FormField label="Business Name" value={editBusinessName} onChange={setEditBusinessName}
                placeholder="e.g. Amani Photography Studio" colors={colors} testID="business-name-input" />
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Business Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
                  {BUSINESS_TYPES.map((type) => (
                    <TouchableOpacity key={type} onPress={() => setEditBusinessType(type)}
                      style={[styles.typeChip, {
                        backgroundColor: editBusinessType === type ? colors.primary : colors.card,
                        borderColor: editBusinessType === type ? colors.primary : colors.border,
                      }]}>
                      <Text style={[styles.typeChipText, {
                        color: editBusinessType === type ? "#fff" : colors.foreground,
                        fontFamily: "Poppins_400Regular",
                      }]}>{type}</Text>
                    </TouchableOpacity>
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
            <ModalSaveButton onPress={saveProfile} loading={savingProfile} label={profile ? "Save Changes" : "Create Profile"} colors={colors} testID="save-profile-btn" />
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════
          Service Add / Edit Modal
      ══════════════════════════════════════════ */}
      <Modal visible={showServiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {editingService ? "Edit Service" : "Add Service"}
              </Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FormField label="Service Name *" value={svcName} onChange={setSvcName}
                placeholder="e.g. Wedding Photography" colors={colors} testID="service-name-input" />
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <TouchableOpacity key={cat} onPress={() => setSvcCategory(cat)}
                      style={[styles.typeChip, {
                        backgroundColor: svcCategory === cat ? colors.primary : colors.card,
                        borderColor: svcCategory === cat ? colors.primary : colors.border,
                      }]}>
                      <Text style={[styles.typeChipText, {
                        color: svcCategory === cat ? "#fff" : colors.foreground,
                        fontFamily: "Poppins_400Regular",
                      }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <FormField label="Base Price (TZS) *" value={svcPrice} onChange={setSvcPrice}
                placeholder="e.g. 250000" colors={colors} testID="service-price-input" keyboardType="numeric" />
              <FormField label="Description" value={svcDescription} onChange={setSvcDescription}
                placeholder="Describe what's included..." colors={colors} testID="service-description-input" multiline />
            </ScrollView>
            <ModalSaveButton
              onPress={saveService}
              loading={savingService}
              label={editingService ? "Save Service" : "Add Service"}
              colors={colors}
              testID="save-service-btn"
            />
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════
          Portfolio Add Modal
      ══════════════════════════════════════════ */}
      <Modal visible={showPortfolioModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                Add Portfolio Photo
              </Text>
              <TouchableOpacity onPress={() => setShowPortfolioModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <FormField label="Image URL *" value={portImageUrl} onChange={setPortImageUrl}
                placeholder="https://example.com/photo.jpg" colors={colors} testID="portfolio-url-input" />
              {portImageUrl.startsWith("http") && (
                <Image source={{ uri: portImageUrl }} style={[styles.portPreview, { borderRadius: colors.radius }]} resizeMode="cover" />
              )}
              <FormField label="Caption (optional)" value={portCaption} onChange={setPortCaption}
                placeholder="Describe this photo..." colors={colors} testID="portfolio-caption-input" />
              <Text style={[styles.portHint, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                Paste the URL of a photo that showcases your work. Native photo upload is available in the full app.
              </Text>
            </View>
            <ModalSaveButton onPress={savePortfolio} loading={savingPortfolio} label="Add to Portfolio" colors={colors} testID="save-portfolio-btn" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Shared form helpers ──────────────────────────────────────────────────────

function FormField({
  label, value, onChange, placeholder, colors, testID, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  testID?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>{label}</Text>
      <TextInput
        testID={testID}
        style={[
          styles.input,
          multiline && styles.textArea,
          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" },
        ]}
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

function ModalSaveButton({
  onPress, loading, label, colors, testID,
}: {
  onPress: () => void;
  loading: boolean;
  label: string;
  colors: ReturnType<typeof useColors>;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.saveBtnText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerGreeting: { fontSize: 12 },
  headerName: { fontSize: 22 },
  editBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  availCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12 },
  availLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availTitle: { fontSize: 15 },
  availSubtitle: { fontSize: 12, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  statCard: { flex: 1, minWidth: "44%", padding: 14, alignItems: "center", gap: 6, borderWidth: 1 },
  statIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
  setupCard: { padding: 24, alignItems: "center", gap: 10, borderWidth: 1 },
  setupTitle: { fontSize: 17, textAlign: "center" },
  setupText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  setupBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  setupBtnText: { fontSize: 14 },
  sectionCard: { padding: 16, borderWidth: 1, gap: 8 },
  sectionOuter: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17 },
  editLink: { fontSize: 14 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: 13 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileValue: { fontSize: 14 },
  profileBio: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5 },
  tierText: { fontSize: 12 },
  emptyCard: { padding: 24, alignItems: "center", gap: 10, borderWidth: 1 },
  emptyText: { fontSize: 13, textAlign: "center" },
  emptyActionBtn: { paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyActionText: { fontSize: 13 },
  serviceItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1 },
  serviceIconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1, gap: 3 },
  serviceName: { fontSize: 14 },
  serviceMeta: { fontSize: 12 },
  serviceAction: { padding: 6 },
  portfolioRow: { gap: 8 },
  portfolioAddTile: { width: 80, height: 80, alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed" },
  portfolioThumb: { width: 80, height: 80, borderWidth: 1, position: "relative" },
  portfolioThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  portDeleteHint: { position: "absolute", bottom: 3, right: 3, borderRadius: 4, padding: 3 },
  portPreview: { height: 140, width: "100%", marginTop: 4 },
  portHint: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  actionIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 14 },
  actionDesc: { fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "92%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 20 },
  formGroup: { gap: 8, marginBottom: 12 },
  formLabel: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textArea: { minHeight: 100 },
  typeChips: { gap: 8, paddingVertical: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  typeChipText: { fontSize: 13 },
  saveBtn: { paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16 },
});
