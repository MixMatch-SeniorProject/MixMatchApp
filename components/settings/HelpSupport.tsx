import React, { use, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { X, HelpCircle, Mail, MessageCircle, FileText, ExternalLink, Book } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';

interface HelpSupportProps {
    onClose: () => void;
}

export default function HelpSupport({ onClose }: HelpSupportProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const helpOptions = [
        {
            icon: Book,
            title: 'FAQ',
            description: 'Find answers to common questions',
            action: () => console.log('Open FAQ'),
        },
        {
            icon: FileText,
            title: 'Terms of Service',
            description: 'Read our terms and conditions',
            action: () => console.log('Open Terms'),
        },
        {
            icon: FileText,
            title: 'Privacy Policy',
            description: 'Learn how we protect your data',
            action: () => console.log('Open Privacy Policy'),
        },
        {
            icon: Mail,
            title: 'Email Support',
            description: 'support@mixmatch.com',
            action: () => Linking.openURL('mailto:support@mixmatch.com'),
        },
        {
            icon: MessageCircle,
            title: 'Live Chat',
            description: 'Chat with our support team',
            action: () => console.log('Open Live Chat'),
        },
        {
            icon: ExternalLink,
            title: 'Visit Our Website',
            description: 'www.mixmatch.com',
            action: () => Linking.openURL('https://www.mixmatch.com'),
        },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Help & Support</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X size={28} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.welcomeCard, { backgroundColor: colors.text + '20' }]}>
                    <HelpCircle size={40} color={colors.text} />
                    <Text style={[styles.welcomeTitle, { color: colors.text }]}>How can we help?</Text>
                    <Text style={[styles.welcomeText, { color: colors.text, opacity: 0.7 }]}>
                        We're here to help you with any questions or issues
                    </Text>
                </View>

                <View style={styles.section}>
                    {helpOptions.map((option, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.helpOption,
                                { borderColor: colors.text + '20' }
                            ]}
                            onPress={option.action}>
                            <View style={styles.optionLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.text + '20' }]}>
                                    <option.icon size={22} color={colors.text} />
                                </View>
                                <View style={styles.optionInfo}>
                                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                                        {option.title}
                                    </Text>
                                    <Text style={[styles.optionDesc, { color: colors.text, opacity: 0.6 }]}>
                                        {option.description}
                                    </Text>
                                </View>
                            </View>
                            <ExternalLink size={18} color={colors.text} opacity={0.5} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.versionCard, { backgroundColor: colors.text + '15' }]}>
                    <Text style={[styles.versionText, { color: colors.text, opacity: 0.6 }]}>
                        MixMatch v1.0.0
                    </Text>
                    <Text style={[styles.versionText, { color: colors.text, opacity: 0.6 }]}>
                        © 2026 MixMatch. All rights reserved.
                    </Text>
                </View>
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
    welcomeCard: {
        padding: 25,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 25,
    },
    welcomeTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 8,
    },
    welcomeText: {
        fontSize: 14,
        textAlign: 'center',
    },
    section: {
        marginBottom: 20,
    },
    helpOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 15,
        borderWidth: 1,
        marginBottom: 12,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 14,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionInfo: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 3,
    },
    optionDesc: {
        fontSize: 13,
    },
    versionCard: {
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    versionText: {
        fontSize: 12,
        marginBottom: 4,
    },
});
