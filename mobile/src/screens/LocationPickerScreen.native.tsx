import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import {API_BASE_URL} from "../config";

const API_BASE = API_BASE_URL;

type LocationPick = { lat: number; lng: number; address: string };

type MapPressEvent = {
  nativeEvent: {
    coordinate: {
      latitude: number;
      longitude: number;
    };
  };
};

export default function LocationPickerScreen({ route, navigation }: any) {
  const initialLat = route?.params?.lat ?? 29.6516; // UF coords
  const initialLng = route?.params?.lng ?? -82.3248;

  const onPick =
    (route?.params?.onPick as ((loc: LocationPick) => void) | undefined) ??
    undefined;

  const [search, setSearch] = useState(route?.params?.address ?? "");
  const [region, setRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [marker, setMarker] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });
  const [loading, setLoading] = useState(false);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    setRegion((r) => ({ ...r, latitude, longitude }));
  };

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
      // backend returns { formatted_address, lat, lng }
      setMarker({ latitude: data.lat, longitude: data.lng });
      setRegion((r) => ({
        ...r,
        latitude: data.lat,
        longitude: data.lng,
      }));
      setSearch(data.formatted_address);
    } catch (e) {
      console.log("Geocode error", e);
    } finally {
      setLoading(false);
    }
  };

  const onUseLocation = () => {
    const loc: LocationPick = {
      lat: marker.latitude,
      lng: marker.longitude,
      address:
        search ||
        `${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}`,
    };

    // call back into EditEventScreen
    onPick?.(loc);

    // just pop this screen, don't push a new EditEvent
    navigation.goBack();
  };

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

      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={onMapPress}
      >
        <Marker coordinate={marker} />
      </MapView>

      {/* Confirm button */}
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
