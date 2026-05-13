import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Dimensions, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, Modal, Keyboard
} from 'react-native';
import {
    X, Check, MapPin, Briefcase, Ruler,
    VenusAndMars, Cigarette,
    Wine, Cake, Info, UserRoundPen, Building,
    Pill, Dumbbell, Timer, Heart, ChevronRight, GraduationCap, Search, Navigation, Globe,
    Smile, Languages as LangIcon, School, User
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const { height: screenHeight } = Dimensions.get('window');

const OPTIONS = {
    GENDERS: ["Male", "Female", "Non-binary", "Transgender", "Genderqueer"],
    SEXUALITIES: ["Straight", "Gay", "Lesbian", "Bisexual", "Asexual", "Pansexual", "Queer"],
    LIFESTYLE: ["Often", "Sometimes", "Never"],
    BODY_TYPES: ["Slim", "Athletic", "Average", "Curvy", "A few extra pounds"],
    ACTIVE_TIMES: ["Early Bird", "Night Owl", "In Between"],
    EDUCATION: ["No Degree", "High School", "Associate Degree", "Bachelor Degree", "Master's Degree", "Doctorate", "Trade School"],
    LANGUAGES: ["English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Arabic", "Portuguese", "Russian"]
};

interface EditProfileProps {
    onClose: () => void;
    userData: any;
    onSave: (data: any) => Promise<void>;
}

export default function EditProfile({ onClose, userData, onSave }: EditProfileProps) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [editedData, setEditedData] = useState({
        ...userData,
      
        personality: userData.personality || userData.bio || '',
        languages: Array.isArray(userData.languages) ? userData.languages : [],
    });

    const [isSaving, setIsSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [activePicker, setActivePicker] = useState<{ label: string, field: string, options: string[] } | null>(null);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);

    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [locationQuery, setLocationQuery] = useState("");
    const [locationResults, setLocationResults] = useState<any[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);

    const openPicker = (label: string, field: string, options: string[]) => {
        Haptics.selectionAsync();
        setActivePicker({ label, field, options });
        setPickerVisible(true);
    };

    const updateField = (field: string, value: any) => {
        if (field === 'heightFt' || field === 'heightIn') {
            const cleanValue = value.replace(/[^0-9]/g, '');
            if (cleanValue === '') {
                setEditedData(prev => ({ ...prev, [field]: '' }));
                return;
            }
            let numValue = parseInt(cleanValue, 10);
            if (field === 'heightIn' && numValue > 11) numValue = 11;
            if (field === 'heightFt' && numValue > 8) numValue = 8;
            setEditedData(prev => ({ ...prev, [field]: numValue }));
        } else {
            setEditedData(prev => ({ ...prev, [field]: value }));
        }
    };

    const getCurrentLocation = async () => {
        setIsFetchingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                const res = await fetch('http://ip-api.com/json/');
                const data = await res.json();
                if (data.status === 'success') {
                    setEditedData(prev => ({
                        ...prev,
                        location: `${data.city}, ${data.regionName}`,
                        latitude: data.lat,
                        longitude: data.lon
                    }));
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setLocationModalVisible(false);
                } else {
                    throw new Error("IP Fallback failed");
                }
                setIsFetchingLocation(false);
                return;
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            let rev = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            });

            if (rev.length > 0) {
                const cityStr = `${rev[0].city || rev[0].subregion || ''}, ${rev[0].region || ''}`.replace(/^, | , $/g, '').trim();
                setEditedData(prev => ({
                    ...prev,
                    location: cityStr,
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                }));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setLocationModalVisible(false);
            }
        } catch (e) {
            Alert.alert("Error", "Could not fetch location.");
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

        setEditedData(prev => ({
            ...prev,
            location: cityStr || result.display_name.split(',')[0],
            latitude: lat,
            longitude: lon
        }));

        setLocationQuery("");
        setLocationResults([]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLocationModalVisible(false);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (event.type !== 'dismissed' && selectedDate) {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const today = new Date();
            let newAge = today.getFullYear() - selectedDate.getFullYear();
            if (today.getMonth() < selectedDate.getMonth() ||
                (today.getMonth() === selectedDate.getMonth() && today.getDate() < selectedDate.getDate())) newAge--;

            setEditedData(prev => ({ ...prev, birthday: dateStr, age: newAge }));
        }
    };

    const getSafeDate = (dateString: string) => {
        if (!dateString) return maxDate;
        const parts = dateString.split('-');
        if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return maxDate;
    };

    const handleSave = async () => {
        if (!editedData.name?.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Required", "Please enter your name.");
            return;
        }
        Haptics.selectionAsync();
        setIsSaving(true);
        try {
            const finalPayload = {
                ...editedData,
                heightFt: editedData.heightFt === '' ? 0 : editedData.heightFt,
                heightIn: editedData.heightIn === '' ? 0 : editedData.heightIn,
            };
            await onSave(finalPayload);
            onClose();
        } catch (error) {
            Alert.alert("Error", "Failed to save profile changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const getDisplayValue = (val: any) => {
        if (val === undefined || val === null || val === '') return '';
        return val.toString();
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.headerButton}>
                        <X size={26} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.headerButton}>
                        {isSaving ? <ActivityIndicator size="small" color={colors.text} /> : <Check size={26} color={colors.primary} />}
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>The Basics</Text>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <EditableItem
                                icon={<Info size={18} color={colors.text} />}
                                label="Name"
                                value={editedData.name}
                                onChange={(val: string) => updateField('name', val)}
                                colors={colors} styles={styles}
                            />

                            {Platform.OS === 'android' && showDatePicker ? null : (
                                <SelectableItem
                                    icon={<Cake size={18} color={colors.text} />}
                                    label="Birthday"
                                    value={editedData.birthday ? `${editedData.birthday} (${editedData.age})` : 'Set Birthday'}
                                    onPress={() => setShowDatePicker(true)}
                                    colors={colors} styles={styles}
                                />
                            )}
                            {(showDatePicker || Platform.OS === 'ios') && (
                                <View style={{ padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' }}>
                                    <DateTimePicker
                                        value={getSafeDate(editedData.birthday)}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        maximumDate={maxDate}
                                        themeVariant={isDark ? "dark" : "light"}
                                        accentColor={colors.primary}
                                        onChange={handleDateChange}
                                        style={Platform.OS === 'ios' ? { height: 120 } : {}}
                                    />
                                    {Platform.OS === 'ios' && (
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ marginTop: 10 }}>
                                            <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            <View style={styles.itemRow}>
                                <View style={styles.itemLeft}>
                                    <Ruler size={18} color={colors.text} />
                                    <Text style={[styles.itemLabel, { color: colors.text }]}>Height</Text>
                                </View>
                                <View style={styles.heightInputContainer}>
                                    <TextInput
                                        style={[styles.itemInput, { color: colors.text, width: 30 }]}
                                        value={getDisplayValue(editedData.heightFt)}
                                        onChangeText={(val) => updateField('heightFt', val)}
                                        placeholder="ft"
                                        placeholderTextColor={colors.text + '30'}
                                        keyboardType="number-pad"
                                        textAlign="right"
                                        maxLength={1}
                                    />
                                    <Text style={[styles.unitText, { color: colors.text }]}>ft</Text>
                                    <TextInput
                                        style={[styles.itemInput, { color: colors.text, width: 35, marginLeft: 10 }]}
                                        value={getDisplayValue(editedData.heightIn)}
                                        onChangeText={(val) => updateField('heightIn', val)}
                                        placeholder="in"
                                        placeholderTextColor={colors.text + '30'}
                                        keyboardType="number-pad"
                                        textAlign="right"
                                        maxLength={2}
                                    />
                                    <Text style={[styles.unitText, { color: colors.text }]}>in</Text>
                                </View>
                            </View>
                            <SelectableItem
                                icon={<User size={18} color={colors.text} />}
                                label="Body Type"
                                value={editedData.bodyType}
                                onPress={() => openPicker("Body Type", "bodyType", OPTIONS.BODY_TYPES)}
                                colors={colors} styles={styles}
                            />

                            <SelectableItem
                                icon={<MapPin size={18} color={colors.text} />}
                                label="Location"
                                value={editedData.location}
                                onPress={() => setLocationModalVisible(true)}
                                colors={colors} styles={styles}
                                last
                            />

                        </View>
                    </View>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>About Me</Text>
                        <View style={[styles.bioCard, { backgroundColor: colors.card, marginBottom: 15 }]}>
                            
                            <TextInput
                                style={[styles.bioInput, { color: colors.text }]}
                                value={editedData.personality}
                                onChangeText={(val) => updateField('personality', val)}
                                placeholder="Describe your personality..."
                                placeholderTextColor={colors.text + '40'}
                                multiline
                            />
                        </View>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <EditableItem
                                icon={<Smile size={18} color={colors.text} />}
                                label="Hobbies"
                                value={editedData.hobbies}
                                onChange={(val: string) => updateField('hobbies', val)}
                                colors={colors} styles={styles}
                                last
                            />
                        </View>
                    </View>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>Identity</Text>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <SelectableItem icon={<VenusAndMars size={18} color={colors.text} />} label="Gender" value={editedData.gender} onPress={() => openPicker("Gender", "gender", OPTIONS.GENDERS)} colors={colors} styles={styles} />
                            <SelectableItem icon={<Heart size={18} color={colors.text} />} label="Sexuality" value={editedData.sexuality} onPress={() => openPicker("Sexuality", "sexuality", OPTIONS.SEXUALITIES)} colors={colors} styles={styles} />
                            <EditableItem icon={<UserRoundPen size={18} color={colors.text} />} label="Pronouns" value={editedData.pronouns} onChange={(v: string) => updateField('pronouns', v)} colors={colors} styles={styles} last />
                        </View>
                    </View>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>Background</Text>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <EditableItem icon={<Globe size={18} color={colors.text} />} label="Ethnicity" value={editedData.ethnicity} onChange={(v: string) => updateField('ethnicity', v)} colors={colors} styles={styles} />
                            <EditableItem icon={<Info size={18} color={colors.text} />} label="Religion" value={editedData.religion} onChange={(v: string) => updateField('religion', v)} colors={colors} styles={styles} />

                            <SelectableItem
                                icon={<LangIcon size={18} color={colors.text} />}
                                label="Languages"
                                value={editedData.languages.join(", ")}
                                onPress={() => openPicker("Language", "languages", OPTIONS.LANGUAGES)}
                                colors={colors} styles={styles}
                                last
                            />
                        </View>
                    </View>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>Lifestyle</Text>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <SelectableItem icon={<Wine size={18} color={colors.text} />} label="Drinking" value={editedData.drinking} onPress={() => openPicker("Drinking", "drinking", OPTIONS.LIFESTYLE)} colors={colors} styles={styles} />
                            <SelectableItem icon={<Cigarette size={18} color={colors.text} />} label="Smoking" value={editedData.smoking} onPress={() => openPicker("Smoking", "smoking", OPTIONS.LIFESTYLE)} colors={colors} styles={styles} />
                            <SelectableItem icon={<Pill size={18} color={colors.text} />} label="Drugs" value={editedData.drugs} onPress={() => openPicker("Drugs", "drugs", OPTIONS.LIFESTYLE)} colors={colors} styles={styles} />
                            <SelectableItem icon={<Dumbbell size={18} color={colors.text} />} label="Workout" value={editedData.workout} onPress={() => openPicker("Workout", "workout", OPTIONS.LIFESTYLE)} colors={colors} styles={styles} />
                            <SelectableItem icon={<Timer size={18} color={colors.text} />} label="Active Time" value={editedData.activeTime} onPress={() => openPicker("Active Time", "activeTime", OPTIONS.ACTIVE_TIMES)} colors={colors} styles={styles} last />
                        </View>
                    </View>

                    <View style={styles.group}>
                        <Text style={[styles.groupLabel, { color: colors.text }]}>Work & Education</Text>
                        <View style={[styles.card, { backgroundColor: colors.card }]}>
                            <EditableItem icon={<Briefcase size={18} color={colors.text} />} label="Job Title" value={editedData.jobTitle} onChange={(v: string) => updateField('jobTitle', v)} colors={colors} styles={styles} />
                            <EditableItem icon={<Building size={18} color={colors.text} />} label="Company" value={editedData.work} onChange={(v: string) => updateField('work', v)} colors={colors} styles={styles} />
                            <EditableItem icon={<School size={18} color={colors.text} />} label="School" value={editedData.school} onChange={(v: string) => updateField('school', v)} colors={colors} styles={styles} />
                            <SelectableItem icon={<GraduationCap size={18} color={colors.text} />} label="Education" value={editedData.education} onPress={() => openPicker("Education", "education", OPTIONS.EDUCATION)} colors={colors} styles={styles} last />
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={pickerVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Select {activePicker?.label}</Text>
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setPickerVisible(false); }}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ paddingBottom: 40, maxHeight: screenHeight * 0.6 }}>
                            {activePicker?.options.map((option) => {
                                const isArray = Array.isArray(editedData[activePicker.field as keyof typeof editedData]);
                                const isSelected = isArray
                                    ? (editedData[activePicker.field as keyof typeof editedData] as string[]).includes(option)
                                    : editedData[activePicker.field as keyof typeof editedData] === option;

                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={styles.modalOption}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            if (isArray) {
                                                const currentArr = editedData[activePicker.field as keyof typeof editedData] as string[];
                                                if (isSelected) {
                                                    updateField(activePicker.field, currentArr.filter(i => i !== option));
                                                } else {
                                                    updateField(activePicker.field, [...currentArr, option]);
                                                }
                                            } else {
                                                updateField(activePicker.field, option);
                                                setPickerVisible(false);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.modalOptionText, { color: colors.text }]}>{option}</Text>
                                        {isSelected && <Check size={20} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={locationModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background, height: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Update Location</Text>
                            <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 20 }}>
                            <Text style={styles.groupLabel}>Search City</Text>
                            <View style={[styles.unifiedCard, { backgroundColor: colors.card, marginBottom: 15 }]}>
                                <TextInput
                                    style={[styles.cardTextInput, { color: colors.text }]}
                                    placeholder="e.g. Chicago, IL"
                                    placeholderTextColor={colors.text + '50'}
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
                                <View style={{ backgroundColor: colors.card, borderRadius: 20, maxHeight: 250, overflow: 'hidden' }}>
                                    <ScrollView keyboardShouldPersistTaps="handled">
                                        {locationResults.map((loc, idx) => (
                                            <TouchableOpacity key={loc.place_id || idx} style={styles.searchItem} onPress={() => handleLocationSelect(loc)}>
                                                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                                                    {loc.address?.city || loc.address?.town || loc.address?.village || loc.name}
                                                </Text>
                                                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>
                                                    {loc.display_name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <View style={styles.orDivider}>
                                <View style={styles.line} />
                                <Text style={styles.orText}>OR</Text>
                                <View style={styles.line} />
                            </View>

                            <TouchableOpacity style={styles.fetchLocationBtn} onPress={getCurrentLocation} disabled={isFetchingLocation}>
                                {isFetchingLocation ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Navigation size={20} color="#FFF" />
                                        <Text style={styles.fetchLocationText}>Use Current Location</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const EditableItem = ({ icon, label, value, onChange, keyboardType = 'default', colors, styles, last }: any) => (
    <View style={[styles.itemRow, !last && styles.itemBorder]}>
        <View style={styles.itemLeft}>
            {icon}
            <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
        </View>
        <TextInput
            style={[styles.itemInput, { color: colors.text }]}
            value={value || ''}
            onChangeText={onChange}
            placeholder="Add"
            placeholderTextColor={colors.text + '30'}
            keyboardType={keyboardType}
            textAlign="right"
        />
    </View>
);

const SelectableItem = ({ icon, label, value, onPress, colors, styles, last }: any) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.itemRow, !last && styles.itemBorder]}
            activeOpacity={0.7}
        >
            <View style={styles.itemLeft}>
                {icon}
                <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <Text style={[styles.itemValueText, { color: value ? colors.text : colors.text + '30' }]} numberOfLines={1}>
                    {value || "Select"}
                </Text>
                <ChevronRight size={18} color={colors.text + '20'} />
            </View>
        </TouchableOpacity>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    headerButton: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    scrollContent: { paddingVertical: 10, paddingBottom: 60 },
    group: { marginTop: 24, paddingHorizontal: 16 },
    groupLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: colors.subtext, marginLeft: 8, marginBottom: 8, letterSpacing: 1 },
    card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, minHeight: 60 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemLabel: { fontSize: 15, fontWeight: '600' },
    itemInput: { fontSize: 15, fontWeight: '500', flex: 1 },
    itemValueText: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    heightInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
    unitText: { opacity: 0.4, fontSize: 14, marginLeft: 2 },
    bioCard: { borderRadius: 24, padding: 18, minHeight: 100, borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)' },
    bioInput: { fontSize: 16, lineHeight: 22, textAlignVertical: 'top' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.05)' },
    modalOptionText: { fontSize: 16, fontWeight: '600' },

    unifiedCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20 },
    cardTextInput: { flex: 1, marginRight: 10, fontSize: 16, fontWeight: '600' },
    searchItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
    fetchLocationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, gap: 10 },
    fetchLocationText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
    orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    line: { flex: 1, height: 1, backgroundColor: 'rgba(150,150,150,0.2)' },
    orText: { marginHorizontal: 15, color: colors.subtext, fontWeight: '800' },
});