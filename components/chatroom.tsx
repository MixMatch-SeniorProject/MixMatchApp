import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, FlatList, Modal, Pressable,
  Animated, Linking, AppState, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ArrowLeft, Phone, EllipsisVertical,
  Send, Disc3, Trash2, ExternalLink, X, Check,
  CalendarDays, Newspaper
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';

// --- COMPONENTS & SERVICES ---
import MixtapeMaker from '@/components/mixtapeMaker';
import UnifiedProfileView from '@/components/unifiedProfileView';
import { useAuth } from '@/auth/AuthContext';
import { db } from '@/services/firebaseConfig';
import {
  collection, addDoc, setDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, updateDoc, getDoc,
  getDocs, writeBatch
} from 'firebase/firestore';

interface ChatRoomProps {
  visible: boolean;
  chat: any;
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'text' | 'playlist' | 'playlist_add' | 'playlist_remove' | 'clear_chat_request' | 'event_invite' | 'shared_post'; 
  text?: string;
  song?: any;
  event?: any;
  status?: 'pending' | 'accepted' | 'rejected';
  sender: 'me' | 'them';
  time: string;
  timestampValue?: number;
}

// --- SUB-COMPONENT: TYPING INDICATOR ---
const TypingIndicator = ({ colors, styles }: { colors: any, styles: any }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 200, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.delay(400)
        ])
      ).start();
    };
    animate(dot1, 0); animate(dot2, 150); animate(dot3, 300);
  }, []);

  return (
    <View style={[styles.typingBubble, { backgroundColor: colors.primary + '20' }]}>
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.primary, transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.primary, transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.primary, transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

// --- SUB-COMPONENT: OPTIONS MENU ---
function ChatMenu({ visible, colors, styles, onClose, onClearChat, onSimulateUnlock }: any) {
  if (!visible) return null;
  return (
    <>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.text + '15' }]}>
        <TouchableOpacity style={styles.menuItem} onPress={() => { onSimulateUnlock(); onClose(); }}>
          <Text style={[styles.menuText, { color: colors.text }]}>Simulate 100 Msgs Unlock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { onClearChat(); onClose(); }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Trash2 size={18} color={colors.danger} />
            <Text style={[styles.menuText, { color: colors.danger }]}>Clear Chat</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={onClose}>
          <Text style={[styles.menuText, { color: colors.text }]}>Block User</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={onClose}>
          <Text style={[styles.menuText, { color: colors.text }]}>Report</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function ChatRoom({ visible, chat, onClose }: ChatRoomProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [mixtapeMakerVisible, setMixtapeMakerVisible] = useState(false);

  // --- UI GIMMICK STATE --- (proof of concept)
  const [simulatedUnlock, setSimulatedUnlock] = useState(false);
  const [hasUnlocked, setHasUnlocked] = useState(false); 
  const [scrollData, setScrollData] = useState({ offset: 0, max: 0 });

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherPresent, setIsOtherPresent] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [profileVisible, setProfileVisible] = useState(false);
  const [fullProfileData, setFullProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // --- PROGRESS BAR ANIMATION ---
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // --- SCROLL PROGRESS LOGIC ---
  // If max <= 0, the content fits on the screen, so scroll fraction is essentially 100%.
  const scrollFraction = scrollData.max > 0 ? Math.max(0, Math.min(1, scrollData.offset / scrollData.max)) : 1;
  const messageProgress = Math.min((messages.length / 100), 1);
  const dynamicPercentage = messageProgress * scrollFraction * 100;

  // Latch logic: if it ever hits 100%, it stays there.
  useEffect(() => {
    if (simulatedUnlock || messages.length >= 100) {
      setHasUnlocked(true);
    }
  }, [simulatedUnlock, messages.length]);

  const progressPercentage = hasUnlocked ? 100 : dynamicPercentage;
  const callUnlocked = hasUnlocked;

  // Spring animation effect for the progress bar
  useEffect(() => {
    Animated.spring(animatedProgress, {
      toValue: progressPercentage,
      bounciness: 14, 
      speed: 12,
      useNativeDriver: false 
    }).start();
  }, [progressPercentage]);

  const widthInterpolation = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    setScrollData({
      offset: contentOffset.y,
      max: max
    });
  };

  useEffect(() => {
    if (!chat?.id || !user?.uid) return;
    const updatePresence = async (inChat: boolean) => {
      try {
        await updateDoc(doc(db, "matches", chat.id), { [`presence.${user.uid}`]: inChat });
      } catch (e) { }
    };
    if (visible) updatePresence(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (visible) updatePresence(state === "active");
    });
    const unsubPresence = onSnapshot(doc(db, "matches", chat.id), (snap) => {
      if (snap.exists()) {
        const presence = snap.data().presence || {};
        setIsOtherPresent(!!presence[chat.otherUserId]);
      }
    });
    return () => { subscription.remove(); unsubPresence(); updatePresence(false); };
  }, [visible, chat?.id]);

  useEffect(() => {
    if (!chat?.id || !visible) return;
    const msgQuery = query(collection(db, "matches", chat.id, "messages"), orderBy("timestamp", "asc"));
    const unsubMsgs = onSnapshot(msgQuery, (snap) => {
      const loaded = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type || 'text',
          text: data.text || '',
          song: data.song || null,
          event: data.event || null,
          status: data.status || 'pending',
          sender: data.senderId === user?.uid ? 'me' : 'them',
          time: data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
          timestampValue: data.timestamp?.toMillis() || Date.now()
        };
      }).filter(m => !m.id.startsWith('typing_'));
      setMessages(loaded as Message[]);
    });
    const typingRef = doc(db, "matches", chat.id, "messages", `typing_${chat.otherUserId}`);
    const unsubTyping = onSnapshot(typingRef, (snap) => {
      if (snap.exists()) setIsOtherTyping(!!snap.data().isTyping);
    });
    return () => { unsubMsgs(); unsubTyping(); };
  }, [chat?.id, visible]);

  // --- ACTIONS ---

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (!user || !chat) return;
    setDoc(doc(db, "matches", chat.id, "messages", `typing_${user.uid}`), { isTyping: true }, { merge: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "matches", chat.id, "messages", `typing_${user.uid}`), { isTyping: false }, { merge: true });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !chat) return;
    const text = inputText.trim();
    setInputText('');
    setDoc(doc(db, "matches", chat.id, "messages", `typing_${user.uid}`), { isTyping: false }, { merge: true });
    await addDoc(collection(db, "matches", chat.id, "messages"), {
      type: 'text', text, senderId: user.uid, timestamp: serverTimestamp()
    });
  };

  const handleEventResponse = async (messageId: string, response: 'accepted' | 'rejected') => {
    if (!chat?.id) return;

    const msgRef = doc(db, "matches", chat.id, "messages", messageId);
    const targetMsg = messages.find(m => m.id === messageId);

    // 1. Update the message in the chat for immediate feedback
    await updateDoc(msgRef, { status: response });

    // 2. Sync to a global invites collection for the events tab status indicators
    if (targetMsg?.event?.id) {
      const inviteId = `${chat.id}_${targetMsg.event.id}`;
      await setDoc(doc(db, "event_invites", inviteId), {
        eventId: targetMsg.event.id,
        matchId: chat.id,
        senderId: targetMsg.sender === 'me' ? user?.uid : chat.otherUserId,
        receiverId: targetMsg.sender === 'me' ? chat.otherUserId : user?.uid,
        status: response,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  const handleViewProfile = async () => {
    if (!chat?.otherUserId) return;
    setLoadingProfile(true);
    setProfileVisible(true);
    try {
      const snap = await getDoc(doc(db, "users", chat.otherUserId));
      if (snap.exists()) {
        // Stamp the profile with the chat's context so the Unified View shows the correct tag!
        setFullProfileData({
          id: snap.id,
          ...snap.data(),
          connectionMode: chat.type === 'friend' ? 'Friend' : 'Date'
        });
      }
    } catch (e) { console.error(e); } finally { setLoadingProfile(false); }
  };

  const requestClearChat = async () => {
    if (!user || !chat) return;
    await addDoc(collection(db, "matches", chat.id, "messages"), {
      type: 'clear_chat_request',
      status: 'pending',
      senderId: user.uid,
      timestamp: serverTimestamp()
    });
  };

  const handleClearResponse = async (messageId: string, response: 'accepted' | 'rejected') => {
    const msgRef = doc(db, "matches", chat.id, "messages", messageId);
    await updateDoc(msgRef, { status: response });

    if (response === 'accepted') {
      const msgsSnap = await getDocs(collection(db, "matches", chat.id, "messages"));
      const batch = writeBatch(db);
      msgsSnap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  if (!chat) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.container}>
          <View style={[styles.roomHeader, { borderBottomColor: colors.text + '20' }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerUserInfo} onPress={handleViewProfile}>
              <Image source={{ uri: chat.image }} style={styles.smallAvatar} />
              <View style={{ flexDirection: 'column' }}>
                <Text style={[styles.headerName, { color: colors.text }]}>{chat.name}</Text>
                <Text style={[styles.statusText, (isOtherTyping || isOtherPresent) && { color: colors.primary, fontWeight: 'bold' }]}>
                  {isOtherTyping ? "Typing..." : (isOtherPresent ? "In Chat" : "Away")}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {callUnlocked && <Phone size={20} color={colors.text} style={{ marginRight: 15 }} />}
              <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={15}>
                <EllipsisVertical size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Springy Glowing Progress Bar */}
          <View style={[styles.progressBarContainer, { backgroundColor: colors.text + '10' }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: widthInterpolation,
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  elevation: 5, 
                }
              ]}
            />
          </View>

          <ChatMenu
            visible={menuVisible}
            colors={colors}
            styles={styles}
            onClose={() => setMenuVisible(false)}
            onClearChat={requestClearChat}
            onSimulateUnlock={() => setSimulatedUnlock(true)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListFooterComponent={isOtherTyping ? <TypingIndicator colors={colors} styles={styles} /> : null}
              renderItem={({ item }) => {
                const isMe = item.sender === 'me';

                // --- 1. SHARED POST LOGIC (News/Media) ---
                if (item.type === 'shared_post') {
                  return (
                    <View style={[styles.messageBubbleWrapper, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                      <View style={[styles.messageBubble, isMe ? { backgroundColor: colors.secondary + '80', borderBottomRightRadius: 4 } : { backgroundColor: colors.primary + '44', borderBottomLeftRadius: 4 }]}>

                        {/* Header telling you who shared what */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <Newspaper size={14} color={isMe ? 'white' : colors.text} />
                          <Text style={{ color: isMe ? 'white' : colors.text, fontSize: 12, fontWeight: '700' }}>
                            {isMe ? 'You shared a link:' : `${chat.name} shared a link:`}
                          </Text>
                        </View>

                        {/* Clickable Card reusing your Mixtape styling */}
                        <TouchableOpacity
                          style={styles.mixtapeCard}
                          onPress={() => item.event?.url && Linking.openURL(item.event.url)}
                          activeOpacity={0.7}
                        >
                          <Image source={{ uri: item.event?.image }} style={styles.mixtapeArt} contentFit="cover" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mixtapeTitle, { color: isMe ? 'white' : colors.text }]} numberOfLines={2}>
                              {item.event?.title}
                            </Text>
                            <Text style={[styles.mixtapeArtist, { color: isMe ? 'white' : colors.text, marginTop: 2 }]} numberOfLines={1}>
                              Tap to read
                            </Text>
                          </View>
                          <ExternalLink size={14} color={isMe ? 'white' : colors.primary} opacity={0.5} />
                        </TouchableOpacity>

                      </View>
                      <Text style={styles.messageTime}>{item.time}</Text>
                    </View>
                  );
                }

                // --- 2. ACTUAL EVENT INVITE LOGIC ---
                if (item.type === 'event_invite') {
                  const isPending = item.status === 'pending';
                  const isAccepted = item.status === 'accepted';
                  const isRejected = item.status === 'rejected';

                  return (
                    <View style={styles.eventInviteContainer}>
                      <View style={[styles.eventInviteCard, { backgroundColor: colors.card, borderColor: isAccepted ? colors.primary : colors.text + '10' }]}>
                        <Image source={{ uri: item.event?.image }} style={styles.eventInviteImage} contentFit="cover" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.eventInviteTag, { color: colors.primary }]}>Event Invite</Text>
                          <Text style={[styles.eventInviteTitle, { color: colors.text }]} numberOfLines={1}>{item.event?.title}</Text>
                          <Text style={styles.eventInviteTime}>{item.event?.date}</Text>
                        </View>
                      </View>

                      {isPending && !isMe ? (
                        <View style={styles.inviteActionRow}>
                          <TouchableOpacity
                            style={[styles.inviteBtn, { backgroundColor: colors.text + '10' }]}
                            onPress={() => handleEventResponse(item.id, 'rejected')}>
                            <Text style={{ color: colors.text, fontWeight: '700' }}>Decline</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleEventResponse(item.id, 'accepted')}>
                            <Text style={{ color: 'white', fontWeight: '700' }}>I'm Down</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.inviteStatusBox}>
                          <Text style={[styles.inviteStatusText, isAccepted && { color: colors.primary }]}>
                            {isAccepted ? "✓ You're both going!" : isRejected ? "Invite declined" : "Waiting for response..."}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                }

                // --- 3. CLEAR CHAT REQUEST LOGIC ---
                if (item.type === 'clear_chat_request') {
                  const isPending = item.status === 'pending';
                  const isRejected = item.status === 'rejected';

                  return (
                    <View style={[styles.systemRequestContainer, { backgroundColor: colors.card, borderColor: isRejected ? colors.danger + '40' : colors.text + '10' }]}>
                      <Trash2 size={20} color={isRejected ? colors.danger : colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.systemRequestTitle, { color: colors.text }]}>
                          {isMe ? "You requested to clear chat" : `${chat.name} wants to clear this chat`}
                        </Text>
                        {isPending && !isMe && (
                          <View style={styles.requestActionRow}>
                            <TouchableOpacity style={[styles.reqBtn, { backgroundColor: colors.danger }]} onPress={() => handleClearResponse(item.id, 'rejected')}>
                              <X size={16} color="white" />
                              <Text style={styles.reqBtnText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.reqBtn, { backgroundColor: colors.primary }]} onPress={() => handleClearResponse(item.id, 'accepted')}>
                              <Check size={16} color="white" />
                              <Text style={styles.reqBtnText}>Confirm</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {isPending && isMe && <Text style={styles.systemRequestSub}>Waiting for confirmation...</Text>}
                        {isRejected && <Text style={[styles.systemRequestSub, { color: colors.danger }]}>Deletion Request Rejected</Text>}
                      </View>
                    </View>
                  );
                }

                const isSystem = item.type === 'playlist_add' || item.type === 'playlist_remove';
                return (
                  <View style={[styles.messageBubbleWrapper, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    {isSystem ? (
                      <View style={[styles.messageBubble, isMe ? { backgroundColor: colors.secondary + '80' } : { backgroundColor: colors.primary + '44' }, item.type === 'playlist_remove' && { backgroundColor: '#FF3B3020' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          {item.type === 'playlist_add' ? <Disc3 size={14} color={isMe ? 'white' : colors.text} /> : <Trash2 size={14} color="#FF3B30" />}
                          <Text style={{ color: item.type === 'playlist_remove' ? '#FF3B30' : (isMe ? 'white' : colors.text), fontSize: 12, fontWeight: '700' }}>
                            {isMe ? 'You' : chat.name} {item.type === 'playlist_add' ? 'added:' : 'removed:'}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.mixtapeCard} onPress={() => Linking.openURL(item.song.url)} activeOpacity={0.7}>
                          <Image source={{ uri: item.song.art }} style={styles.mixtapeArt} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mixtapeTitle, { color: isMe ? 'white' : colors.text, textDecorationLine: item.type === 'playlist_add' ? 'none' : 'line-through' }]} numberOfLines={1}>{item.song.title}</Text>
                            <Text style={[styles.mixtapeArtist, { color: isMe ? 'white' : colors.text }]} numberOfLines={1}>{item.song.artist}</Text>
                          </View>
                          <ExternalLink size={14} color={isMe ? 'white' : colors.primary} opacity={0.5} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.messageBubble, isMe ? { backgroundColor: colors.secondary + '80', borderBottomRightRadius: 4 } : { backgroundColor: colors.primary + '44', borderBottomLeftRadius: 4 }]}>
                        <Text style={[styles.messageText, isMe ? { color: 'white' } : { color: colors.text }]}>{item.text}</Text>
                      </View>
                    )}
                    <Text style={styles.messageTime}>{item.time}</Text>
                  </View>
                );
              }}
            />

            <View style={[styles.inputOuterContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.text + '05', borderColor: colors.text + '20' }]}>
                <TouchableOpacity style={styles.iconButton} onPress={() => setMixtapeMakerVisible(true)}>
                  <Disc3 size={20} color={colors.text + 'aa'} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.text + '60'}
                  value={inputText}
                  onChangeText={handleTextChange}
                  multiline
                />
                {inputText.trim().length > 0 && (
                  <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Send size={20} color="white" style={{ marginLeft: -3, marginTop: 2 }} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={profileVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProfileVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {loadingProfile ? <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /> :
            <UnifiedProfileView profile={fullProfileData} onClose={() => setProfileVisible(false)} primaryColor={colors.primary} />}
        </View>
      </Modal>

      <MixtapeMaker visible={mixtapeMakerVisible} onClose={() => setMixtapeMakerVisible(false)} chat={chat} />
    </>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  roomHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1 },
  closeButton: { marginRight: 15 },
  headerUserInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  headerName: { fontSize: 16, fontWeight: '700' },
  statusText: { fontSize: 12, color: '#888' },


  progressBarContainer: {
    height: 3,
    width: '100%',
    zIndex: 1, 
  },
  progressBarFill: {
    height: '100%',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  messageList: { paddingHorizontal: 15, paddingVertical: 20, paddingBottom: 20 },
  messageBubbleWrapper: { maxWidth: '85%', marginBottom: 15 },
  messageBubble: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTime: { fontSize: 10, color: '#888', marginTop: 4, alignSelf: 'flex-end', marginRight: 5 },
  mixtapeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 8, borderRadius: 12, width: 230 },
  mixtapeArt: { width: 40, height: 40, borderRadius: 6, marginRight: 12 },
  mixtapeTitle: { fontWeight: 'bold', fontSize: 13 },
  mixtapeArtist: { fontSize: 11, opacity: 0.7 },

  inputOuterContainer: {
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 12,
    marginBottom: 10
  },

  inputWrapper: { minHeight: 30, maxHeight: 120, borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 8, paddingVertical: 6 },
  input: { flex: 1, minHeight: 45, maxHeight: 100, borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, fontSize: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 4, backgroundColor: colors.primary + '80' },
  sendButton: { width: 60, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.tabIconDefault },
  typingBubble: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, alignSelf: 'flex-start', flexDirection: 'row', gap: 4, marginBottom: 15 },
  typingDot: { width: 6, height: 6, borderRadius: 3 },


  eventInviteContainer: { alignSelf: 'center', width: '90%', marginVertical: 15 },
  eventInviteCard: { flexDirection: 'row', padding: 12, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 12 },
  eventInviteImage: { width: 60, height: 60, borderRadius: 12 },
  eventInviteTag: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 },
  eventInviteTitle: { fontSize: 15, fontWeight: '800' },
  eventInviteTime: { fontSize: 12, opacity: 0.6 },
  inviteActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  inviteBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  inviteStatusBox: { marginTop: 8, alignItems: 'center' },
  inviteStatusText: { fontSize: 12, fontWeight: '700', opacity: 0.7 },


  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 15,
    borderRadius: 15,
    paddingVertical: 8,
    width: 200,
    zIndex: 1000,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
  },

  systemRequestContainer: {
    alignSelf: 'center',
    width: '90%',
    marginVertical: 20,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  systemRequestTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  systemRequestSub: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    fontWeight: '600'
  },
  requestActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  reqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12
  },
  reqBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800'
  }
});