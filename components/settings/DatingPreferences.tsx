// components/settings/DatingPreferences.tsx
import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, TextInput, Keyboard
} from 'react-native';
import { X, Users, MapPin, Navigation, Search } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/auth/AuthContext';
import { userService } from '@/services/userService';

interface DatingPreferencesProps {
    onClose: () => void;
}

export default function DatingPreferences({ onClose }: DatingPreferencesProps) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const { user, profile, refreshProfile } = useAuth();

    // --- STATE ---
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const [locationQuery, setLocationQuery] = useState("");
    const [locationResults, setLocationResults] = useState<any[]>([]);

    const [showLocationEditor, setShowLocationEditor] = useState(false);

    const [prefData, setPrefData] = useState({
        mode: profile?.mode || ['Dating'],
        interestedIn: profile?.interestedIn || ['Everyone'],
        minAge: profile?.preferredAgeMin || 18,
        maxAge: profile?.preferredAgeMax || 35,
        distance: profile?.maxDistance || 50,
        location: profile?.location || '',
        latitude: profile?.latitude ?? null,
        longitude: profile?.longitude ?? null,
    });

    const getCurrentLocation = async () => {
        setIsFetchingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                const res = await fetch('http://ip-api.com/json/');
                const data = await res.json();

                if (data.status === 'success') {
                    setPrefData(prev => ({
                        ...prev,
                        location: `${data.city}, ${data.regionName}`,
                        latitude: data.lat,
                        longitude: data.lon
                    }));
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setIsFetchingLocation(false);
                    setShowLocationEditor(false);
                    return;
                } else {
                    throw new Error("IP Fallback failed");
                }
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            let rev = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            });

            if (rev.length > 0) {
                const cityStr = `${rev[0].city || rev[0].subregion || ''}, ${rev[0].region || ''}`.replace(/^, | , $/g, '').trim();
                setPrefData(prev => ({
                    ...prev,
                    location: cityStr,
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                }));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowLocationEditor(false);
            }
        } catch (e) {
            Alert.alert("Error", "Could not fetch location. Try searching for your city instead.");
        } finally {
            setIsFetchingLocation(false);
        }
    };

    const searchLocation = async () => {
        if (!locationQuery.trim()) return;
        setIsSearchingLocation(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&addressdetails=1&limit=5`, {
                headers: { 'User-Agent': 'MixMatchApp/1.0' }
            });
            const data = await response.json();

            if (data && data.length > 0) {
                setLocationResults(data);
                Keyboard.dismiss();
            } else {
                setLocationResults([]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert("Not Found", "Could not find that location.");
            }
        } catch (e) {
            Alert.alert("Search Error", "Failed to connect to location services.");
        } finally {
            setIsSearchingLocation(false);
        }
    };

    const handleLocationSelect = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const address = result.address;

        const city = address.city || address.town || address.village || address.county || result.name || "";
        const state = address.state || address.region || address.country || "";
        const cityStr = `${city}${state ? `, ${state}` : ''}`.replace(/^, | , $/g, '').trim();

        setPrefData(prev => ({
            ...prev,
            location: cityStr || result.display_name.split(',')[0],
            latitude: lat,
            longitude: lon
        }));

        setLocationQuery("");
        setLocationResults([]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowLocationEditor(false);
    };

    const handleSave = async () => {
        if (!user) return;

        // Strict null check blocks the save if GPS coordinates are missing
        if (!prefData.location || prefData.latitude === null || prefData.longitude === null) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Location Required", "Please update your location so we can find matches near you.");
            setShowLocationEditor(true); // Pop open the editor to help them
            return;
        }

        Haptics.selectionAsync();
        setIsSaving(true);
        try {
            const payload = {
                mode: prefData.mode,
                interestedIn: prefData.interestedIn,
                preferredAgeMin: prefData.minAge,
                preferredAgeMax: prefData.maxAge,
                maxDistance: prefData.distance,
                location: prefData.location,
                latitude: prefData.latitude,
                longitude: prefData.longitude,
            };

            await userService.updateUserProfile(user.uid, payload);
            await refreshProfile();
            onClose();
        } catch (error) {
            Alert.alert("Error", "Failed to update preferences.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Preferences</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X size={28} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* --- LOCATION HYBRID SYSTEM --- */}
                <View style={styles.section}>
                    <Text style={styles.smallLabel}>My Location</Text>

                    <View style={styles.locationDisplayCard}>
                        <MapPin size={24} color={colors.primary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[styles.locationValue, !prefData.location && { color: colors.subtext, fontStyle: 'italic' }]}>
                                {prefData.location || "Not set yet"}
                            </Text>
                        </View>
                        {!showLocationEditor && (
                            <TouchableOpacity onPress={() => setShowLocationEditor(true)}>
                                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>Update</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {showLocationEditor && (
                        <View style={{ marginTop: 10 }}>
                            <View style={styles.unifiedCard}>
                                <TextInput
                                    style={[styles.cardTextInput, { color: colors.text }]}
                                    placeholder="Search a city... e.g. Chicago, IL"
                                    placeholderTextColor={colors.subtext}
                                    value={locationQuery}
                                    onChangeText={(text) => {
                                        setLocationQuery(text);
                                        if (locationResults.length > 0) setLocationResults([]);
                                    }}
                                    onSubmitEditing={searchLocation}
                                />
                                <TouchableOpacity onPress={searchLocation} disabled={isSearchingLocation} style={{ padding: 5 }}>
                                    {isSearchingLocation ? <ActivityIndicator size="small" color={colors.primary} /> : <Search size={20} color={colors.primary} />}
                                </TouchableOpacity>
                            </View>

                            {locationResults.length > 0 && (
                                <View style={styles.searchResultsContainer}>
                                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                                        {locationResults.map((loc, idx) => (
                                            <TouchableOpacity key={loc.place_id || idx} style={styles.searchItem} onPress={() => handleLocationSelect(loc)}>
                                                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                                                    {loc.address?.city || loc.address?.town || loc.address?.village || loc.name}
                                                </Text>
                                                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                                                    {loc.display_name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <TouchableOpacity style={styles.fetchLocationBtn} onPress={getCurrentLocation} disabled={isFetchingLocation}>
                                {isFetchingLocation ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Navigation size={18} color="#FFF" />
                                        <Text style={styles.fetchLocationText}>Use Current Location</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowLocationEditor(false)} style={{ marginTop: 15, alignItems: 'center' }}>
                                <Text style={{ color: colors.subtext, fontWeight: '700', fontSize: 14 }}>Cancel Update</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* --- MODE SELECTION --- */}
                <View style={styles.section}>
                    <Text style={styles.smallLabel}>I'm using MixMatch for</Text>
                    <View style={styles.optionGroup}>
                        {['Dating', 'Friends'].map((m) => {
                            const isSelected = prefData.mode.includes(m);
                            return (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.optionButton, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setPrefData(prev => ({
                                            ...prev,
                                            mode: [m]
                                        }));
                                    }}>
                                    <Text style={[styles.optionText, { color: isSelected ? '#fff' : colors.text }]}>{m}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* --- FULL GENDER PREFERENCE --- */}
                <View style={styles.section}>
                    <Text style={styles.smallLabel}>Interested In</Text>
                    <View style={styles.optionGroup}>
                        {['Male', 'Female', 'Non-binary', 'Transgender', 'Genderqueer', 'Everyone'].map((g) => {
                            const isSelected = prefData.interestedIn.includes(g);
                            return (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.optionButton, { minWidth: '30%', paddingHorizontal: 10 }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setPrefData(prev => {
                                            if (g === 'Everyone') return { ...prev, interestedIn: ['Everyone'] };

                                            const newSelection = isSelected
                                                ? prev.interestedIn.filter(item => item !== g)
                                                : [...prev.interestedIn.filter(item => item !== 'Everyone'), g];

                                            return { ...prev, interestedIn: newSelection.length === 0 ? ['Everyone'] : newSelection };
                                        });
                                    }}>
                                    <Text style={[styles.optionText, { color: isSelected ? '#fff' : colors.text }]}>{g}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* --- DUAL STACK AGE SLIDER --- */}
                <View style={styles.section}>
                    <View style={{ marginBottom: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <Text style={styles.smallLabel}>Minimum Age</Text>
                            <Text style={styles.valueLabel}>{prefData.minAge}</Text>
                        </View>
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={18}
                            maximumValue={98}
                            step={1}
                            value={prefData.minAge}
                            onValueChange={(v) => {
                                if (v > prefData.maxAge) {
                                    setPrefData(prev => ({ ...prev, minAge: v, maxAge: v }));
                                } else {
                                    setPrefData(prev => ({ ...prev, minAge: v }));
                                }
                            }}
                            onSlidingComplete={() => Haptics.selectionAsync()}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                            thumbTintColor={colors.primary}
                        />
                    </View>

                    <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <Text style={styles.smallLabel}>Maximum Age</Text>
                            <Text style={styles.valueLabel}>{prefData.maxAge}</Text>
                        </View>
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={18}
                            maximumValue={99}
                            step={1}
                            value={prefData.maxAge}
                            onValueChange={(v) => {
                                if (v < prefData.minAge) {
                                    setPrefData(prev => ({ ...prev, maxAge: v, minAge: v }));
                                } else {
                                    setPrefData(prev => ({ ...prev, maxAge: v }));
                                }
                            }}
                            onSlidingComplete={() => Haptics.selectionAsync()}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                            thumbTintColor={colors.primary}
                        />
                    </View>
                </View>

                {/* --- DISTANCE SLIDER --- */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={styles.smallLabel}>Maximum Distance</Text>
                        <Text style={styles.valueLabel}>{prefData.distance} mi</Text>
                    </View>
                    <View style={styles.sliderContainer}>
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={1}
                            maximumValue={100}
                            step={1}
                            value={prefData.distance}
                            onValueChange={(v) => setPrefData(prev => ({ ...prev, distance: v }))}
                            onSlidingComplete={() => Haptics.selectionAsync()}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                            thumbTintColor={colors.primary}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <Users size={20} color="#fff" style={{ marginRight: 10 }} />
                            <Text style={styles.saveButtonText}>Update Preferences</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
    title: { fontSize: 24, fontWeight: '900' },
    closeBtn: { padding: 5 },
    content: { flex: 1, paddingHorizontal: 20 },
    section: { marginBottom: 35 },

    smallLabel: { fontSize: 13, fontWeight: '800', color: colors.subtext, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
    valueLabel: { fontSize: 18, fontWeight: '900', color: isDark ? '#FFFFFF' : colors.text },

    optionGroup: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    optionButton: { flex: 1, paddingVertical: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.text + '10', alignItems: 'center', backgroundColor: colors.card },
    optionText: { fontSize: 14, fontWeight: '700' },

    locationDisplayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 15, borderRadius: 20, marginBottom: 5, borderWidth: 1, borderColor: colors.text + '05' },
    locationValue: { fontSize: 16, fontWeight: '800', color: colors.text },
    unifiedCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.text + '05', marginBottom: 10 },
    cardTextInput: { flex: 1, marginRight: 10, fontSize: 15, fontWeight: '600' },
    searchResultsContainer: { backgroundColor: colors.card, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.text + '05' },
    searchItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
    fetchLocationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 20, gap: 8 },
    fetchLocationText: { fontSize: 15, fontWeight: '800', color: '#FFF' },

    sliderContainer: { alignItems: 'center', marginTop: 10 },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 25, marginTop: 10, marginBottom: 50 },
    saveButtonText: { fontSize: 18, fontWeight: '800', color: '#fff' },
});