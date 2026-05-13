// app/(tabs)/messages.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, Platform, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Settings2, RotateCcw, EyeOff } from 'lucide-react-native';
import ChatRoom from '@/components/chatroom';
import { useTheme } from '@/constants/themeHelper';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuth } from '@/auth/AuthContext';
import { db } from '@/services/firebaseConfig';
import {
  collection, query, where, onSnapshot, doc, getDoc,
  orderBy, limit, getDocs
} from 'firebase/firestore';
import { chatService } from '@/services/chatService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONTAINER_WIDTH = SCREEN_WIDTH - 50;
const PILL_PADDING = 4;
const TAB_WIDTH = (CONTAINER_WIDTH - (PILL_PADDING * 2)) / 3;

const TABS = ['Date', 'All', 'Friend'] as const;
type TabType = typeof TABS[number];

export default function MessagesScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  const [currentMode, setCurrentMode] = useState<TabType>('All');

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const inboxData = await Promise.all(
        snapshot.docs.map(async (matchDoc) => {
          const data = matchDoc.data();
          const matchId = matchDoc.id;
          const otherUserId = data.users.find((id: string) => id !== user.uid);
          const userSnap = await getDoc(doc(db, "users", otherUserId));
          const userData = userSnap.exists() ? userSnap.data() : null;
          const isOtherPresent = !!(data.presence?.[otherUserId]);
          const isHidden = !!(data.hiddenBy?.[user.uid]);

          const messagesRef = collection(db, "matches", matchId, "messages");
          const lastMsgQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
          const lastMsgSnap = await getDocs(lastMsgQuery);

          let lastMessageText = "Start chatting! 👋";
          let timestampStr = "";

          if (!lastMsgSnap.empty) {
            const msgData = lastMsgSnap.docs[0].data();

            switch (msgData.type) {
              case 'text':
                lastMessageText = msgData.text;
                break;
              case 'playlist_add':
                lastMessageText = `🎵 Added: ${msgData.song?.title || 'a track'}`;
                break;
              case 'playlist_remove':
                lastMessageText = `🗑️ Removed a track from the mix`;
                break;
              case 'clear_chat_request':
                lastMessageText = `⚠️ Requested to clear chat`;
                break;
              case 'playlist':
                lastMessageText = `👤 Shared Identity DNA`;
                break;
              default:
                lastMessageText = msgData.text || "Sent a message";
            }

            if (msgData.timestamp) {
              timestampStr = msgData.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }

          return {
            id: matchId,
            otherUserId,
            name: userData?.name || "Unknown",
            age: userData?.age || "",
            image: userData?.mainMusicArt || userData?.image || "",
            lastMessage: lastMessageText,
            timestamp: timestampStr,
            type: data.mode?.toLowerCase() === 'friend' ? 'friend' : 'date',
            isOtherPresent,
            isHidden
          };
        })
      );

      setConversations(inboxData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleToggleHide = async (matchId: string, hide: boolean) => {
    if (!user) return;
    await chatService.toggleHideChat(matchId, user.uid, hide);
  };

  const switchTab = (tab: TabType, index: number) => {
    if (currentMode === tab) return;
    setCurrentMode(tab);
    setIsEditMode(false);

    Animated.spring(slideAnim, {
      toValue: index,
      useNativeDriver: true,
      bounciness: 8,
      speed: 12
    }).start();

    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const newTab = TABS[index];

    if (currentMode !== newTab) {
      setCurrentMode(newTab);
      setIsEditMode(false);
      Animated.spring(slideAnim, {
        toValue: index,
        useNativeDriver: true,
        bounciness: 8,
        speed: 12
      }).start();
    }
  };

  const renderRightActions = (id: string) => (
    <TouchableOpacity style={styles.hideAction} onPress={() => handleToggleHide(id, true)} activeOpacity={0.8}>
      <EyeOff size={20} color="white" />
      <Text style={styles.actionText}>Hide</Text>
    </TouchableOpacity>
  );

  const renderPage = (mode: TabType) => {
    const filteredConversations = conversations.filter((c) => {
      const modeMatch = mode === 'All' ? true : (mode === 'Date' ? c.type === 'date' : c.type === 'friend');
      return modeMatch && (isEditMode ? c.isHidden : !c.isHidden);
    });

    return (
      <ScrollView
        key={mode}
        style={{ width: SCREEN_WIDTH }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 50 }} />
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyTitle}>{isEditMode ? "No hidden chats" : "Inbox Empty"}</Text>
            <Text style={styles.emptySubtitle}>
              {isEditMode
                ? "Swipe left on a chat to hide it from your main inbox."
                : `No ${mode === 'All' ? '' : mode.toLowerCase()} messages yet.`}
            </Text>
          </View>
        ) : (
          filteredConversations.map((conversation) => (
            <Swipeable
              key={conversation.id}
              enabled={!isEditMode}
              renderRightActions={() => renderRightActions(conversation.id)}
            >
              <TouchableOpacity
                onPress={() => isEditMode ? null : setActiveChat(conversation)}
                style={[styles.conversationCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}
                activeOpacity={0.7}
              >
                <View>
                  <Image source={{ uri: conversation.image }} style={styles.profileImage} contentFit="cover" />
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: conversation.isOtherPresent ? '#4ADE80' : '#FFFFFF', borderColor: colors.card }
                  ]} />
                </View>

                <View style={styles.messageInfo}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.name}>{conversation.name}, {conversation.age}</Text>
                    <Text style={styles.timestamp}>{conversation.timestamp}</Text>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conversation.lastMessage}
                  </Text>
                </View>

                {isEditMode && (
                  <TouchableOpacity style={styles.restoreBtn} onPress={() => handleToggleHide(conversation.id, false)}>
                    <RotateCcw size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>

        {activeChat ? (
          <ChatRoom
            visible={true}
            chat={activeChat}
            onClose={() => setActiveChat(null)}
          />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.brandText, { color: colors.text }]}>
                Mess<Text style={{ color: colors.primary }}>ages</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setIsEditMode(!isEditMode)}
                style={[styles.editBtn, isEditMode && { backgroundColor: colors.primary + '20' }]}
              >
                <Settings2 size={22} color={isEditMode ? colors.primary : colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modeContainer}>
              <Animated.View
                style={[
                  styles.animatedPill,
                  { backgroundColor: colors.primary },
                  {
                    transform: [{
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2]
                      })
                    }]
                  }
                ]}
              />

              {TABS.map((m, index) => {
                const isActive = currentMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={styles.modeBtn}
                    onPress={() => switchTab(m, index)}>
                    <Text style={[styles.modeText, { color: isActive ? 'white' : colors.text + '60' }]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ flex: 1 }}
              contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
            >
              {TABS.map(tab => renderPage(tab))}
            </ScrollView>
          </>
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 10 },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  editBtn: { padding: 10, borderRadius: 12 },
  modeContainer: { flexDirection: 'row', marginHorizontal: 25, backgroundColor: colors.card, padding: PILL_PADDING, borderRadius: 20, marginBottom: 15, position: 'relative' },
  animatedPill: { position: 'absolute', top: PILL_PADDING, bottom: PILL_PADDING, left: PILL_PADDING, width: TAB_WIDTH, borderRadius: 18 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, zIndex: 1 },
  modeText: { fontWeight: '700', fontSize: 13 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 120 },
  conversationCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 25, marginBottom: 12, borderWidth: 1 },
  profileImage: { width: 55, height: 55, borderRadius: 27.5 },
  statusDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  messageInfo: { flex: 1, marginLeft: 15 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  timestamp: { fontSize: 12, color: colors.text, opacity: 0.5, fontWeight: '600' },
  lastMessage: { fontSize: 14, color: colors.text, opacity: 0.7, fontWeight: '500' },
  hideAction: { backgroundColor: '#8E8E93', justifyContent: 'center', alignItems: 'center', width: 80, height: '88%', borderRadius: 25, marginLeft: 10 },
  actionText: { color: 'white', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  restoreBtn: { padding: 10, marginLeft: 10 },
  emptyStateContainer: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.text, opacity: 0.5, textAlign: 'center', marginTop: 10 },
});