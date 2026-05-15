import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "recently_viewed_vendors";
const MAX_ITEMS = 8;

export interface RecentVendor {
  id: number;
  businessName: string | null;
  businessType: string | null;
  location: string | null;
  rating: number | null;
  coverImage: string | null;
  subscriptionTier: string;
  isAvailable: boolean;
  viewedAt: number;
}

async function readList(): Promise<RecentVendor[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentVendor[]) : [];
  } catch {
    return [];
  }
}

export async function saveRecentlyViewed(vendor: Omit<RecentVendor, "viewedAt">): Promise<void> {
  try {
    const list = await readList();
    const filtered = list.filter((v) => v.id !== vendor.id);
    const updated = [{ ...vendor, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Best-effort; never throw
  }
}

export function useRecentlyViewed() {
  const [vendors, setVendors] = useState<RecentVendor[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const list = await readList();
    setVendors(list);
    setLoaded(true);
  }, []);

  return { vendors, loaded, load };
}
