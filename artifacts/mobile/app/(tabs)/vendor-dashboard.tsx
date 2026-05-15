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
  services: Array<{
    id: number;
    name: string;
    category: string;
    basePrice: number;
    packagesCount: number;
    isActive: boolean;
  }>;
  portfolio: Array<{
    id: number;
    imageUrl: string;
    caption?: string | null;
  }>;
}

const BUSINESS_TYPES = [
  "Photography", "Decoration", "Catering", "DJ / Music", "Venue", "Transport",
  "Makeup Artist", "MC / Emcee", "Florist", "Event Planning", "Other",
];

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
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

export default function VendorDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editBusinessName, setEditBusinessName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editResponseTime, setEditResponseTime] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<VendorProfile>("/vendors/my-profile");
      setProfile(data);
      setIsAvailable(data.isAvailable);
      setEditBusinessName(data.businessName ?? "");
      setEditBio(data.bio ?? "");
      setEditBusinessType(data.businessType ?? "");
      setEditLocation(data.location ?? "");
      setEditResponseTime(data.responseTime ?? "");
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

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

  const saveProfile = async () => {
    setSaving(true);
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
      setShowEditModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (profile) {
      setEditBusinessName(profile.businessName ?? "");
      setEditBio(profile.bio ?? "");
      setEditBusinessType(profile.businessType ?? "");
      setEditLocation(profile.location ?? "");
      setEditResponseTime(profile.responseTime ?? "");
    }
    setShowEditModal(true);
  };

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
        {/* Header */}
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
              onPress={openEdit}
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
                  Toggle to control bookings
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

        {/* Stats */}
        <View style={[styles.statsGrid, { paddingHorizontal: 16, paddingTop: 16 }]}>
          <StatCard label="Rating" value={profile?.rating ? profile.rating.toFixed(1) : "—"} icon="star" color={colors.accent} />
          <StatCard label="Reviews" value={String(profile?.reviewCount ?? 0)} icon="chatbubbles-outline" color="#8B5CF6" />
          <StatCard label="Services" value={String(profile?.services?.length ?? 0)} icon="briefcase-outline" color={colors.primary} />
          <StatCard label="Portfolio" value={String(profile?.portfolio?.length ?? 0)} icon="images-outline" color="#10B981" />
        </View>

        {/* Profile setup prompt */}
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
              onPress={openEdit}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={[styles.setupBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Create Profile
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile summary */}
        {profile && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, margin: 16 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Profile</Text>
              <TouchableOpacity onPress={openEdit}>
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

        {/* Services */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>My Services</Text>
            <TouchableOpacity testID="add-service-btn">
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
                    {service.category} · TZS {service.basePrice.toLocaleString()} · {service.packagesCount} pkg
                  </Text>
                </View>
                <View style={[styles.activeTag, { backgroundColor: service.isActive ? "#10B98120" : colors.muted }]}>
                  <Text style={[styles.activeTagText, { color: service.isActive ? "#10B981" : colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                    {service.isActive ? "Active" : "Off"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Portfolio */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>Portfolio</Text>
            <TouchableOpacity testID="add-portfolio-btn">
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
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioRow}>
              {profile.portfolio.slice(0, 8).map((item) => (
                <View key={item.id} style={[styles.portfolioThumb, { borderRadius: colors.radius, overflow: "hidden", borderColor: colors.border }]}>
                  <Image source={{ uri: item.imageUrl }} style={styles.portfolioThumbImg} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Quick actions */}
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

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                {profile ? "Edit Profile" : "Create Profile"}
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Business Name</Text>
                <TextInput
                  testID="business-name-input"
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="e.g. Amani Photography Studio"
                  placeholderTextColor={colors.mutedForeground}
                  value={editBusinessName}
                  onChangeText={setEditBusinessName}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Business Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
                  {BUSINESS_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setEditBusinessType(type)}
                      style={[styles.typeChip, {
                        backgroundColor: editBusinessType === type ? colors.primary : colors.card,
                        borderColor: editBusinessType === type ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.typeChipText, {
                        color: editBusinessType === type ? "#fff" : colors.foreground,
                        fontFamily: "Poppins_400Regular",
                      }]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Location / City</Text>
                <TextInput
                  testID="location-input"
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="e.g. Dar es Salaam, Tanzania"
                  placeholderTextColor={colors.mutedForeground}
                  value={editLocation}
                  onChangeText={setEditLocation}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Bio / Description</Text>
                <TextInput
                  testID="bio-input"
                  style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="Tell customers about your services, experience..."
                  placeholderTextColor={colors.mutedForeground}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>Response Time</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, fontFamily: "Poppins_400Regular" }]}
                  placeholder="e.g. 1 hour, 24 hours"
                  placeholderTextColor={colors.mutedForeground}
                  value={editResponseTime}
                  onChangeText={setEditResponseTime}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              testID="save-profile-btn"
              style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, saving && { opacity: 0.7 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
                  {profile ? "Save Changes" : "Create Profile"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  serviceItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  serviceIconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  serviceInfo: { flex: 1, gap: 3 },
  serviceName: { fontSize: 14 },
  serviceMeta: { fontSize: 12 },
  activeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeTagText: { fontSize: 11 },
  portfolioRow: { gap: 8 },
  portfolioThumb: { width: 80, height: 80, borderWidth: 1 },
  portfolioThumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
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
