import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, RefreshControl, Alert, ActivityIndicator, Linking, Modal, FlatList, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Bookmark, CalendarDays, Newspaper, PlayCircle,
  Share2, ExternalLink, RefreshCw, X, Send, Settings2, Plus, Trash2, Pencil, RotateCcw, Check, Timer, Music, Play, Pause
} from 'lucide-react-native';
import { playPreview, stopPreview, getStatus } from '@/services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/constants/themeHelper';

// Services
import { eventService, AppEvent, RssSource, DEFAULT_RSS_SOURCES } from '@/services/eventService';
import { matchService } from '@/services/matchService';
import { useAuth } from '@/auth/AuthContext';
import { db } from '@/services/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_WIDTH = SCREEN_WIDTH - 50;
const PILL_PADDING = 4;
const TAB_WIDTH = (CONTAINER_WIDTH - (PILL_PADDING * 2)) / 3;

const TABS = ['Feed', 'Events', 'Saved'] as const;
type TabType = typeof TABS[number];

type AugmentedEvent = AppEvent & {
  isGoing?: boolean;
  isCancelled?: boolean;
  invite?: {
    id: string;
    status: string;
    otherUserName: string;
  };
};

export default function EventsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();

  const [events, setEvents] = useState<AugmentedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMode, setCurrentMode] = useState<TabType>('Feed');

  // --- Feed Limit State ---
  const [visibleLimit, setVisibleLimit] = useState(20);

  // Modals & Sharing State
  const [selectedPost, setSelectedPost] = useState<AppEvent | null>(null);
  const [eventToShare, setEventToShare] = useState<AppEvent | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // --- Restore Modal State ---
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);

  // Edit Date State
  const [editDateModalVisible, setEditDateModalVisible] = useState(false);
  const [editingDatePost, setEditingDatePost] = useState<AugmentedEvent | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);
  const [isSavingDate, setIsSavingDate] = useState(false);

  // RSS Feed Management State
  const [feedModalVisible, setFeedModalVisible] = useState(false);
  const [rssFeeds, setRssFeeds] = useState<RssSource[]>([]);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [isSavingFeeds, setIsSavingFeeds] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // --- Audio Player State & Logic ---
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => { stopPreview(); };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playingUrl) {
      interval = setInterval(async () => {
        const status = await getStatus();
        if (status) {
          setProgress(status.position / status.duration);
          if (status.didJustFinish) {
            setPlayingUrl(null);
            setProgress(0);
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [playingUrl]);

  const handleTogglePlay = async (url: string | undefined) => {
    if (!url) return;
    if (playingUrl === url) {
      await stopPreview();
      setPlayingUrl(null);
      setProgress(0);
    } else {
      await stopPreview();
      setProgress(0);
      await playPreview(url);
      setPlayingUrl(url);
    }
  };

  // --- 1. LOAD DATA ---
  useEffect(() => {
    loadFeedData(true);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      eventService.getUserFeeds(user.uid).then(setRssFeeds);
    }
  }, [user]);

  const loadFeedData = async (showLoading = true) => {
    if (showLoading && !refreshing) setLoading(true);

    const cachedFeedData = await eventService.getEventsFromFirebase(user?.uid || "");
    const inviteMap = new Map<string, any>();
    let matchIds = new Set<string>();

    if (user?.uid) {
      try {
        const { matches } = await matchService.getConnectionProfiles(user.uid);
        matchIds = new Set(matches.map((m: any) => m.id));
        setConnections(matches);

        const q1 = query(collection(db, "event_invites"), where("senderId", "==", user.uid));
        const q2 = query(collection(db, "event_invites"), where("receiverId", "==", user.uid));

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const allInvites = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() as any }));

        for (const inv of allInvites) {
          if (inv.status === 'accepted' || inv.status === 'cancelled') {
            const otherId = inv.senderId === user.uid ? inv.receiverId : inv.senderId;
            let otherName = "a match";
            const uSnap = await getDoc(doc(db, "users", otherId));
            if (uSnap.exists()) {
              otherName = uSnap.data().name;
            }

            inviteMap.set(inv.eventId, {
              id: inv.id,
              status: inv.status,
              otherUserName: otherName
            });
          }
        }
      } catch (e) {
        console.error("Error fetching accepted invites", e);
      }
    }

    let freshMatchUpdates: AppEvent[] = [];
    try {
      const updatesSnap = await getDocs(query(collection(db, 'events'), where('type', '==', 'match_update')));
      freshMatchUpdates = updatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppEvent));
    } catch (e) {
      console.log("Could not fetch match updates", e);
    }

    const mergedFeed = [
      ...freshMatchUpdates,
      ...cachedFeedData.filter(e => e.type !== 'match_update')
    ];

    const filteredGlobalFeed = mergedFeed.filter(e => {
      if (e.type === 'match_update') return e.creatorId && matchIds.has(e.creatorId);
      return true;
    });

    const enrichFeed = (rawFeed: AppEvent[]) => rawFeed.map(e => {
      const inv = inviteMap.get(e.id);
      return {
        ...e,
        invite: inv,
        isGoing: inv?.status === 'accepted',
        isCancelled: inv?.status === 'cancelled',
        isSaved: inv ? true : e.isSaved
      };
    });

    const enrichedFeed = enrichFeed(filteredGlobalFeed);

    if (enrichedFeed.length === 0 && user?.uid) {
      try {
        const freshEvents = await eventService.discoverEvents(user.uid);
        setEvents(enrichFeed(freshEvents).sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0)));
      } catch (error) {
        console.log("Auto-discover skipped.");
      }
    } else {
      setEvents(enrichedFeed.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0)));
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleDiscover = async () => {
    if (!user?.uid || refreshing) return;
    setRefreshing(true);
    try {
      await eventService.discoverEvents(user.uid);
      await loadFeedData(false);
      setVisibleLimit(20);
    } catch (error: any) {
      Alert.alert("Hold on", error.message || "Couldn't fetch new content.");
      setRefreshing(false);
    }
  };

  // --- 3. RSS FEED MANAGEMENT ---
  const handleAddOrUpdateFeed = () => {
    if (!newFeedName.trim() || !newFeedUrl.trim()) return;
    if (!newFeedUrl.startsWith('http')) {
      Alert.alert("Invalid URL", "Please enter a valid HTTP/HTTPS URL.");
      return;
    }

    if (editingFeedId) {
      setRssFeeds(rssFeeds.map(f => f.id === editingFeedId ? { ...f, name: newFeedName.trim(), url: newFeedUrl.trim() } : f));
      setEditingFeedId(null);
    } else {
      const newFeed: RssSource = {
        id: Date.now().toString(),
        name: newFeedName.trim(),
        url: newFeedUrl.trim(),
        defaultType: 'news'
      };
      setRssFeeds([...rssFeeds, newFeed]);
    }

    setNewFeedName('');
    setNewFeedUrl('');
  };

  const handleEditFeed = (feed: RssSource) => {
    setEditingFeedId(feed.id);
    setNewFeedName(feed.name);
    setNewFeedUrl(feed.url);
  };

  const handleCancelEdit = () => {
    setEditingFeedId(null);
    setNewFeedName('');
    setNewFeedUrl('');
  };

  const handleRemoveFeed = (id: string) => {
    setRssFeeds(rssFeeds.filter(f => f.id !== id));
  };

  const handleRestoreDefaults = () => {
    Alert.alert(
      "Restore Defaults?",
      "This will replace all your current sources with the default MixMatch feeds. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: () => {
            setRssFeeds(DEFAULT_RSS_SOURCES);
            handleCancelEdit();
          }
        }
      ]
    );
  };

  const handleClearFeed = () => {
    Alert.alert(
      "Nuke Feed?",
      "This will permanently delete all articles and events from your feed, including your saved bookmarks. The app will then pull a fresh batch of content.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Clear Everything",
          style: "destructive",
          onPress: async () => {
            if (!user?.uid) return;
            setFeedModalVisible(false); // Close the settings modal
            setRefreshing(true);
            try {
              // Wipe the database & cache
              await eventService.clearUserFeed(user.uid);
              // Pull a completely fresh batch
              await eventService.discoverEvents(user.uid);
              // Reload the UI
              await loadFeedData(false);
              setVisibleLimit(20);
            } catch (error) {
              Alert.alert("Error", "Failed to clear and refresh feed.");
              setRefreshing(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveFeeds = async () => {
    if (!user?.uid) return;
    setIsSavingFeeds(true);
    try {
      await eventService.saveUserFeeds(user.uid, rssFeeds);
      setFeedModalVisible(false);
      Alert.alert("Sources Saved", "Your custom RSS feeds have been updated.", [
        { text: "Refresh Feed Now", onPress: handleDiscover },
        { text: "Later", style: "cancel" }
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save feeds.");
    } finally {
      setIsSavingFeeds(false);
    }
  };

  // --- ACTIONS & DISMISS ---
  const handleToggleSave = async (eventId: string) => {
    const updatedEvents = events.map(e => e.id === eventId ? { ...e, isSaved: !e.isSaved } : e);
    setEvents(updatedEvents);
    await AsyncStorage.setItem('@feed_cache', JSON.stringify(updatedEvents));
  };

  const handleDismiss = async (eventId: string) => {
    const updatedEvents = events.map(e => e.id === eventId ? { ...e, isDeleted: true } : e);
    setEvents(updatedEvents);
    await AsyncStorage.setItem('@feed_cache', JSON.stringify(updatedEvents));
  };

  const handleRestore = async (eventId: string) => {
    const updatedEvents = events.map(e => e.id === eventId ? { ...e, isDeleted: false } : e);
    setEvents(updatedEvents);
    await AsyncStorage.setItem('@feed_cache', JSON.stringify(updatedEvents));
  };

  const handleShare = async (post: AppEvent) => {
    if (!user?.uid) return;
    setEventToShare(post);
    try {
      const { matches } = await matchService.getConnectionProfiles(user.uid);
      setConnections(matches);
    } catch (error) {
      Alert.alert("Error", "Couldn't load connections.");
    }
  };

  const sendEventToConnection = async (matchUser: any) => {
    if (!eventToShare || !user?.uid) return;
    const chatId = matchUser.matchId || matchUser.chatId || [user.uid, matchUser.id].sort().join('_');
    if (!chatId) return;

    setSharingId(matchUser.id);
    try {
      const isActualEvent = eventToShare.type === 'event';
      const messagePayload: any = {
        type: isActualEvent ? 'event_invite' : 'shared_post',
        event: { id: eventToShare.id, title: eventToShare.title, date: eventToShare.date, image: eventToShare.image, url: eventToShare.url, type: eventToShare.type },
        senderId: user.uid,
        timestamp: serverTimestamp()
      };
      if (isActualEvent) messagePayload.status = 'pending';
      await addDoc(collection(db, "matches", chatId, "messages"), messagePayload);
      Alert.alert("Sent!", `${isActualEvent ? 'Invite' : 'Link'} sent to ${matchUser.name}!`);
      setEventToShare(null);
    } catch (e) {
      Alert.alert("Error", "Couldn't send it.");
    } finally {
      setSharingId(null);
    }
  };

  const handleOpenEditDate = (post: AugmentedEvent) => {
    setEditingDatePost(post);
    setTempDate(new Date());
    setEditDateModalVisible(true);
  };

  const handleSaveDate = async () => {
    if (!editingDatePost) return;
    setIsSavingDate(true);
    try {
      const formattedStr = `${tempDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${tempDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      const updatedPost = { ...editingDatePost, date: formattedStr };
      setEvents(events.map(e => e.id === updatedPost.id ? updatedPost : e));
      if (selectedPost && selectedPost.id === updatedPost.id) setSelectedPost(updatedPost);
      await updateDoc(doc(db, "events", updatedPost.id), { date: formattedStr });
      const cache = await AsyncStorage.getItem('@feed_cache');
      if (cache) {
        const c = JSON.parse(cache);
        await AsyncStorage.setItem('@feed_cache', JSON.stringify(c.map((x: any) => x.id === updatedPost.id ? { ...x, date: formattedStr } : x)));
      }
    } catch (e) {
    } finally {
      setIsSavingDate(false);
      setEditDateModalVisible(false);
      setEditingDatePost(null);
    }
  };

  const handleCancelPlan = (inviteId: string, eventId: string) => {
    Alert.alert("Cancel Plans?", "Are you sure you want to cancel these plans?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel", style: "destructive", onPress: async () => {
          try {
            await updateDoc(doc(db, "event_invites", inviteId), { status: 'cancelled' });
            setEvents(events.map(e => e.id === eventId ? { ...e, isGoing: false, isCancelled: true, invite: { ...e.invite!, status: 'cancelled' } } : e));
          } catch (e) { }
        }
      }
    ]);
  };

  const handleUndoCancel = async (inviteId: string, eventId: string) => {
    try {
      await updateDoc(doc(db, "event_invites", inviteId), { status: 'accepted' });
      setEvents(events.map(e => e.id === eventId ? { ...e, isGoing: true, isCancelled: false, invite: { ...e.invite!, status: 'accepted' } } : e));
    } catch (e) { }
  };

  const openLink = (url: string) => { if (url) Linking.openURL(url); };

  // --- TABS & SCROLLING ---
  const switchTab = (tab: TabType, index: number) => {
    if (currentMode === tab) return;
    setCurrentMode(tab);
    Animated.spring(slideAnim, { toValue: index, useNativeDriver: true, bounciness: 8, speed: 12 }).start();
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const newTab = TABS[index];
    if (currentMode !== newTab) {
      setCurrentMode(newTab);
      Animated.spring(slideAnim, { toValue: index, useNativeDriver: true, bounciness: 8, speed: 12 }).start();
    }
  };

  // --- RENDERERS ---
  const renderPost = (post: AugmentedEvent) => {
    if (post.type === 'match_update') {
      const isPlaying = playingUrl === post.url;
      return (
        <View key={post.id} style={[styles.matchUpdateCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
          <View style={styles.matchUpdateHeader}>
            <Music size={14} color={colors.primary} />
            <Text style={[styles.matchUpdateTitle, { color: colors.text }]} numberOfLines={1}>{post.title}</Text>
            <Text style={[styles.dateText, { color: colors.subtext }]}>{post.date}</Text>
          </View>
          <View style={styles.matchUpdateInner}>
            <Image source={{ uri: post.image }} style={styles.matchUpdateArt} contentFit="cover" />
            <View style={styles.matchUpdateInfo}>
              <Text style={[styles.matchUpdateDesc, { color: colors.text }]} numberOfLines={1}>{post.description}</Text>

              {/* --- Audio Player (Full Width) --- */}
              {post.url ? (
                <View style={styles.matchUpdateControls}>
                  <TouchableOpacity onPress={() => handleTogglePlay(post.url)}>
                    {isPlaying ? <Pause size={22} color={colors.primary} fill={colors.primary} /> : <Play size={22} color={colors.primary} fill={colors.primary} style={{ marginLeft: 2 }} />}
                  </TouchableOpacity>
                  <View style={[styles.matchUpdateMiniBarBase, { backgroundColor: colors.text + '10' }]}>
                    <View style={[styles.matchUpdateMiniBarFill, { width: `${isPlaying ? progress * 100 : 0}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              ) : null}

              {/* --- Action Icons (Below Player) --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>

                {/* Left Side: Save & Dismiss */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  <TouchableOpacity onPress={() => handleToggleSave(post.id)}>
                    <Bookmark size={22} color={post.isSaved ? colors.primary : colors.text} fill={post.isSaved ? colors.primary : "transparent"} />
                  </TouchableOpacity>

                  {!post.isSaved && (
                    <TouchableOpacity onPress={() => handleDismiss(post.id)}>
                      <Text style={{ color: colors.text, opacity: 0.5, fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Right Side: YouTube Link */}
                <TouchableOpacity onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(post.description)}`)}>
                  <ExternalLink size={22} color={colors.text} opacity={0.8} />
                </TouchableOpacity>

              </View>

            </View>
          </View>
        </View>
      );
    }

    const TypeIcon = post.type === 'news' ? Newspaper : post.type === 'media' ? PlayCircle : CalendarDays;
    return (
      <View key={post.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
        <View style={styles.postHeader}>
          <View style={styles.sourceTag}>
            <TypeIcon size={16} color={colors.primary} />
            <Text style={[styles.sourceText, { color: colors.text }]}>{post.location}</Text>
          </View>
          <TouchableOpacity style={[styles.dateEditPill, { backgroundColor: colors.text + '10' }]} onPress={() => handleOpenEditDate(post)}>
            <Text style={[styles.dateText, { color: colors.subtext, fontSize: 12 }]}>{post.date}</Text>
            <Pencil size={12} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedPost(post)}>
          <View>
            <Image source={{ uri: post.image }} style={styles.postImage} contentFit="cover" />
            {post.isGoing && !post.isCancelled && (
              <View style={styles.goingBadge}>
                <Check size={12} color="white" />
                <Text style={styles.goingText}>Confirmed Plan</Text>
              </View>
            )}
          </View>
          <View style={styles.postContent}>
            <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
            {post.description && <Text style={[styles.postDesc, { color: colors.subtext }]} numberOfLines={3}>{post.description}</Text>}
          </View>
        </TouchableOpacity>
        <View style={[styles.postActions, { borderTopColor: colors.text + '10' }]}>
          <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleSave(post.id)}>
              <Bookmark size={22} color={post.isSaved ? colors.primary : colors.text} fill={post.isSaved ? colors.primary : "transparent"} />
            </TouchableOpacity>
            {!post.isSaved && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDismiss(post.id)}>
                <Text style={{ color: colors.text, opacity: 0.5, fontWeight: '600' }}>Dismiss</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rightActions}>
            {post.url && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => openLink(post.url)}>
                <ExternalLink size={22} color={colors.text} />
              </TouchableOpacity>
            )}

            {/* If it's an event, show a pill button. Otherwise, just the share icon. */}
            {post.type === 'event' ? (
              <TouchableOpacity
                style={[styles.actionBtn, { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }]}
                onPress={() => handleShare(post)}
              >
                <CalendarDays size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>Invite</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                <Share2 size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSavedPost = (post: AugmentedEvent) => {
    const isInvited = !!post.invite;
    const isCancelled = post.isCancelled;

    return (
      <View key={post.id} style={[styles.savedCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
        <View style={{ flexDirection: 'row', padding: 15 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedPost(post)}>
            <Image source={{ uri: post.image }} style={styles.savedImage} contentFit="cover" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedPost(post)}>
              <Text style={[styles.savedTitle, { color: colors.text, textDecorationLine: isCancelled ? 'line-through' : 'none' }]} numberOfLines={2}>{post.title}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.savedSub, { color: colors.text, flex: 1, marginRight: 10 }]} numberOfLines={1}>{post.location}</Text>
              <TouchableOpacity style={[styles.dateEditPill, { backgroundColor: colors.text + '10', paddingHorizontal: 8, paddingVertical: 4 }]} onPress={() => handleOpenEditDate(post)}>
                <Text style={[styles.dateText, { color: colors.subtext, opacity: 1, fontSize: 11 }]}>{post.date}</Text>
                <Pencil size={10} color={colors.text} />
              </TouchableOpacity>
            </View>
            {isInvited && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.goingWithText, { color: isCancelled ? colors.danger : colors.primary }]}>
                  {isCancelled ? `Canceled with ${post.invite?.otherUserName}` : `Going with ${post.invite?.otherUserName}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.savedActions, { borderTopColor: colors.text + '10' }]}>
          {isInvited ? (
            isCancelled ? (
              <TouchableOpacity style={styles.savedActionBtn} onPress={() => handleUndoCancel(post.invite!.id, post.id)}>
                <Pencil size={16} color={colors.text} />
                <Text style={[styles.savedActionText, { color: colors.text }]}>Edit Event (Undo Cancel)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.savedActionBtn} onPress={() => handleCancelPlan(post.invite!.id, post.id)}>
                <X size={16} color={colors.danger} />
                <Text style={[styles.savedActionText, { color: colors.danger }]}>Cancel Plans</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity style={styles.savedActionBtn} onPress={() => handleToggleSave(post.id)}>
              <Bookmark size={16} color={colors.primary} fill={colors.primary} />
              <Text style={[styles.savedActionText, { color: colors.text }]}>Remove Bookmark</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPage = (mode: TabType) => {
    // Filter the feed based on tab logic and deleted status
    const filteredFeed = events.filter((e) => {
      if (e.isDeleted) return false;
      if (mode === 'Saved') return e.isSaved;
      if (mode === 'Events') return e.type === 'event';
      if (mode === 'Feed') return e.type !== 'event';
      return true;
    });

    const displayedFeed = filteredFeed.slice(0, visibleLimit);

    return (
      <ScrollView
        key={mode}
        style={{ width: SCREEN_WIDTH }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeedData(false); }} tintColor={colors.primary} />
        }
      >
        {filteredFeed.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Newspaper size={48} color={colors.text} opacity={0.2} style={{ marginBottom: 15 }} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>
              {mode === 'Saved' ? "Save articles and events to read them later." : "Tap Discover to pull in the latest music news and events."}
            </Text>
          </View>
        ) : (
          <>
            {displayedFeed.map(post => mode === 'Saved' ? renderSavedPost(post) : renderPost(post))}

            {filteredFeed.length > visibleLimit && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: colors.primary + '40', backgroundColor: colors.card }]}
                onPress={() => setVisibleLimit(prev => prev + 20)}
              >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load Older Posts</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const memoizedPages = useMemo(() => {
    return TABS.map(tab => renderPage(tab));
  }, [events, refreshing, isDark, playingUrl, progress, visibleLimit]);

  const deletedItems = events.filter(e => e.isDeleted);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.brandText, { color: colors.text }]}>
          The <Text style={{ color: colors.primary }}>Feed</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => setFeedModalVisible(true)} style={styles.iconBtn}>
            <Settings2 size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.splitBtnContainer, { backgroundColor: refreshing ? colors.text + '20' : colors.primary }]}>
            <TouchableOpacity onPress={handleDiscover} disabled={refreshing} style={styles.discoverMainBtn}>
              {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={16} color="white" />}
              <Text style={[styles.discoverBtnText, { color: refreshing ? colors.text : 'white' }]}>
                {refreshing ? "Scanning..." : "Refresh"}
              </Text>
            </TouchableOpacity>

            <View style={styles.splitDivider} />

            <TouchableOpacity onPress={() => setRestoreModalVisible(true)} style={styles.discoverSideBtn}>
              <RotateCcw size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Custom Tabs */}
      <View style={styles.modeContainer}>
        <Animated.View
          style={[
            styles.animatedPill,
            { backgroundColor: colors.primary },
            { transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2] }) }] }
          ]}
        />
        {TABS.map((m, index) => {
          const isActive = currentMode === m;
          return (
            <TouchableOpacity key={m} style={styles.modeBtn} onPress={() => switchTab(m, index)}>
              <Text style={[styles.modeText, { color: isActive ? 'white' : colors.text + '60' }]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swipeable Pages */}
      <ScrollView
        ref={scrollRef} horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd} style={{ flex: 1 }}
      >
        {memoizedPages}
      </ScrollView>


      <Modal visible={restoreModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: colors.text + '10', paddingBottom: 15 }]}>
            <Text style={[styles.brandText, { color: colors.text, fontSize: 22 }]}>Trash</Text>
            <TouchableOpacity onPress={() => setRestoreModalVisible(false)} style={{ padding: 5 }}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={deletedItems}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Trash2 size={48} color={colors.text} opacity={0.2} style={{ marginBottom: 15 }} />
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', opacity: 0.6 }}>Trash is empty</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.restoreCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
                <Image source={{ uri: item.image }} style={styles.restoreImage} />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={[styles.restoreTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.restoreSub, { color: colors.subtext }]} numberOfLines={1}>{item.location}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRestore(item.id)} style={[styles.restoreActionBtn, { backgroundColor: colors.primary + '20' }]}>
                  <RotateCcw size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Restore</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* --- EVENT DETAILS MODAL --- */}
      <Modal visible={!!selectedPost} animationType="slide" presentationStyle="pageSheet">
        {selectedPost && (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.header, { justifyContent: 'flex-end', paddingBottom: 15, paddingTop: 20 }]}>
              <TouchableOpacity onPress={() => setSelectedPost(null)} style={{ padding: 10, backgroundColor: colors.card, borderRadius: 20 }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              <Image source={{ uri: selectedPost.image }} style={{ width: '100%', height: 300, backgroundColor: colors.text + '10' }} contentFit="cover" />
              <View style={{ padding: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <View style={styles.sourceTag}>
                    <Text style={[styles.sourceText, { color: colors.text, fontSize: 16 }]}>{selectedPost.location}</Text>
                  </View>
                </View>
                <Text style={[styles.postTitle, { color: colors.text, fontSize: 24, lineHeight: 32 }]}>{selectedPost.title}</Text>
                <Text style={[styles.postDesc, { color: colors.subtext, fontSize: 16, lineHeight: 26, marginTop: 15 }]}>{selectedPost.description}</Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* --- EDIT DATE & TIME MODAL --- */}
      <Modal visible={editDateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Fix Date & Time</Text>
              <TouchableOpacity onPress={() => { setEditDateModalVisible(false); setEditingDatePost(null); }}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 25, alignItems: 'center' }}>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={tempDate}
                  mode="datetime"
                  display="spinner"
                  themeVariant={isDark ? "dark" : "light"}
                  onChange={(e, d) => d && setTempDate(d)}
                  style={{ height: 200, width: '100%' }}
                />
              ) : (
                <View style={{ width: '100%', gap: 15, marginBottom: 20 }}>
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.text + '10' }]} onPress={() => setAndroidPickerMode('date')}>
                    <CalendarDays size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>Set Date: {tempDate.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.text + '10' }]} onPress={() => setAndroidPickerMode('time')}>
                    <Timer size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>Set Time: {tempDate.toLocaleTimeString()}</Text>
                  </TouchableOpacity>

                  {androidPickerMode && (
                    <DateTimePicker
                      value={tempDate}
                      mode={androidPickerMode}
                      display="default"
                      onChange={(e, d) => {
                        setAndroidPickerMode(null);
                        if (d) setTempDate(d);
                      }}
                    />
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 20 }]}
                onPress={handleSaveDate}
                disabled={isSavingDate}
              >
                {isSavingDate ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Save Correction</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- RSS FEEDS MODAL --- */}
      <Modal visible={feedModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: colors.text + '10', paddingBottom: 15 }]}>
            <Text style={[styles.brandText, { color: colors.text, fontSize: 22 }]}>My Sources</Text>
            <TouchableOpacity onPress={() => { setFeedModalVisible(false); handleCancelEdit(); }} style={{ padding: 5 }}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={[styles.smallLabel, { color: colors.text }]}>Current RSS Feeds</Text>
            {rssFeeds.map((feed) => (
              <View key={feed.id} style={[styles.feedRow, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.feedName, { color: colors.text }]}>{feed.name}</Text>
                  <Text style={[styles.feedUrl, { color: colors.text }]} numberOfLines={1}>{feed.url}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  <TouchableOpacity onPress={() => handleEditFeed(feed)} style={{ padding: 8 }}>
                    <Pencil size={20} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveFeed(feed.id)} style={{ padding: 8 }}>
                    <Trash2 size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <Text style={[styles.smallLabel, { color: colors.text, marginTop: 30 }]}>
              {editingFeedId ? "Edit Source" : "Add New Source"}
            </Text>
            <View style={[styles.addFeedContainer, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomColor: colors.text + '10' }]}
                placeholder="Source Name (e.g. Pitchfork)"
                placeholderTextColor={colors.text + '50'}
                value={newFeedName}
                onChangeText={setNewFeedName}
              />
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomWidth: 0 }]}
                placeholder="RSS URL (e.g. https://.../feed)"
                placeholderTextColor={colors.text + '50'}
                value={newFeedUrl}
                onChangeText={setNewFeedUrl}
                autoCapitalize="none"
                keyboardType="url"
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                {editingFeedId && (
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.text + '20', flex: 1, marginTop: 0 }]}
                    onPress={handleCancelEdit}
                  >
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0 }]}
                  onPress={handleAddOrUpdateFeed}
                >
                  {editingFeedId ? <Check size={20} color="white" /> : <Plus size={20} color="white" />}
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>
                    {editingFeedId ? "Update" : "Add Source"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={{ padding: 20, paddingBottom: 30 }}>
            
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF3B30', marginBottom: 15 }]}
              onPress={handleClearFeed}
              disabled={isSavingFeeds || refreshing}
            >
              <Trash2 size={18} color="#FF3B30" style={{ marginRight: 8, position: 'absolute', left: 20 }} />
              <Text style={{ color: '#FF3B30', fontWeight: 'bold', fontSize: 16 }}>Clear & Refresh Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, marginBottom: 15 }]}
              onPress={handleRestoreDefaults}
              disabled={isSavingFeeds}
            >
              <RotateCcw size={18} color={colors.primary} style={{ marginRight: 8, position: 'absolute', left: 20 }} />
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Restore Default Feeds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveFeeds}
              disabled={isSavingFeeds}
            >
              {isSavingFeeds ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* --- SHARE MODAL --- */}
      <Modal visible={!!eventToShare} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 20 }}>
          <View style={[styles.header, { paddingBottom: 15 }]}>
            <View style={{ flex: 1, paddingRight: 15 }}>
              <Text style={[styles.brandText, { color: colors.text, fontSize: 22 }]}>
                {eventToShare?.type === 'event' ? 'Invite to Event' : 'Share Post'}
              </Text>
              <Text style={{ color: colors.text, opacity: 0.6, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
                {eventToShare?.title}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setEventToShare(null)} style={{ padding: 10, backgroundColor: colors.card, borderRadius: 20 }}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={connections}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Share2 size={40} color={colors.text} opacity={0.2} style={{ marginBottom: 15 }} />
                <Text style={{ color: colors.text, textAlign: 'center', fontWeight: '800', fontSize: 18 }}>No connections yet</Text>
                <Text style={{ color: colors.text, textAlign: 'center', opacity: 0.5, marginTop: 5 }}>Swipe and match with people to start sharing events!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.connectionRow, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}>
                <Image source={{ uri: item.mainMusicArt || item.mainMusicImage || item.image || item.photos?.[0] }} style={styles.connectionAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connectionName, { color: colors.text }]}>{item.name}</Text>
                  {item.location && <Text style={[styles.connectionSub, { color: colors.text }]}>{item.location}</Text>}
                </View>
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                  onPress={() => sendEventToConnection(item)}
                  disabled={sharingId === item.id}
                >
                  {sharingId === item.id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                    
                      {eventToShare?.type === 'event' ? (
                        <CalendarDays size={14} color="white" style={{ marginRight: -2 }} />
                      ) : (
                        <Send size={14} color="white" style={{ marginRight: -2 }} />
                      )}

                     
                      <Text style={styles.sendBtnText}>
                        {eventToShare?.type === 'event' ? 'Invite' : 'Send'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 10 },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },

  splitBtnContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 21, overflow: 'hidden' },
  discoverMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, height: 42 },
  discoverBtnText: { fontWeight: '800', fontSize: 13 },
  splitDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  discoverSideBtn: { paddingHorizontal: 14, height: 42, justifyContent: 'center', alignItems: 'center' },

  modeContainer: { flexDirection: 'row', marginHorizontal: 25, backgroundColor: colors.card, padding: PILL_PADDING, borderRadius: 20, marginBottom: 15, position: 'relative' },
  animatedPill: { position: 'absolute', top: PILL_PADDING, bottom: PILL_PADDING, left: PILL_PADDING, width: TAB_WIDTH, borderRadius: 18 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, zIndex: 1 },
  modeText: { fontWeight: '700', fontSize: 13 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 120 },

  restoreCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  restoreImage: { width: 50, height: 50, borderRadius: 12 },
  restoreTitle: { fontSize: 15, fontWeight: '800' },
  restoreSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  restoreActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },

  loadMoreBtn: { padding: 15, alignItems: 'center', marginVertical: 15, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  loadMoreText: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  matchUpdateCard: { padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1 },
  matchUpdateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  matchUpdateTitle: { fontSize: 13, fontWeight: '800', flex: 1, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 },
  matchUpdateInner: { flexDirection: 'row', alignItems: 'center' },
  matchUpdateArt: { width: 60, height: 60, borderRadius: 12 },
  matchUpdateInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  matchUpdateDesc: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  matchUpdateControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchUpdateMiniBarBase: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  matchUpdateMiniBarFill: { height: '100%' },

  dateText: { fontSize: 12, fontWeight: '600' },
  postCard: { borderRadius: 24, marginBottom: 20, borderWidth: 1, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: { fontSize: 14, fontWeight: '700' },
  dateEditPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  postImage: { width: '100%', height: 220, backgroundColor: colors.text + '10' },
  goingBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#4ADE80', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  goingText: { color: 'white', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  postContent: { padding: 15 },
  postTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, lineHeight: 24 },
  postDesc: { fontSize: 14, opacity: 0.7, lineHeight: 20 },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1 },
  rightActions: { flexDirection: 'row', gap: 20 },
  actionBtn: { padding: 5, justifyContent: 'center' },

  savedCard: { borderRadius: 16, marginBottom: 15, borderWidth: 1, overflow: 'hidden' },
  savedImage: { width: 80, height: 80, borderRadius: 10 },
  savedTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4, lineHeight: 22 },
  savedSub: { fontSize: 12, opacity: 0.6, fontWeight: '600' },
  goingWithText: { fontSize: 12, fontWeight: '800' },
  savedActions: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  savedActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  savedActionText: { fontSize: 13, fontWeight: '700' },

  emptyStateContainer: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.text, opacity: 0.5, textAlign: 'center', marginTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: '800' },

  smallLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, opacity: 0.6 },
  feedRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1 },
  feedName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  feedUrl: { fontSize: 12, opacity: 0.6 },
  addFeedContainer: { padding: 15, borderRadius: 16, borderWidth: 1 },
  input: { fontSize: 15, paddingVertical: 12, borderBottomWidth: 1, marginBottom: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginTop: 15 },
  saveBtn: { padding: 18, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },

  connectionRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  connectionAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  connectionName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  connectionSub: { fontSize: 12, opacity: 0.5, fontWeight: '600' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
});