import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {API_BASE_URL} from "../config";

const API_BASE = API_BASE_URL;

type LocationPick = { lat: number; lng: number; address: string };

export default function LocationPickerScreen({ route, navigation }: any) {
  const initialLat = route?.params?.lat ?? 29.6516;
  const initialLng = route?.params?.lng ?? -82.3248;

  const onPick =
    (route?.params?.onPick as ((loc: LocationPick) => void) | undefined) ??
    undefined;

  const [search, setSearch] = useState(route?.params?.address ?? "");
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [loading, setLoading] = useState(false);

  const searchAddress = async () => {
    if (!search.trim()) return;
    try {
      setLoading(true);
      const url = `${API_BASE}/geocode?address=${encodeURIComponent(
        search.trim()
      )}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.log("Geocode failed:", res.status);
        return;
      }

      const data = await res.json();
      // { formatted_address, lat, lng }
      setLat(data.lat);
      setLng(data.lng);
      setSearch(data.formatted_address);
    } catch (e) {
      console.log("Geocode error", e);
    } finally {
      setLoading(false);
    }
  };

  const onUseLocation = () => {
    const loc: LocationPick = {
      lat,
      lng,
      address: search || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };

    onPick?.(loc);
    navigation.goBack();
  };

  // #AIGEN
  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search address"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={searchAddress}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Go</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Fallback instead of map */}
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>
          Map view isn’t available on web in this build.
        </Text>
        <Text style={styles.webFallbackText}>
          Use the search bar above to pick a location, then press{" "}
          &quot;Use this location&quot;.
        </Text>
        <Text style={styles.webFallbackText}>
          Current coords: {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      </View>

      <TouchableOpacity style={styles.useBtn} onPress={onUseLocation}>
        <Text style={styles.useBtnText}>Use this location</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fff",
    alignItems: "center",
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  searchBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
  },
  webFallbackText: {
    textAlign: "center",
    color: "#111827",
    marginBottom: 8,
  },
  useBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    alignItems: "center",
  },
  useBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});