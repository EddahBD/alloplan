import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const TRANSACTION_TYPES = ["All", "Credits", "Debits"];

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: string;
  reference: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [];

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeType, setActiveType] = useState(0);

  const filtered = MOCK_TRANSACTIONS.filter((t) => {
    if (activeType === 1) return t.type === "credit";
    if (activeType === 2) return t.type === "debit";
    return true;
  });

  const handleTopUp = () => {
    Alert.alert(
      "Top Up Wallet",
      "Mobile money (M-Pesa, Tigo Pesa, Airtel Money) and card top-up coming soon!",
      [{ text: "OK" }]
    );
  };

  const handleWithdraw = () => {
    Alert.alert(
      "Withdraw Funds",
      "Withdrawal to mobile money and bank accounts coming soon!",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Balance Card */}
      <LinearGradient
        colors={[colors.navy, colors.navyLight]}
        style={[
          styles.balanceCard,
          { paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16 },
        ]}
      >
        <Text style={[styles.balanceLabel, { color: "rgba(255,255,255,0.6)", fontFamily: "Poppins_400Regular" }]}>
          Available Balance
        </Text>
        <Text style={[styles.balanceAmount, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>
          TZS 0.00
        </Text>
        <View style={[styles.pendingRow]}>
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={[styles.pendingText, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
            Pending: TZS 0.00
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleTopUp}
            testID="wallet-topup"
            style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              Top Up
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleWithdraw}
            testID="wallet-withdraw"
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: colors.radius }]}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats row */}
      <View style={[styles.statsRow, { paddingHorizontal: 20, marginTop: 16 }]}>
        {[
          { label: "Total Earned", value: "TZS 0", icon: "trending-up-outline" as const, color: colors.success },
          { label: "Total Spent", value: "TZS 0", icon: "trending-down-outline" as const, color: colors.destructive },
          { label: "Referral Bonus", value: "TZS 0", icon: "gift-outline" as const, color: colors.accent },
        ].map((stat) => (
          <View
            key={stat.label}
            style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
          >
            <Ionicons name={stat.icon} size={18} color={stat.color} />
            <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Transactions header */}
      <View style={[styles.txHeader, { paddingHorizontal: 20, marginTop: 20 }]}>
        <Text style={[styles.txTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          Transactions
        </Text>
        <View style={[styles.typeRow, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          {TRANSACTION_TYPES.map((type, i) => (
            <TouchableOpacity
              key={type}
              testID={`tx-type-${type.toLowerCase()}`}
              onPress={() => setActiveType(i)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: activeType === i ? colors.card : "transparent",
                  borderRadius: 8,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  {
                    color: activeType === i ? colors.primary : colors.mutedForeground,
                    fontFamily: activeType === i ? "Poppins_600SemiBold" : "Poppins_400Regular",
                  },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transaction list / empty state */}
      <ScrollView
        contentContainerStyle={[
          styles.txList,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 100 },
        ]}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
              <Ionicons name="receipt-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              No Transactions Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Your wallet transactions will appear here once you make a booking or receive referral earnings.
            </Text>
            <TouchableOpacity
              onPress={handleTopUp}
              style={[styles.topUpBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              testID="wallet-topup-empty"
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={[styles.topUpBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                Top Up Wallet
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((tx) => (
            <View
              key={tx.id}
              style={[styles.txItem, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            >
              <View style={[styles.txIcon, { backgroundColor: tx.type === "credit" ? colors.success + "18" : colors.destructive + "18", borderRadius: 12 }]}>
                <Ionicons
                  name={tx.type === "credit" ? "arrow-down-circle" : "arrow-up-circle"}
                  size={22}
                  color={tx.type === "credit" ? colors.success : colors.destructive}
                />
              </View>
              <View style={styles.txContent}>
                <Text style={[styles.txDesc, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                  {tx.description}
                </Text>
                <Text style={[styles.txDate, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  {tx.date} · {tx.reference}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color: tx.type === "credit" ? colors.success : colors.destructive,
                    fontFamily: "Poppins_700Bold",
                  },
                ]}
              >
                {tx.type === "credit" ? "+" : "-"}TZS {tx.amount.toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  balanceCard: { paddingHorizontal: 20, paddingBottom: 24, gap: 6 },
  balanceLabel: { fontSize: 13 },
  balanceAmount: { fontSize: 36 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pendingText: { fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  actionBtnText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", gap: 4, padding: 12, borderWidth: 1 },
  statValue: { fontSize: 13 },
  statLabel: { fontSize: 10, textAlign: "center" },
  txHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  txTitle: { fontSize: 17 },
  typeRow: { flexDirection: "row", padding: 3, gap: 2 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5 },
  typeChipText: { fontSize: 12 },
  txList: { paddingHorizontal: 20, gap: 10 },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 32 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 13, lineHeight: 22, textAlign: "center" },
  topUpBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  topUpBtnText: { fontSize: 14 },
  txItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  txIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  txContent: { flex: 1 },
  txDesc: { fontSize: 14 },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14 },
});
