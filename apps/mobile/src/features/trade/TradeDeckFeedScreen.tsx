import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Button, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatCredits } from '@zizilia/shared';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { api } from '../../lib/api';
import { FeedTrade, mockTrades } from './mockTrades';

type FeedResponse = {
  trades?: FeedTrade[];
};

function getOwnerLabel(trade: FeedTrade) {
  return trade.owner?.profile?.displayName || trade.owner?.profile?.handle || 'Community member';
}

function getInitials(label: string) {
  return label
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getExpirationLabel(expiresAt?: string | null) {
  if (!expiresAt) return 'Expiration not set';

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Expiration not set';

  return `Expires ${date.toLocaleDateString()}`;
}

export function TradeDeckFeedScreen() {
  const navigation = useNavigation<any>();
  const position = useRef(new Animated.ValueXY()).current;
  const [trades, setTrades] = useState<FeedTrade[]>(mockTrades);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [feedNotice, setFeedNotice] = useState('Loading live feed when available.');

  const topTrade = trades[currentIndex];
  const remainingCount = Math.max(trades.length - currentIndex, 0);

  useEffect(() => {
    let isMounted = true;

    api.trades.feed()
      .then((response) => {
        if (!isMounted) return;

        const liveTrades = ((response as FeedResponse).trades ?? []).filter(Boolean);
        if (liveTrades.length > 0) {
          setTrades(liveTrades);
          setCurrentIndex(0);
          setFeedNotice('Live API feed');
        } else {
          setFeedNotice('Demo feed: the API returned no active public trades.');
        }
      })
      .catch(() => {
        if (isMounted) {
          setFeedNotice('Demo feed: API unavailable. Check EXPO_PUBLIC_API_URL for live data.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const rotate = position.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp'
  });

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 120) {
        completeCard('save');
        return;
      }

      if (gesture.dx < -120) {
        completeCard('pass');
        return;
      }

      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true
      }).start();
    }
  }), [currentIndex, position, trades]);

  function openDetail(trade = topTrade) {
    if (!trade) return;
    navigation.navigate('TradeDetail', { tradeId: trade.id, trade });
  }

  function advanceDeck() {
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex((value) => value + 1);
  }

  function completeCard(action: 'save' | 'pass') {
    if (!topTrade) return;

    if (action === 'save') {
      setSavedIds((ids) => ids.includes(topTrade.id) ? ids : [...ids, topTrade.id]);
    }

    Animated.timing(position, {
      toValue: { x: action === 'save' ? 500 : -500, y: 20 },
      duration: 180,
      useNativeDriver: true
    }).start(advanceDeck);
  }

  function resetDeck() {
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(0);
  }

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <View>
          <AppText style={styles.eyebrow}>Trade Feed</AppText>
          <AppText style={styles.title}>Find a trade</AppText>
        </View>
        <View style={styles.counter}>
          <AppText style={styles.counterText}>{remainingCount}</AppText>
        </View>
      </View>

      <View style={styles.deck}>
        {topTrade ? (
          trades.slice(currentIndex, currentIndex + 3).reverse().map((trade, reverseIndex, visibleTrades) => {
            const deckIndex = visibleTrades.length - reverseIndex - 1;
            const isTopCard = deckIndex === 0;
            const ownerLabel = getOwnerLabel(trade);

            return (
              <Animated.View
                key={trade.id}
                {...(isTopCard ? panResponder.panHandlers : {})}
                style={[
                  styles.card,
                  {
                    zIndex: 10 - deckIndex,
                    top: deckIndex * 12,
                    transform: isTopCard
                      ? [{ translateX: position.x }, { translateY: position.y }, { rotate }]
                      : [{ scale: 1 - deckIndex * 0.04 }]
                  }
                ]}
              >
                <Pressable onPress={() => openDetail(trade)} style={styles.cardPressable}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.profile}>
                      <AppText style={styles.profileText}>{getInitials(ownerLabel)}</AppText>
                    </View>
                    <View style={styles.ownerBlock}>
                      <AppText style={styles.ownerName}>{ownerLabel}</AppText>
                      <AppText style={styles.expiration}>{getExpirationLabel(trade.expiresAt)}</AppText>
                    </View>
                    <View style={styles.badge}>
                      <AppText style={styles.badgeText}>{trade.status}</AppText>
                    </View>
                  </View>

                  <AppText style={styles.cardTitle}>{trade.title}</AppText>
                  <AppText style={styles.description}>{trade.description}</AppText>

                  <View style={styles.creditRow}>
                    <AppText style={styles.creditAmount}>{formatCredits(trade.creditAmount)}</AppText>
                    <AppText style={styles.creditNote}>Fake test credits</AppText>
                  </View>
                </Pressable>

                {isTopCard ? (
                  <View style={styles.actions}>
                    <Button title="Pass" onPress={() => completeCard('pass')} />
                    <Button title="Open Detail" onPress={() => openDetail(trade)} />
                    <Button title={savedIds.includes(trade.id) ? 'Saved' : 'Save'} onPress={() => completeCard('save')} />
                  </View>
                ) : null}
              </Animated.View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <AppText style={styles.cardTitle}>No more trades</AppText>
            <AppText style={styles.description}>You have reached the end of this deck.</AppText>
            <Button title="Review again" onPress={resetDeck} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <AppText style={styles.notice}>{feedNotice}</AppText>
        <AppText style={styles.savedText}>{savedIds.length} saved in this session</AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  eyebrow: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 32,
    fontWeight: '800'
  },
  counter: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827'
  },
  counterText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  deck: {
    flex: 1,
    minHeight: 460
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: 430,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#111827',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  cardPressable: {
    flex: 1,
    gap: 16
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  profile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB'
  },
  profileText: {
    color: '#374151',
    fontWeight: '800'
  },
  ownerBlock: {
    flex: 1
  },
  ownerName: {
    fontWeight: '800'
  },
  expiration: {
    color: '#64748B',
    marginTop: 2
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  badgeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  cardTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800'
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23
  },
  creditRow: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16
  },
  creditAmount: {
    fontSize: 30,
    fontWeight: '900'
  },
  creditNote: {
    color: '#64748B',
    marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14
  },
  emptyCard: {
    minHeight: 430,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    padding: 18,
    justifyContent: 'center',
    gap: 14
  },
  footer: {
    gap: 4
  },
  notice: {
    color: '#475569'
  },
  savedText: {
    color: '#111827',
    fontWeight: '700'
  }
});
