import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { X, Bell, Heart, MessageCircle, Users, Music } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';

interface NotificationsProps {
    onClose: () => void;
}

export default function Notifications({ onClose }: NotificationsProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);


    const [pushEnabled, setPushEnabled] = useState(true);
    const [matches, setMatches] = useState(true);
    const [messages, setMessages] = useState(true);
    const [likes, setLikes] = useState(true);
    const [musicUpdates, setMusicUpdates] = useState(false);
    const [emailNotifs, setEmailNotifs] = useState(false);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X size={28} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* push notifications */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Push Notifications</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Bell size={22} color={colors.text} />
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Enable Push Notifications</Text>
                                <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                    Receive notifications on your device
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={pushEnabled}
                            onValueChange={setPushEnabled}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={pushEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* notification types */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Types</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Users size={22} color={colors.text} />
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>New Matches</Text>
                                <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                    When you get a new match
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={matches}
                            onValueChange={setMatches}
                            disabled={!pushEnabled}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={matches ? '#fff' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <MessageCircle size={22} color={colors.text} />
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Messages</Text>
                                <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                    When you receive a new message
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={messages}
                            onValueChange={setMessages}
                            disabled={!pushEnabled}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={messages ? '#fff' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Heart size={22} color={colors.text} />
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Likes</Text>
                                <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                    When someone likes you
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={likes}
                            onValueChange={setLikes}
                            disabled={!pushEnabled}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={likes ? '#fff' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Music size={22} color={colors.text} />
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Music Updates</Text>
                                <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                    New songs from your favorite artists
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={musicUpdates}
                            onValueChange={setMusicUpdates}
                            disabled={!pushEnabled}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={musicUpdates ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* email notifications */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Email</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Email Notifications</Text>
                            <Text style={[styles.settingDesc, { color: colors.text, opacity: 0.6 }]}>
                                Receive updates via email
                            </Text>
                        </View>
                        <Switch
                            value={emailNotifs}
                            onValueChange={setEmailNotifs}
                            trackColor={{ false: '#767577', true: colors.text }}
                            thumbColor={emailNotifs ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* save button */}
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={onClose}>
                    <Bell size={20} color={colors.background} />
                    <Text style={[styles.saveButtonText, { color: colors.background }]}>Save Settings</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 5,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 15,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    settingInfo: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDesc: {
        fontSize: 13,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 25,
        marginTop: 10,
        marginBottom: 40,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
