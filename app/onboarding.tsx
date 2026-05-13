import React, { useState, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard, ActivityIndicator, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { 
  ArrowLeft, MapPin, Navigation, ChevronDown,
  User as UserIcon, Plus, Minus, Camera, Briefcase, GraduationCap, Info, 
  School, Building, Search, Music as MusicIcon, X, Star, Check, Languages as LangIcon, 
  Heart, Zap, Eye, Bell, Shield, Smile, Users, Circle
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location'; 
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { userService } from '../services/userService';
import { Dropdown } from 'react-native-element-dropdown';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/constants/themeHelper'; 
import * as Haptics from 'expo-haptics';


const GENDERS = ["Male", "Female", "Non-binary", "Transgender", "Genderqueer"];
const SEXUALITIES = ["Straight", "Gay", "Lesbian", "Bisexual", "Asexual", "Pansexual", "Queer"];
const MODES = ["Dating", "Friends"];
const BODY_TYPES = ["Slim", "Athletic", "Average", "Curvy", "A few extra pounds"];
const DEGREES = ["No Degree", "High School", "Associate Degree", "Bachelor Degree", "Master's Degree", "Doctorate", "Trade School"];
const LANGUAGES = ["English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Arabic", "Portuguese", "Russian"];
const ACTIVE_TIMES = ["Early Bird", "Night Owl", "In Between"];
const LIFESTYLE_OPTS = ["Often", "Sometimes", "Never"];

const TOTAL_STEPS = 16; 

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme(); 
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [step, setStep] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  
  const [songSearch, setSongSearch] = useState("");
  const [songResults, setSongResults] = useState<any[]>([]);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [langSearch, setLangSearch] = useState("");

  // Location Search State
  const [locationQuery, setLocationQuery] = useState("");
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    basics: {
      name: '',
      birthday: '' as string,
      gender: '',
      pronouns: '',
      sexuality: '',
      personality: '', 
      hobbies: '',
    },
    intentions: {
      mode: [] as string[],
      datingIntentions: '',
      lookingFor: '',
      interestedIn: [] as string[], 
      minAge: 18,
      maxAge: 35,
      distance: 50,
    },
    profileDetails: {
      ethnicity: '',
      religion: '',
      education: null as string | null,
      school: '',
      jobTitle: '',
      work: '',
      languages: [] as string[],
      heightFt: 5,
      heightIn: 7,
      bodyType: '',
      drinking: '',
      smoking: '',
      drugs: '',
      workout: '',
      activeTime: '',
      location: '',
      latitude: null as number | null,
      longitude: null as number | null,
    },
    music: {
      topSongs: [] as any[],
      mainTrackId: null as number | null, 
    },
    settings: {
      pushEnabled: true,
      notifyMatches: true,
      notifyMessages: true,
      notifyLikes: true,
    }
  });


  const RequiredIcon = () => <Star size={14} color={colors.primary} fill={colors.primary} style={{ marginLeft: 6 }} />;
  const OptionalIcon = () => <Circle size={12} color={colors.subtext} style={{ marginLeft: 6 }} />;

  // --- HYBRID LOCATION LOGIC ---
  const getCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      // If user denies permission, fallback to IP Address API (No Key Needed) saves us money lmao
      if (status !== 'granted') {
        const res = await fetch('http://ip-api.com/json/');
        const data = await res.json();
        
        if (data.status === 'success') {
          setFormData(prev => ({ 
            ...prev, 
            profileDetails: { 
              ...prev.profileDetails, 
              location: `${data.city}, ${data.regionName}`,
              latitude: data.lat,
              longitude: data.lon
            }
          }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsFetchingLocation(false);
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
        setFormData(prev => ({ 
          ...prev, 
          profileDetails: { 
            ...prev.profileDetails, 
            location: cityStr,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          }
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      // Fetch up to 5 results to show in a dropdown
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
        Alert.alert("Not Found", "Could not find that location. Try a valid city and state.");
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

    setFormData(prev => ({ 
      ...prev, 
      profileDetails: { 
        ...prev.profileDetails, 
        location: cityStr || result.display_name.split(',')[0], 
        latitude: lat,
        longitude: lon
      }
    }));
    
    // Clear search states after picking
    setLocationQuery("");
    setLocationResults([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // --- MUSIC SEARCH LOGIC ---
  const handleSongSearch = async (query: string) => {
    setSongSearch(query);
    if (query.length < 2) { setSongResults([]); return; }
    setIsSearchingSongs(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
      const data = await response.json();
      setSongResults(data.results || []);
    } catch (e) { console.error(e); }
    finally { setIsSearchingSongs(false); }
  };

  const toggleSongSelection = (track: any) => {
    const isSelected = formData.music.topSongs.some(s => s.trackId === track.trackId);
    if (isSelected) {
      setFormData(prev => ({ 
        ...prev, 
        music: { 
            ...prev.music, 
            topSongs: prev.music.topSongs.filter(s => s.trackId !== track.trackId),
            mainTrackId: prev.music.mainTrackId === track.trackId ? null : prev.music.mainTrackId
        } 
      }));
    } else {
      if (formData.music.topSongs.length >= 5) return;
      setFormData(prev => ({ 
        ...prev, 
        music: { 
            ...prev.music, 
            topSongs: [...prev.music.topSongs, track],
            mainTrackId: prev.music.topSongs.length === 0 ? track.trackId : prev.music.mainTrackId
        } 
      }));
      setSongSearch(""); setSongResults([]);
    }
  };


  const checkIsValid = () => {
    switch (step) {
      case 0: return !!formData.basics.name.trim();
      case 1: return !!formData.basics.birthday;
      case 2: return !!formData.basics.gender && !!formData.basics.sexuality;
      case 3: return !!formData.basics.personality.trim(); 
      case 4: return formData.intentions.mode.length > 0 && !!formData.intentions.lookingFor.trim(); 
      case 5: return formData.intentions.interestedIn.length > 0; 
      case 6: return formData.intentions.minAge >= 18 && formData.intentions.maxAge >= formData.intentions.minAge; // Age validation mandatory
      case 7: return !!formData.profileDetails.location && formData.profileDetails.latitude !== null; 
      case 8: return !!formData.profileDetails.heightFt && !!formData.profileDetails.bodyType; 
      case 9: return true; 
      case 10: return true; 
      case 11: return true; 
      case 12: return formData.profileDetails.languages.length > 0; 
      case 13: return formData.music.topSongs.length >= 5; 
      case 14: return !!formData.music.mainTrackId; 
      case 15: return true; 
      default: return true; 
    }
  };

  const handleNextPress = () => {
    if (!checkIsValid()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.selectionAsync();
    
    if (step === TOTAL_STEPS - 1) {
      handleComplete();
    } else {
      Keyboard.dismiss();
      setStep(s => s + 1);
    }
  };


  const handleComplete = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const birthDate = new Date(formData.basics.birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      if (today.getMonth() < birthDate.getMonth() || 
         (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;

      const mainTrack = formData.music.topSongs.find(s => s.trackId === formData.music.mainTrackId) || formData.music.topSongs[0];
      const albumArt = mainTrack?.artworkUrl100?.replace('100x100bb', '600x600bb') || '';

      const genres = new Set<string>();
      const artists = new Set<string>();
      formData.music.topSongs.forEach(s => {
        if (s.primaryGenreName) genres.add(s.primaryGenreName);
        if (s.artistName) artists.add(s.artistName);
      });

      const payload = {
        ...formData.basics,      
        ...formData.profileDetails, 
        ...formData.settings,    
        uid: user.uid,
        age: age,
        onboardingComplete: true,
        maxDistance: formData.intentions.distance,     
        preferredAgeMin: formData.intentions.minAge,   
        preferredAgeMax: formData.intentions.maxAge,   
        mode: formData.intentions.mode,
        interestedIn: formData.intentions.interestedIn,
        lookingFor: formData.intentions.lookingFor,
        topSongs: formData.music.topSongs,
        favoriteGenres: Array.from(genres),
        favoriteArtists: Array.from(artists),
        image: albumArt, 
        photos: [albumArt], 
        mainMusicTitle: mainTrack?.trackName || '',
        mainMusicArtist: mainTrack?.artistName || '',
        mainMusicImage: albumArt,
        mainMusicPreview: mainTrack?.previewUrl || '',
      };

      await userService.updateUserProfile(user.uid, payload);
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (error) {
      console.error("Onboarding Save Error:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const back = () => { 
    Haptics.selectionAsync();
    Keyboard.dismiss(); 
    setStep(s => Math.max(0, s - 1)); 
  };

  const getSafeDate = (dateString: string) => {
    if (!dateString) return maxDate;
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return maxDate;
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>What is your name?</Text>
            <RequiredIcon/>
          </View>
          <View style={styles.inputWrapper}>
            <UserIcon size={20} color={colors.primary} />
            <TextInput 
              style={styles.textInput} 
              placeholder="First Name" 
              placeholderTextColor={colors.subtext}
              value={formData.basics.name} 
              onChangeText={(v) => setFormData({...formData, basics:{ ...formData.basics, name: v}})} 
            />
          </View>
        </View>
      );

      case 1: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>When is your birthday?</Text>
            <RequiredIcon/>
          </View>
          {Platform.OS === 'android' && (
            <TouchableOpacity style={[styles.unifiedCard, { paddingVertical: 18 }]} onPress={() => setShowDatePicker(true)}>
              <Text style={[styles.cardTextInput, { marginLeft: 0, color: formData.basics.birthday ? colors.text : colors.subtext }]}>
                {formData.basics.birthday || "Tap to select your birthday"}
              </Text>
            </TouchableOpacity>
          )}
          {(showDatePicker || Platform.OS === 'ios') && (
            <View style={Platform.OS === 'ios' ? styles.birthdayCard : {}}>
              <DateTimePicker
                value={getSafeDate(formData.basics.birthday)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={maxDate} 
                themeVariant={isDark ? "dark" : "light"} 
                accentColor={colors.primary} 
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (event.type !== 'dismissed' && selectedDate) {
                    const year = selectedDate.getFullYear();
                    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(selectedDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    setFormData(prev => ({...prev, basics: {...prev.basics, birthday: dateStr}}));
                  }
                }}
                style={Platform.OS === 'ios' ? { height: 320 } : {}}
              />
            </View>
          )}
        </View>
      );

      case 2: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Identity</Text>
            <RequiredIcon/>
          </View>
          <Text style={styles.smallLabel}>Gender</Text>
          <View style={styles.pillRow}>
            {GENDERS.map(g => (
              <TouchableOpacity key={g} style={[styles.pill, formData.basics.gender === g && styles.pillSelected]} onPress={() => setFormData({...formData, basics:{ ...formData.basics, gender: g}})}>
                  <Text style={[styles.pillText, formData.basics.gender === g && styles.contrastText]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.smallLabel, { marginTop: 20 }]}>Sexuality</Text>
          <View style={styles.pillRow}>
            {SEXUALITIES.map(s => (
              <TouchableOpacity key={s} style={[styles.pill, formData.basics.sexuality === s && styles.pillSelected]} onPress={() => setFormData({...formData, basics:{ ...formData.basics, sexuality: s}})}>
                  <Text style={[styles.pillText, formData.basics.sexuality === s && styles.contrastText]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

      case 3: return (
        <View style={styles.content}>
          <Text style={styles.title}>About Me</Text>
          <View style={styles.titleRow}>
            <Text style={styles.smallLabel}>Bio</Text>
            <RequiredIcon/>
          </View>
          <View style={[styles.unifiedCard, { height: 100, alignItems: 'flex-start' }]}>
            <TextInput 
              style={[styles.cardTextInput, { height: '100%', textAlignVertical: 'top' }]} 
              placeholder="Tell us about yourself..." 
              placeholderTextColor={colors.subtext} 
              multiline 
              value={formData.basics.personality} 
              onChangeText={(v) => setFormData({...formData, basics:{ ...formData.basics, personality: v}})} 
            />
          </View>
          <View style={[styles.titleRow, { marginTop: 20 }]}>
            <Text style={styles.smallLabel}>Hobbies</Text>
            <OptionalIcon/>
          </View>
          <View style={[styles.unifiedCard, { height: 80, alignItems: 'flex-start' }]}>
            <TextInput 
              style={[styles.cardTextInput, { height: '100%', textAlignVertical: 'top' }]} 
              placeholder="Hiking, Vinyl, etc..." 
              placeholderTextColor={colors.subtext} 
              multiline 
              value={formData.basics.hobbies} 
              onChangeText={(v) => setFormData({...formData, basics:{ ...formData.basics, hobbies: v}})} 
            />
          </View>
        </View>
      );

      case 4: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Intentions</Text>
            <RequiredIcon />
          </View>
          <Text style={styles.smallLabel}>Mode (Select One)</Text>
          <View style={styles.pillRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.pill, formData.intentions.mode.includes(m) && styles.pillSelected]}
                onPress={() => {

                  setFormData({ ...formData, intentions: { ...formData.intentions, mode: [m] } });
                }}
              >
                <Text style={[styles.pillText, formData.intentions.mode.includes(m) && styles.contrastText]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.smallLabel, { marginTop: 20 }]}>Looking For</Text>
          <View style={styles.unifiedCard}>
            <TextInput
              style={styles.cardTextInput}
              placeholder="e.g. A concert buddy"
              placeholderTextColor={colors.subtext}
              value={formData.intentions.lookingFor}
              onChangeText={(v) => setFormData({ ...formData, intentions: { ...formData.intentions, lookingFor: v } })}
            />
          </View>
        </View>
      );

      case 5: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Who would you like to meet?</Text>
            <RequiredIcon />
          </View>
          <Text style={styles.smallLabel}>Interested in (Gender)</Text>
          <View style={styles.pillRow}>

            {[...GENDERS, "Everyone"].map(i => (
              <TouchableOpacity
                key={i}
                style={[styles.pill, formData.intentions.interestedIn.includes(i) && styles.pillSelected]}
                onPress={() => setFormData({ ...formData, intentions: { ...formData.intentions, interestedIn: [i] } })}
              >
                <Text style={[styles.pillText, formData.intentions.interestedIn.includes(i) && styles.contrastText]}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

      case 6: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Age Preference</Text>
            <RequiredIcon/>
          </View>
          <Text style={styles.smallLabel}>What age range are you looking for?</Text>
          
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <Text style={styles.smallLabel}>Minimum Age</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{formData.intentions.minAge}</Text>
            </View>
            <Slider 
              style={{width: '100%', height: 40}} 
              minimumValue={18} 
              maximumValue={98} 
              step={1} 
              value={formData.intentions.minAge} 
              onValueChange={(v) => {
                  if (v > formData.intentions.maxAge) {
                      setFormData(prev => ({ ...prev, intentions: { ...prev.intentions, minAge: v, maxAge: v } }));
                  } else {
                      setFormData(prev => ({ ...prev, intentions: { ...prev.intentions, minAge: v } }));
                  }
              }} 
              minimumTrackTintColor={colors.primary} 
              thumbTintColor={colors.primary} 
            />
          </View>

          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <Text style={styles.smallLabel}>Maximum Age</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{formData.intentions.maxAge}</Text>
            </View>
            <Slider 
              style={{width: '100%', height: 40}} 
              minimumValue={18} 
              maximumValue={99} 
              step={1} 
              value={formData.intentions.maxAge} 
              onValueChange={(v) => {
                  if (v < formData.intentions.minAge) {
                      setFormData(prev => ({ ...prev, intentions: { ...prev.intentions, maxAge: v, minAge: v } }));
                  } else {
                      setFormData(prev => ({ ...prev, intentions: { ...prev.intentions, maxAge: v } }));
                  }
              }} 
              minimumTrackTintColor={colors.primary} 
              thumbTintColor={colors.primary} 
            />
          </View>
        </View>
      );

      case 7: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Location</Text>
            <RequiredIcon/>
          </View>
          
          <View style={styles.locationDisplayCard}>
            <MapPin size={28} color={colors.primary} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={styles.locationLabel}>Your Location</Text>
              <Text style={[styles.locationValue, !formData.profileDetails.location && { color: colors.subtext, fontStyle: 'italic' }]}>
                {formData.profileDetails.location || "Not set yet"}
              </Text>
            </View>
          </View>

          <Text style={styles.smallLabel}>Search City</Text>
          <View style={styles.unifiedCard}>
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="e.g. Chicago, IL" 
              placeholderTextColor={colors.subtext} 
              value={locationQuery} 
              onChangeText={(text) => {
                setLocationQuery(text);
                if (locationResults.length > 0) setLocationResults([]); 
              }}
              onSubmitEditing={searchLocation}
            />
            <TouchableOpacity onPress={searchLocation} disabled={isSearchingLocation} style={{ padding: 5 }}>
              {isSearchingLocation ? <ActivityIndicator size="small" color={colors.primary}/> : <Search size={20} color={colors.primary} />}
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

          <View style={{ marginTop: 40 }}>
            <Text style={styles.distanceLabel}>Distance Radius: {formData.intentions.distance} mi</Text>
            <Slider 
              style={{width: '100%', height: 40}} 
              minimumValue={1} maximumValue={100} step={1} 
              value={formData.intentions.distance} 
              onValueChange={(v) => setFormData({...formData, intentions:{ ...formData.intentions, distance: v}})} 
              minimumTrackTintColor={colors.primary} 
              thumbTintColor={colors.primary} 
            />
          </View>
        </View>
      );

      case 8: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Physical</Text>
            <RequiredIcon/>
          </View>
          <Text style={styles.smallLabel}>Height</Text>
          <View style={styles.manualHeightRow}>
            <View style={styles.heightInputContainer}>
              <TextInput
                style={styles.heightInput}
                keyboardType="number-pad"
                maxLength={1}
                placeholder="5"
                placeholderTextColor={colors.subtext}
          
                value={formData.profileDetails.heightFt ? formData.profileDetails.heightFt.toString() : ''}
                onChangeText={(v) => {
                 
                  const val = v === '' ? 0 : parseInt(v);
                  setFormData(prev => ({
                    ...prev,
                    profileDetails: { ...prev.profileDetails, heightFt: val }
                  }));
                }}
              />
              <Text style={styles.heightUnitText}>ft</Text>
            </View>

            <View style={styles.heightInputContainer}>
              <TextInput
                style={styles.heightInput}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="7"
                placeholderTextColor={colors.subtext}
                // FIX: Consistent string conversion
                value={formData.profileDetails.heightIn !== undefined ? formData.profileDetails.heightIn.toString() : ''}
                onChangeText={(v) => {
                  if (v === '') {
                    setFormData(prev => ({ ...prev, profileDetails: { ...prev.profileDetails, heightIn: 0 } }));
                    return;
                  }
                  let val = parseInt(v) || 0;
                  if (val > 11) val = 11;
                  setFormData(prev => ({ ...prev, profileDetails: { ...prev.profileDetails, heightIn: val } }));
                }}
              />
              <Text style={styles.heightUnitText}>in</Text>
            </View>
          </View>
          <Text style={[styles.smallLabel, { marginTop: 20 }]}>Body Type</Text>
          <View style={styles.pillRow}>
            {BODY_TYPES.map(type => (
              <TouchableOpacity key={type} style={[styles.pill, formData.profileDetails.bodyType === type && styles.pillSelected]} onPress={() => setFormData({ ...formData, profileDetails:{ ...formData.profileDetails, bodyType: type }})}>
                <Text style={[styles.pillText, formData.profileDetails.bodyType === type && styles.contrastText]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

      case 9: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Lifestyle</Text>
            <OptionalIcon/>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {["Drinking", "Smoking", "Workout", "Drugs"].map((q) => {
              const key = q.toLowerCase() as any;
              return (
                <View key={q} style={{ marginBottom: 15 }}>
                  <Text style={styles.smallLabel}>{q}</Text>
                  <View style={styles.pillRow}>
                    {LIFESTYLE_OPTS.map(opt => (
                      <TouchableOpacity key={opt} style={[styles.pill, formData.profileDetails[key] === opt && styles.pillSelected]} onPress={() => setFormData({...formData, profileDetails:{ ...formData.profileDetails, [key]: opt}})}>
                          <Text style={[styles.pillText, formData.profileDetails[key] === opt && styles.contrastText]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            <Text style={styles.smallLabel}>Active Time</Text>
            <View style={styles.pillRow}>
              {ACTIVE_TIMES.map(t => (
                <TouchableOpacity key={t} style={[styles.pill, formData.profileDetails.activeTime === t && styles.pillSelected]} onPress={() => setFormData({...formData, profileDetails:{ ...formData.profileDetails, activeTime: t}})}>
                    <Text style={[styles.pillText, formData.profileDetails.activeTime === t && styles.contrastText]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      );

      case 10: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Career</Text>
            <OptionalIcon/>
          </View>
          <View style={styles.unifiedCard}>
            <Briefcase size={18} color={colors.primary} />
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Job Title" 
              placeholderTextColor={colors.subtext} 
              value={formData.profileDetails.jobTitle} 
              onChangeText={(v) => setFormData({...formData, profileDetails: {...formData.profileDetails, jobTitle: v}})} 
            />
          </View>
          <View style={[styles.unifiedCard, { marginTop: 15 }]}>
            <Building size={18} color={colors.primary} />
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Company" 
              placeholderTextColor={colors.subtext} 
              value={formData.profileDetails.work} 
              onChangeText={(v) => setFormData({...formData, profileDetails:{ ...formData.profileDetails, work: v}})} 
            />
          </View>
        </View>
      );

      case 11: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Education</Text>
            <OptionalIcon/>
          </View>
          <View style={styles.dropdownCard}>
            <GraduationCap size={18} color={colors.primary} />
            <Dropdown 
              style={styles.educationDropdown} 
              data={DEGREES.map(d => ({ label: d, value: d }))} 
              labelField="label" valueField="value" 
              placeholder="Select degree" 
              placeholderStyle={{ color: colors.subtext, fontSize: 16 }}
              selectedTextStyle={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
              itemTextStyle={{ color: colors.text }}
              containerStyle={{ backgroundColor: colors.card, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderTopWidth: 0, shadowColor: 'transparent' }}
              activeColor={colors.surface}
              value={formData.profileDetails.education} 
              onChange={(item) => setFormData({...formData, profileDetails:{ ...formData.profileDetails, education: item.value}})} 
            />
          </View>
          <View style={[styles.unifiedCard, { marginTop: 15 }]}>
            <School size={18} color={colors.primary} />
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="School" 
              placeholderTextColor={colors.subtext} 
              value={formData.profileDetails.school} 
              onChangeText={(v) => setFormData({...formData, profileDetails:{ ...formData.profileDetails, school: v}})} 
            />
          </View>
        </View>
      );

      case 12: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Background</Text>
          </View>
          
          <View style={styles.titleRow}>
            <Text style={styles.smallLabel}>Ethnicity</Text>
            <OptionalIcon/>
          </View>
          <View style={styles.unifiedCard}>
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Your ethnicity" 
              placeholderTextColor={colors.subtext} 
              value={formData.profileDetails.ethnicity} 
              onChangeText={(v) => setFormData({...formData, profileDetails: {...formData.profileDetails, ethnicity: v}})} 
            />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.smallLabel}>Religion</Text>
            <OptionalIcon/>
          </View>
          <View style={styles.unifiedCard}>
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Your religion" 
              placeholderTextColor={colors.subtext} 
              value={formData.profileDetails.religion} 
              onChangeText={(v) => setFormData({...formData, profileDetails:{ ...formData.profileDetails, religion: v}})} 
            />
          </View>

          <View style={[styles.titleRow, { marginTop: 20 }]}>
            <Text style={styles.smallLabel}>Languages</Text>
            <RequiredIcon/>
          </View>
          <View style={styles.pillRow}>
            {formData.profileDetails.languages.map(l => (
              <TouchableOpacity key={l} style={styles.pill} onPress={() => setFormData(prev => ({ ...prev, profileDetails: { ...prev.profileDetails, languages: prev.profileDetails.languages.filter(lang => lang !== l) }}))}>
                <Text style={styles.pillText}>{l} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.unifiedCard, { marginTop: 10 }]}>
            <LangIcon size={18} color={colors.primary} />
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Search languages..." 
              placeholderTextColor={colors.subtext} 
              value={langSearch} 
              onChangeText={setLangSearch} 
            />
          </View>
          {langSearch.length > 0 && (
            <ScrollView style={styles.searchDropdown} keyboardShouldPersistTaps="handled">
              {LANGUAGES.filter(l => l.toLowerCase().includes(langSearch.toLowerCase())).map(l => (
                <TouchableOpacity key={l} style={styles.searchItem} onPress={() => {
                  if (!formData.profileDetails.languages.includes(l)) setFormData(prev => ({ ...prev, profileDetails: { ...prev.profileDetails, languages: [...prev.profileDetails.languages, l] }}));
                  setLangSearch("");
                }}>
                  <Text style={{ color: colors.text }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      );

      case 13: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Musical DNA</Text>
            <RequiredIcon/>
          </View>
          <Text style={styles.smallLabel}>Pick 5 songs that define you</Text>
          <View style={styles.unifiedCard}>
            <Search size={20} color={colors.primary} />
            <TextInput 
              style={styles.cardTextInput} 
              placeholder="Search for a song..." 
              placeholderTextColor={colors.subtext} 
              value={songSearch} 
              onChangeText={handleSongSearch} 
            />
          </View>
          {isSearchingSongs && <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} />}
          {songResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                {songResults.map((track) => (
                  <TouchableOpacity key={track.trackId} style={styles.songItem} onPress={() => toggleSongSelection(track)}>
                    <Image source={{ uri: track.artworkUrl100 }} style={styles.songArt} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.songTitle} numberOfLines={1}>{track.trackName}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{track.artistName}</Text>
                    </View>
                    {formData.music.topSongs.some(s => s.trackId === track.trackId) && <Check size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.selectedSongsList}>
            {formData.music.topSongs.map((track) => (
              <View key={track.trackId} style={styles.selectedSongRow}>
                <Image source={{ uri: track.artworkUrl100 }} style={styles.songArt} />
                <Text style={styles.selectedSongTitle} numberOfLines={1}>{track.trackName}</Text>
                <TouchableOpacity onPress={() => toggleSongSelection(track)}>
                  <X size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      );

      case 14: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Main Music</Text>
            <RequiredIcon/>
          </View>
          <Text style={styles.smallLabel}>Pick one for your profile</Text>
          <View style={styles.mainMusicGrid}>
            {formData.music.topSongs.map((track) => {
              const isMain = formData.music.mainTrackId === track.trackId;
              return (
                <TouchableOpacity 
                  key={track.trackId} 
                  style={[styles.mainMusicCard, isMain && styles.mainMusicCardSelected]}
                  onPress={() => setFormData(prev => ({ ...prev, music: { ...prev.music, mainTrackId: track.trackId }}))}
                >
                  <Image source={{ uri: track.artworkUrl100.replace('100x100bb', '400x400bb') }} style={styles.mainMusicArt} />
                  <View style={styles.mainMusicInfo}>
                    <Text style={styles.mainMusicTitleText} numberOfLines={1}>{track.trackName}</Text>
                    <Text style={styles.mainMusicArtistText} numberOfLines={1}>{track.artistName}</Text>
                  </View>
                  {isMain && (
                    <View style={styles.mainMusicBadge}>
                      <Star size={12} color={isDark ? '#121212' : '#FFF'} fill={isDark ? '#121212' : '#FFF'} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );

      case 15: return (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifications</Text>
            <RequiredIcon/>
          </View>
          <View style={styles.settingsCard}>
            {[
              { label: "New Matches", key: "notifyMatches" },
              { label: "New Messages", key: "notifyMessages" },
              { label: "New Likes", key: "notifyLikes" }
            ].map(item => (
              <View key={item.key} style={styles.settingRow}>
                <View style={styles.settingLabelGroup}>
                  <Bell size={20} color={colors.primary} />
                  <Text style={styles.settingLabelText}>{item.label}</Text>
                </View>
                <Switch 
                  value={(formData.settings as any)[item.key]} 
                  onValueChange={(v) => setFormData({...formData, settings: {...formData.settings, [item.key]: v}})} 
                  trackColor={{ true: colors.primary }} 
                />
              </View>
            ))}
          </View>
        </View>
      );

      default: return null;
    }
  };

  const currentStepIsValid = checkIsValid();
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>MIXMATCH</Text>
        <View style={styles.progressContainer}>
           <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }]} />
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.progressDot, 
                    { left: `${(i / (TOTAL_STEPS - 1)) * 100}%` },
                    i <= step ? styles.dotActive : styles.dotInactive
                  ]} 
                />
              ))}
           </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {renderStep()}
        </ScrollView>
        
        <View style={styles.legendContainer}>
           <View style={styles.legendItem}>
             <Star size={14} color={colors.primary} fill={colors.primary} />
             <Text style={styles.legendText}>Required</Text>
           </View>
           <View style={styles.legendItem}>
             <Circle size={12} color={colors.subtext} />
             <Text style={styles.legendText}>Optional</Text>
           </View>
        </View>

        <View style={styles.bottomBar}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={back}>
              <ArrowLeft size={26} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.nextBtn, !currentStepIsValid && styles.disabled]} 
            onPress={handleNextPress} 
            activeOpacity={0.7}
          >
            {isSaving ? (
              <ActivityIndicator color={isDark ? '#121212' : '#FFF'} />
            ) : (
              <Text style={styles.btnText}>{isLastStep ? 'Start Mixing' : 'Continue'}</Text>
            )}
          </TouchableOpacity>   
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background, 
    paddingHorizontal: 25 
  },
  header: { 
    paddingVertical: 15, 
    gap: 15 
  },
  logo: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: colors.primary, 
    letterSpacing: -1.5 
  },
  progressContainer: { 
    height: 12, 
    justifyContent: 'center', 
    width: '100%', 
    paddingHorizontal: 6 
  },
  progressTrack: { 
    height: 4, 
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
    borderRadius: 2, 
    flexDirection: 'row', 
    alignItems: 'center', 
    position: 'relative' 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: colors.primary, 
    borderRadius: 2, 
    position: 'absolute', 
    left: 0 
  },
  progressDot: { 
    position: 'absolute', 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    marginLeft: -5, 
    borderWidth: 2 
  },
  dotActive: { 
    backgroundColor: colors.primary, 
    borderColor: colors.primary 
  },
  dotInactive: { 
    backgroundColor: colors.background, 
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    paddingBottom: 40 
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flexWrap: 'wrap', 
    marginBottom: 15 
  },
  title: { 
    fontSize: 30, 
    fontWeight: '800', 
    color: colors.text 
  },
  smallLabel: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: colors.subtext, 
    textTransform: 'uppercase', 
    letterSpacing: 1.2, 
    marginVertical: 10 
  },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 2, 
    borderColor: colors.border, 
    paddingBottom: 10 
  },
  textInput: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 18, 
    color: colors.text, 
    fontWeight: '600' 
  },
  unifiedCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 20, 
    backgroundColor: colors.card 
  },
  cardTextInput: { 
    flex: 1, 
    marginLeft: 10, 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.text 
  },
  pillRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  pill: { 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 22, 
    backgroundColor: colors.card 
  },
  pillSelected: { 
    backgroundColor: colors.primary 
  },
  pillText: { 
    fontWeight: '700', 
    color: colors.subtext, 
    fontSize: 14 
  },
  contrastText: { 
    color: isDark ? '#121212' : '#FFF' 
  },

  locationDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.subtext,
  },
  locationValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  fetchLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  fetchLocationText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  distanceLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  orDivider: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 20
  },
  line: {
    flex: 1, 
    height: 1, 
    backgroundColor: colors.border
  },
  orText: {
    marginHorizontal: 15, 
    color: colors.subtext, 
    fontWeight: '800'
  },

  manualHeightRow: { 
    flexDirection: 'row', 
    gap: 15 
  },
  heightInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.card, 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    borderRadius: 20, 
    flex: 1 
  },
  heightInput: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center', 
    width: 40,          
  },
  heightUnitText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.subtext 
  },
  cardInputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderColor: colors.border, 
    paddingBottom: 15 
  },
  gpsButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 15 
  },
  gpsButtonText: { 
    marginLeft: 8, 
    color: colors.primary, 
    fontWeight: '800' 
  },
  legendContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 30, 
    paddingVertical: 15, 
    borderTopWidth: 1, 
    borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  legendText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: colors.subtext 
  },
  bottomBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingBottom: 20 
  },
  nextBtn: { 
    flex: 1, 
    backgroundColor: colors.primary, 
    padding: 18, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  btnText: { 
    color: isDark ? '#121212' : '#FFF', 
    fontSize: 17, 
    fontWeight: '800' 
  },
  disabled: { 
    backgroundColor: colors.border, 
    opacity: 0.7 
  },
  backBtn: { 
    padding: 15, 
    borderRadius: 16, 
    backgroundColor: colors.card 
  },
  settingsCard: { 
    backgroundColor: colors.card, 
    borderRadius: 20, 
    padding: 10 
  },
  settingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  settingLabelGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  settingLabelText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: colors.text 
  },
  dropdownCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 20, 
    backgroundColor: colors.card, 
    paddingHorizontal: 16 
  },
  educationDropdown: { 
    flex: 1, 
    height: 50 
  },
  birthdayCard: { 
    backgroundColor: colors.card, 
    borderRadius: 24, 
    padding: 10, 
    alignSelf: 'center', 
    overflow: 'hidden' 
  },
  searchResultsContainer: { 
    backgroundColor: colors.card, 
    borderRadius: 20, 
    marginTop: 10, 
    overflow: 'hidden' 
  },
  songItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  songArt: { 
    width: 40, 
    height: 40, 
    borderRadius: 5 
  },
  songTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: colors.text 
  },
  songArtist: { 
    fontSize: 12, 
    color: colors.subtext 
  },
  selectedSongsList: { 
    marginTop: 15 
  },
  selectedSongRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: colors.surface, 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 8 
  },
  selectedSongTitle: { 
    flex: 1, 
    fontSize: 14, 
    fontWeight: '600', 
    marginLeft: 10, 
    color: colors.text 
  },
  searchDropdown: { 
    maxHeight: 150, 
    backgroundColor: colors.card, 
    borderRadius: 15, 
    marginTop: 5 
  },
  searchItem: { 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  mainMusicGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    justifyContent: 'center' 
  },
  mainMusicCard: { 
    width: '45%', 
    backgroundColor: colors.card, 
    borderRadius: 20, 
    padding: 10 
  },
  mainMusicCardSelected: { 
    backgroundColor: colors.surface 
  },
  mainMusicArt: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 15 
  },
  mainMusicInfo: { 
    marginTop: 8, 
    alignItems: 'center' 
  },
  mainMusicTitleText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: colors.text 
  },
  mainMusicArtistText: { 
    fontSize: 12, 
    color: colors.subtext 
  },
  mainMusicBadge: { 
    position: 'absolute', 
    top: 15, 
    right: 15, 
    backgroundColor: colors.primary, 
    padding: 6, 
    borderRadius: 12 
  },
});