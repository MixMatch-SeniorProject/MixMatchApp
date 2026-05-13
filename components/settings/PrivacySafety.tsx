import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { 
    X, Shield, Heart, UserRoundPen, Fingerprint, Church, 
    Ruler, Briefcase, GraduationCap, Wine, Cigarette, 
    Pill, Dumbbell, Timer, MapPin, EyeOff, User, Check
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { useAuth } from '@/auth/AuthContext';
import { userService } from '@/services/userService';

const TOGGLE_GROUPS = [
    {
        title: "General",
        items: [
            { id: 'distance', label: 'Distance Away', icon: MapPin, desc: "Show how far away you are" }
        ]
    },
    {
        title: "Essentials",
        items: [
            { id: 'height', label: 'Height', icon: Ruler, desc: "Display your height" },
            { id: 'bodyType', label: 'Body Type', icon: User, desc: "Display your body type" },
            { id: 'work', label: 'Work & Company', icon: Briefcase, desc: "Display your job title and company" },
            { id: 'education', label: 'Education & School', icon: GraduationCap, desc: "Display your degree and school" },
        ]
    },
    {
        title: "Identity",
        items: [
            { id: 'sexuality', label: 'Sexuality', icon: Heart, desc: "Display your sexual orientation" },
            { id: 'pronouns', label: 'Pronouns', icon: UserRoundPen, desc: "Display your pronouns" },
            { id: 'ethnicity', label: 'Ethnicity', icon: Fingerprint, desc: "Display your ethnicity" },
            { id: 'religion', label: 'Religion', icon: Church, desc: "Display your religious beliefs" },
        ]
    },
    {
        title: "Lifestyle",
        items: [
            { id: 'drinking', label: 'Drinking', icon: Wine, desc: "Display drinking habits" },
            { id: 'smoking', label: 'Smoking', icon: Cigarette, desc: "Display smoking habits" },
            { id: 'drugs', label: 'Drugs', icon: Pill, desc: "Display drug habits" },
            { id: 'workout', label: 'Workout', icon: Dumbbell, desc: "Display workout frequency" },
            { id: 'activeTime', label: 'Active Time', icon: Timer, desc: "Display your active hours" },
        ]
    }
];

interface PrivacySafetyProps {
    onClose: () => void;
}

export default function PrivacySafety({ onClose }: PrivacySafetyProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { user, profile, refreshProfile } = useAuth();


    const [hiddenFields, setHiddenFields] = useState<string[]>(profile?.hiddenFields || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await userService.updateUserProfile(user.uid, { hiddenFields });
            await refreshProfile();
            onClose();
        } catch (e) {
            Alert.alert("Error", "Failed to update privacy settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleVisibility = (id: string, isVisible: boolean) => {

        if (isVisible) {
            setHiddenFields(prev => prev.filter(field => field !== id));
        } else {
            setHiddenFields(prev => [...prev, id]);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.headerButton}>
                    <X size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Profile Privacy</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.headerButton}>
                    {isSaving ? <ActivityIndicator size="small" color={colors.text} /> : <Check size={26} color={colors.primary} />}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <View style={styles.group}>
                    <View style={styles.disclaimerBox}>
                        <EyeOff size={22} color={colors.primary} />
                        <Text style={[styles.disclaimerText, { color: colors.text }]}>
                            Toggle off any attributes you wish to hide from your public profile. Essential items like your Name, Age, Location, Gender, and Music cannot be hidden.
                        </Text>
                    </View>
                </View>

                {TOGGLE_GROUPS.map((group, groupIdx) => (
                    <View key={groupIdx} style={styles.group}>
                        <Text style={styles.groupLabel}>{group.title}</Text>
                        
                        <View style={styles.card}>
                            {group.items.map((item, itemIdx) => {
                                const Icon = item.icon;
                                const isVisible = !hiddenFields.includes(item.id);
                                const isLast = itemIdx === group.items.length - 1;

                                return (
                                    <View key={item.id} style={[styles.itemRow, !isLast && styles.itemBorder]}>
                                        <View style={styles.itemLeft}>
                                            <Icon size={20} color={isVisible ? colors.text : colors.text + '50'} />
                                            <View style={styles.itemInfo}>
                                                <Text style={[styles.itemLabel, { color: isVisible ? colors.text : colors.text + '50' }]}>{item.label}</Text>
                                                <Text style={[styles.itemDesc, { color: colors.text + '80' }]}>{item.desc}</Text>
                                            </View>
                                        </View>
                                        <Switch
                                            value={isVisible}
                                            onValueChange={(val) => toggleVisibility(item.id, val)}
                                            trackColor={{ false: 'rgba(150,150,150,0.3)', true: colors.primary }}
                                            thumbColor={'#fff'}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color={colors.background} />
                    ) : (
                        <>
                            <Shield size={20} color={colors.background} fill={colors.background} />
                            <Text style={[styles.saveButtonText, { color: colors.background }]}>Update Visibility</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    headerButton: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    scrollContent: { paddingVertical: 10, paddingBottom: 60 },
    
    group: { marginTop: 24, paddingHorizontal: 16 },
    groupLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: colors.subtext, marginLeft: 8, marginBottom: 8, letterSpacing: 1 },
    
    card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)', backgroundColor: colors.card },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, minHeight: 60 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    itemInfo: { flex: 1 },
    itemLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    itemDesc: { fontSize: 12, fontWeight: '500' },

    disclaimerBox: { flexDirection: 'row', backgroundColor: colors.card, padding: 20, borderRadius: 24, gap: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)' },
    disclaimerText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20, opacity: 0.8 },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 25, marginTop: 10, marginHorizontal: 16, marginBottom: 50 },
    saveButtonText: { fontSize: 16, fontWeight: '800' },
});