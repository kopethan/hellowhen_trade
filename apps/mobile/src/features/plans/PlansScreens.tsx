import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MediaAssetDto, PlaceDto, PlanDto, PlanParticipantDto, PlanPlaceDto, PlanPlaceMode } from '@hellowhen/contracts';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { KeyboardDoneAccessory, KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { resolveMediaUrl } from '../trade/mediaUrls';
import { PlanSquareDeck } from './components/PlanSquareDeck';

type PlansScreenProps = NativeStackScreenProps<RootStackParamList, 'Plans'>;
type PlanDetailProps = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;
type SimpleScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, RouteName>;
type PlanListScope = 'feed' | 'mine' | 'joined';
type PlaceListScope = 'mine' | 'library';

type PlanMenuItem = {
  title: string;
  body: string;
  icon: MobileIconName;
  onPress: () => void;
};

function isPlansVisible() {
  return betaFeatures.plansEnabled && betaFeatures.plansVisible;
}

function formatDate(value?: string | null) {
  if (!value) return 'Flexible time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function getOwnerName(plan: PlanDto) {
  return plan.owner?.profile?.displayName || plan.owner?.profile?.handle || 'Hellowhen member';
}

function getPlanMeta(plan: PlanDto) {
  const placeCount = plan.places?.length ?? 0;
  const participantCount = plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
  return `${placeCount} ${placeCount === 1 ? 'place' : 'places'} · ${participantCount} joined`;
}



type SelectedPlanPlaceState = {
  id: string;
  sourcePlaceId?: string;
  sourcePlaceSource?: 'custom' | 'my_place' | 'hellowhen_library';
  sourcePlaceTitle?: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  onlineLabel: string;
  onlineUrl: string;
  note: string;
};

type PlaceCreateFormState = {
  mode: PlanPlaceMode;
  title: string;
  description: string;
  category: string;
  location: string;
  onlineLabel: string;
  onlineUrl: string;
  note: string;
};

type PlacePickerTab = 'mine' | 'library';

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function makeSelectedPlanPlace(index: number, date = toDateInputValue()): SelectedPlanPlaceState {
  return {
    id: `mobile-plan-place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: index === 0 ? 'Meeting point' : '',
    location: '',
    onlineLabel: '',
    onlineUrl: '',
    note: '',
  };
}

function makePlaceCreateForm(): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    category: '',
    location: '',
    onlineLabel: '',
    onlineUrl: '',
    note: '',
  };
}

function libraryPlaceSource(place: PlaceDto): SelectedPlanPlaceState['sourcePlaceSource'] {
  return place.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function placeSourceLabel(place: PlaceDto) {
  return place.source === 'hellowhen_library' ? 'Hellowhen Library' : 'My Place';
}

function placeLocationForSelectedPlace(place: PlaceDto) {
  return place.mode === 'remote' ? '' : place.addressPublicText ?? place.areaLabel ?? '';
}

function selectedPlaceFromReusable(place: PlaceDto, index: number, date = toDateInputValue()): SelectedPlanPlaceState {
  return {
    id: `mobile-plan-place-${place.id}-${Date.now()}-${index}`,
    sourcePlaceId: place.id,
    sourcePlaceSource: libraryPlaceSource(place),
    sourcePlaceTitle: place.title,
    mode: place.mode ?? 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: place.title,
    location: placeLocationForSelectedPlace(place),
    onlineLabel: place.onlineLabel ?? '',
    onlineUrl: place.onlineUrl ?? '',
    note: place.defaultNote ?? place.description ?? '',
  };
}

function resetSelectedPlaceToCustom(place: SelectedPlanPlaceState): SelectedPlanPlaceState {
  return {
    ...place,
    sourcePlaceId: undefined,
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
  };
}

function filterPlaces(places: PlaceDto[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return places;
  return places.filter((place) => [place.title, place.description, place.category, place.areaLabel, place.addressPublicText, place.onlineLabel, place.onlineUrl]
    .some((value) => value?.toLowerCase().includes(normalized)));
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildMobilePlanSchedule(places: SelectedPlanPlaceState[]) {
  const validPlaces = places.map((place, index) => ({ ...place, index, dateTime: parseLocalDateTime(place.date, place.time) }));
  if (validPlaces.length === 0 || validPlaces.some((place) => !place.dateTime)) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as string[], error: 'Add at least one place with a valid date and time.' };
  }

  for (let index = 1; index < validPlaces.length; index += 1) {
    const previous = validPlaces[index - 1]?.dateTime;
    const current = validPlaces[index]?.dateTime;
    if (previous && current && current.getTime() < previous.getTime()) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as string[], error: 'Each place must be at the same time or after the previous place.' };
    }
  }

  const placeStartsAt = validPlaces.map((place) => place.dateTime!.toISOString());
  return {
    startsAt: placeStartsAt[0] ?? '',
    endsAt: placeStartsAt[placeStartsAt.length - 1] ?? '',
    placeStartsAt,
    error: '',
  };
}

function planModeFromSelectedPlaces(places: SelectedPlanPlaceState[]) {
  const modes = new Set(places.map((place) => place.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

function placePreviewLocation(place: SelectedPlanPlaceState) {
  if (place.mode === 'remote') return place.onlineLabel.trim() || place.onlineUrl.trim() || place.location.trim() || 'Online place';
  return place.location.trim() || 'Offline place';
}

function getAcceptedParticipants(plan: PlanDto) {
  return [...(plan.participants ?? [])].filter((participant) => participant.status === 'accepted').sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
}

function getParticipantName(participant: PlanParticipantDto) {
  return participant.user?.profile?.displayName || participant.user?.profile?.handle || 'Hellowhen user';
}

function getParticipantInitial(participant: PlanParticipantDto) {
  return getParticipantName(participant).trim().slice(0, 1).toUpperCase() || 'H';
}

function formatPlanDateRange(plan: PlanDto) {
  if (!plan.endsAt) return formatDate(plan.startsAt);
  return `${formatDate(plan.startsAt)} – ${formatDate(plan.endsAt)}`;
}

function getPlanLocationLabel(plan: PlanDto) {
  if (plan.locationLabel) return plan.locationLabel;
  const firstPlace = [...(plan.places ?? [])].sort((first, second) => first.order - second.order)[0];
  if (!firstPlace) return 'Places selected by the organizer';
  if (firstPlace.mode === 'remote') return firstPlace.onlineLabel || firstPlace.onlineUrl || 'Online Plan';
  return firstPlace.addressPublicText || firstPlace.sourcePlace?.areaLabel || 'Offline Plan';
}

function activeMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaUrl(media.url);
}

function getPlanPlaceMedia(place: PlanPlaceDto) {
  return activeMedia(place.media)[0] ?? activeMedia(place.sourcePlace?.media)[0] ?? null;
}

function sortedPlanPlaces(plan: PlanDto) {
  return [...(plan.places ?? [])].sort((first, second) => first.order - second.order);
}

function getPlanPlaceLocationLabel(place: PlanPlaceDto) {
  if (place.mode === 'remote') return place.onlineLabel || place.onlineUrl || 'Online place';
  return place.addressPublicText || place.sourcePlace?.areaLabel || 'Offline place';
}

function getPlanPlaceSourceLabel(place: PlanPlaceDto) {
  if (place.source === 'hellowhen_library') return 'Library place';
  if (place.source === 'my_place') return 'My place';
  return 'Custom';
}

function DisabledPlansScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeTokens();
  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plans" onBack={onBack} />}>
      <View style={styles.centerState}>
        <View style={[styles.largeIcon, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}>
          <MobileIcon name="calendar" color={theme.semantic.instruction.text} size={30} />
        </View>
        <AppText style={styles.centerTitle}>Plans are hidden</AppText>
        <AppText style={[styles.centerBody, { color: theme.color.muted }]}>The mobile Plan route skeleton is ready, but Plans stay hidden until the Plan feature flags are enabled.</AppText>
      </View>
    </AppFixedHeaderScreen>
  );
}

function HeaderAction({ icon, label, onPress }: { icon: MobileIconName; label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
    >
      <MobileIcon name={icon} size={20} color={theme.color.text} />
    </Pressable>
  );
}

function PlanRow({ plan, onPress }: { plan: PlanDto; onPress: () => void }) {
  const theme = useThemeTokens();
  const firstPlace = plan.places?.[0];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.rowTop}>
        <SemanticBadge label={plan.status} tone={plan.status === 'open' ? 'success' : 'muted'} size="sm" />
        {plan.myParticipantStatus ? <SemanticBadge label={plan.myParticipantStatus === 'accepted' ? 'Joined' : plan.myParticipantStatus} tone="proposal" size="sm" /> : null}
      </View>
      <AppText style={styles.rowTitle}>{plan.title}</AppText>
      <AppText style={[styles.rowBody, { color: theme.color.muted }]} numberOfLines={2}>{plan.description}</AppText>
      <View style={styles.metaRow}>
        <MobileIcon name="profile" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{getOwnerName(plan)}</AppText>
      </View>
      <View style={styles.metaRow}>
        <MobileIcon name="calendar" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatDate(plan.startsAt)}</AppText>
      </View>
      <View style={styles.metaRow}>
        <MobileIcon name="activity" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{getPlanMeta(plan)}</AppText>
      </View>
      {firstPlace ? <AppText style={[styles.placePreview, { color: theme.semantic.instruction.text }]}>Starts with {firstPlace.title}</AppText> : null}
    </Pressable>
  );
}

function PlaceRow({ place, onPress }: { place: PlaceDto; onPress?: () => void }) {
  const theme = useThemeTokens();
  const isLibrary = place.source === 'hellowhen_library';
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && onPress && styles.pressed]}>
      <View style={styles.rowTop}>
        <SemanticBadge label={isLibrary ? 'Library place' : 'My place'} tone={isLibrary ? 'instruction' : 'proposal'} size="sm" />
        <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
      </View>
      <AppText style={styles.rowTitle}>{place.title}</AppText>
      <AppText style={[styles.rowBody, { color: theme.color.muted }]} numberOfLines={2}>{place.description || place.defaultNote || 'Reusable place for future Plans.'}</AppText>
      <View style={styles.metaRow}>
        <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{place.mode === 'remote' ? (place.onlineLabel || place.onlineUrl || 'Online place') : (place.areaLabel || place.addressPublicText || 'Offline place')}</AppText>
      </View>
    </Pressable>
  );
}

function PlanList({ scope, navigation }: { scope: PlanListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const theme = useThemeTokens();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = scope === 'mine' ? await api.plans.mine() : scope === 'joined' ? await api.plans.joined() : await api.plans.feed();
      setPlans(response.plans ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plans...</AppText></View>;
  }

  if (error) return <InfoNotice tone="warning" title="Could not load Plans" body={error} />;

  if (plans.length === 0) {
    const body = scope === 'mine'
      ? 'Created Plans will appear here once you create one.'
      : scope === 'joined'
        ? 'Plans you join will appear here.'
        : 'Open Plans will appear here once people start creating them.';
    return <EmptyBlock title="No Plans yet" body={body} actionLabel={scope === 'mine' ? 'Create plan' : undefined} onAction={scope === 'mine' ? () => navigation.navigate('CreatePlan') : undefined} />;
  }

  const isDeckFeed = scope === 'feed';

  return (
    <ScrollView
      contentContainerStyle={isDeckFeed ? styles.deckFeedContent : styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ refresh: true }); }} />}
    >
      {plans.map((plan, index) => (
        isDeckFeed
          ? <PlanDeckSection key={plan.id} plan={plan} index={index} total={plans.length} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />
          : <PlanRow key={plan.id} plan={plan} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />
      ))}
    </ScrollView>
  );
}


function PlanDeckSection({ plan, index, total, onPress }: { plan: PlanDto; index: number; total: number; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.deckSection}>
      <View style={styles.deckSectionHeader}>
        <View style={styles.deckSectionCopy}>
          <AppText style={styles.deckSectionTitle} numberOfLines={1}>{plan.title}</AppText>
          <AppText style={[styles.deckSectionMeta, { color: theme.color.muted }]} numberOfLines={1}>{getOwnerName(plan)} · {getPlanMeta(plan)}</AppText>
        </View>
        <SemanticBadge label={`${index + 1}/${total}`} tone="muted" size="sm" />
      </View>
      <PlanSquareDeck plan={plan} index={index} total={total} onOpen={onPress} />
    </View>
  );
}

function PlaceList({ scope, navigation }: { scope: PlaceListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const theme = useThemeTokens();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = scope === 'library' ? await api.places.library() : await api.places.mine();
      setPlaces(response.places ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Places...</AppText></View>;
  }

  if (error) return <InfoNotice tone="warning" title="Could not load Places" body={error} />;

  if (places.length === 0) {
    return <EmptyBlock title={scope === 'library' ? 'Library is empty' : 'No Places yet'} body={scope === 'library' ? 'Hellowhen Place Library items will appear here later.' : 'Create reusable Places first, then pick them while creating a Plan.'} actionLabel={scope === 'mine' ? 'Create place' : undefined} onAction={scope === 'mine' ? () => navigation.navigate('CreatePlace') : undefined} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ refresh: true }); }} />}
    >
      {places.map((place) => <PlaceRow key={place.id} place={place} />)}
    </ScrollView>
  );
}

function EmptyBlock({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.emptyBlock, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <MobileIcon name="calendar" size={28} color={theme.color.muted} />
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{body}</AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
          <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function SkeletonNotice({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <InfoNotice tone="instruction" title={title} body={body} />
      <EmptyBlock title="Coming in the next Plan patch" body="This mobile route is intentionally wired now so later Plan feed/detail/create patches can attach real UI without changing navigation again." />
    </ScrollView>
  );
}

export function PlansScreen(props: Partial<PlansScreenProps> = {}) {
  const fallbackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = (props.navigation ?? fallbackNavigation) as NativeStackNavigationProp<RootStackParamList>;
  const theme = useThemeTokens();
  const [scope, setScope] = useState<PlanListScope>('feed');
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const menuItems: PlanMenuItem[] = [
    { title: 'My plans', body: 'Plans you created.', icon: 'calendar', onPress: () => { setMenuOpen(false); navigation.navigate('MyPlans'); } },
    { title: 'Joined plans', body: 'Plans you joined freely.', icon: 'activity', onPress: () => { setMenuOpen(false); navigation.navigate('JoinedPlans'); } },
    { title: 'My places', body: 'Reusable offline or online places.', icon: 'save', onPress: () => { setMenuOpen(false); navigation.navigate('MyPlaces'); } },
    { title: 'Hellowhen Place Library', body: 'Starter/library places for Plans.', icon: 'search', onPress: () => { setMenuOpen(false); navigation.navigate('PlaceLibrary'); } },
    { title: 'Create place', body: 'Prepare a reusable place.', icon: 'add', onPress: () => { setMenuOpen(false); navigation.navigate('CreatePlace'); } },
    { title: 'Create plan', body: 'Choose places and arrange them.', icon: 'add', onPress: () => { setMenuOpen(false); navigation.navigate('CreatePlan'); } },
  ];

  const header = (
    <View style={styles.feedHeader}>
      <View style={styles.feedTitleWrap}>
        <AppText style={styles.feedTitle}>Plans</AppText>
      </View>
      <View style={styles.headerActions}>
        <HeaderAction icon="filter" label="Filter Plans" onPress={() => setScope((current) => current === 'feed' ? 'mine' : current === 'mine' ? 'joined' : 'feed')} />
        <HeaderAction icon="more" label="Open Plan menu" onPress={() => setMenuOpen((value) => !value)} />
        <HeaderAction icon="add" label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />
      </View>
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      <View style={styles.bodyWrap}>
        <View style={styles.filterRow}>
          {(['feed', 'mine', 'joined'] as PlanListScope[]).map((value) => (
            <Pressable key={value} accessibilityRole="button" onPress={() => setScope(value)} style={({ pressed }) => [styles.filterChip, { borderColor: scope === value ? theme.color.text : theme.color.border, backgroundColor: scope === value ? theme.color.text : theme.color.surface }, pressed && styles.pressed]}>
              <AppText style={[styles.filterChipText, { color: scope === value ? theme.color.background : theme.color.text }]}>{value === 'feed' ? 'Open' : value === 'mine' ? 'My plans' : 'Joined'}</AppText>
            </Pressable>
          ))}
        </View>
        {menuOpen ? (
          <View style={[styles.menuPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            {menuItems.map((item) => <MenuItem key={item.title} item={item} />)}
          </View>
        ) : null}
        <PlanList scope={scope} navigation={navigation} />
      </View>
    </AppFixedHeaderScreen>
  );
}

function MenuItem({ item }: { item: PlanMenuItem }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.menuItem, { borderBottomColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.menuIcon, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}><MobileIcon name={item.icon} size={17} color={theme.semantic.instruction.text} /></View>
      <View style={styles.menuCopy}>
        <AppText style={styles.menuTitle}>{item.title}</AppText>
        <AppText style={[styles.menuBody, { color: theme.color.muted }]}>{item.body}</AppText>
      </View>
      <MobileIcon name="chevron-right" size={20} color={theme.color.muted} />
    </Pressable>
  );
}

function PlanStatPill({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.statPill, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: theme.color.muted }]}>{label}</AppText>
    </View>
  );
}

function ParticipantCompactRow({ participant }: { participant: PlanParticipantDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.participantRow, { borderBottomColor: theme.color.border }]}>
      <View style={[styles.participantAvatar, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}>
        <AppText style={[styles.participantInitial, { color: theme.semantic.instruction.text }]}>{getParticipantInitial(participant)}</AppText>
      </View>
      <View style={styles.participantCopy}>
        <AppText style={styles.participantName}>{getParticipantName(participant)}</AppText>
        <AppText style={[styles.participantStatus, { color: theme.color.muted }]}>{participant.status === 'accepted' ? 'Joined' : participant.status}</AppText>
      </View>
    </View>
  );
}

function PlanPlaceTimelineCard({ place, index, showReport }: { place: PlanPlaceDto; index: number; showReport: boolean }) {
  const theme = useThemeTokens();
  const mediaUrl = activeMediaUrl(getPlanPlaceMedia(place));
  const locationLabel = getPlanPlaceLocationLabel(place);

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineNumber, { backgroundColor: theme.color.text }]}>
          <AppText style={[styles.timelineNumberText, { color: theme.color.background }]}>{index + 1}</AppText>
        </View>
        <View style={[styles.timelineLine, { backgroundColor: theme.color.border }]} />
      </View>
      <View style={[styles.timelineCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <View style={styles.timelineCardHeader}>
          <View style={styles.timelineCopy}>
            <View style={styles.rowTop}>
              <SemanticBadge label={`Place ${index + 1}`} tone="instruction" size="sm" />
              <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
              <SemanticBadge label={getPlanPlaceSourceLabel(place)} tone="muted" size="sm" />
            </View>
            <AppText style={styles.rowTitle}>{place.title}</AppText>
          </View>
          <View style={[styles.timelineMedia, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}>
            {mediaUrl ? <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.timelineImage} /> : <MobileIcon name="calendar" size={24} color={theme.semantic.instruction.text} />}
          </View>
        </View>
        <View style={styles.detailMetaStack}>
          <View style={styles.metaRow}>
            <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
            <AppText style={[styles.metaText, { color: theme.color.muted }]}>{locationLabel}</AppText>
          </View>
          <View style={styles.metaRow}>
            <MobileIcon name="activity" size={15} color={theme.color.muted} />
            <AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatDate(place.startsAt)}</AppText>
          </View>
        </View>
        {place.note ? <AppText style={[styles.rowBody, { color: theme.color.muted }]}>{place.note}</AppText> : null}
        {showReport ? <ReportContentPanel targetType="plan_place" targetId={place.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
      </View>
    </View>
  );
}

export function PlanDetailScreen({ route, navigation }: PlanDetailProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [loading, setLoading] = useState(isPlansVisible());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPlansVisible()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await api.plans.get(route.params.planId);
      setPlan(response.plan);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [route.params.planId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function joinPlan() {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);
    try {
      await api.plans.join(plan.id);
      setActionMessage('You joined this Plan.');
      await load();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  async function leavePlan() {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);
    try {
      await api.plans.leave(plan.id);
      setActionMessage('You left this Plan.');
      await load();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const isJoined = plan?.myParticipantStatus === 'accepted';
  const canJoin = Boolean(plan && auth.user && !isOwner && !isJoined && plan.status === 'open');
  const canLeave = Boolean(plan && !isOwner && isJoined);
  const places = plan ? sortedPlanPlaces(plan) : [];
  const acceptedParticipants = plan ? getAcceptedParticipants(plan) : [];
  const joinedCount = plan?.participantCount ?? acceptedParticipants.length;
  const capacityLabel = plan?.maxParticipants ? `${joinedCount}/${plan.maxParticipants}` : String(joinedCount);
  const showReportActions = Boolean(auth.user && plan && !isOwner);

  return (
    <AppFixedHeaderScreen header={<AppHeader title={route.params.title ?? 'Plan'} onBack={() => navigation.goBack()} />}>
      {loading ? <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plan...</AppText></View> : null}
      {!loading && error ? <View style={styles.contentPad}><InfoNotice tone="warning" title="Could not load Plan" body={error} /></View> : null}
      {!loading && plan ? (
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.rowTop}>
              <SemanticBadge label="Plan" tone="trade" />
              <SemanticBadge label={plan.status} tone={plan.status === 'open' ? 'success' : 'muted'} />
              {isJoined ? <SemanticBadge label="Joined" tone="proposal" /> : null}
            </View>
            <AppText style={styles.heroTitle}>{plan.title}</AppText>
            <AppText style={[styles.heroBody, { color: theme.color.muted }]}>{plan.description}</AppText>
            <View style={styles.detailMetaStack}>
              <View style={styles.metaRow}><MobileIcon name="profile" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>By {getOwnerName(plan)}</AppText></View>
              <View style={styles.metaRow}><MobileIcon name="calendar" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatPlanDateRange(plan)}</AppText></View>
              <View style={styles.metaRow}><MobileIcon name="activity" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>{getPlanLocationLabel(plan)}</AppText></View>
            </View>
            <View style={styles.statGrid}>
              <PlanStatPill value={capacityLabel} label="joined" />
              <PlanStatPill value={String(places.length)} label="places" />
              <PlanStatPill value="Free" label="join" />
            </View>
            <View style={styles.detailActionStack}>
              {isOwner ? <InfoNotice tone="info" title="You own this Plan" body="People can join freely while this first production Plan flow is hidden behind the feature flags." /> : null}
              {canJoin ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={joinPlan} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{busy ? 'Joining...' : 'Join plan'}</AppText>
                </Pressable>
              ) : null}
              {isJoined ? (
                <View style={[styles.joinedState, { backgroundColor: theme.semantic.success.softBg, borderColor: theme.semantic.success.border }]}>
                  <MobileIcon name="proposal-accepted" size={18} color={theme.semantic.success.text} />
                  <AppText style={[styles.joinedStateText, { color: theme.semantic.success.text }]}>Joined</AppText>
                </View>
              ) : null}
              {canLeave ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={leavePlan} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{busy ? 'Updating...' : 'Leave plan'}</AppText>
                </Pressable>
              ) : null}
              {!auth.user ? <InfoNotice tone="info" title="Log in to join" body="Plans use the same protected account session as Trade. Log in first, then join freely." /> : null}
              {actionMessage ? <InfoNotice tone="success" title="Plan updated" body={actionMessage} /> : null}
              {actionError ? <InfoNotice tone="warning" title="Plan action failed" body={actionError} /> : null}
            </View>
          </View>

          <View style={styles.sectionTitleRow}><AppText style={styles.sectionTitle}>Plan route</AppText><SemanticBadge label={`${places.length}`} tone="instruction" size="sm" /></View>
          {places.length === 0 ? <EmptyBlock title="No places yet" body="This Plan does not have places attached yet." /> : null}
          {places.map((place, index) => <PlanPlaceTimelineCard key={place.id} place={place} index={index} showReport={showReportActions} />)}

          <View style={[styles.detailSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.detailSectionHeader}>
              <View style={styles.detailSectionCopy}>
                <AppText style={styles.sectionTitle}>Joined people</AppText>
                <AppText style={[styles.rowBody, { color: theme.color.muted }]}>Free join is enabled for this first hidden production version.</AppText>
              </View>
              <SemanticBadge label={String(joinedCount)} tone="proposal" size="sm" />
            </View>
            {acceptedParticipants.length === 0 ? <AppText style={[styles.rowBody, { color: theme.color.muted }]}>No participants yet.</AppText> : null}
            {acceptedParticipants.map((participant) => <ParticipantCompactRow key={participant.id} participant={participant} />)}
          </View>

          <View style={[styles.detailSection, styles.supportSection, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
            <View style={styles.detailSectionCopy}>
              <AppText style={styles.sectionTitle}>Safety and support</AppText>
              <AppText style={[styles.rowBody, { color: theme.color.muted }]}>Plans are still hidden and internal while testing. Public discussion is intentionally postponed for this first production version.</AppText>
            </View>
            {showReportActions ? <ReportContentPanel targetType="plan" targetId={plan.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
          </View>
        </ScrollView>
      ) : null}
    </AppFixedHeaderScreen>
  );
}

export function MyPlansScreen({ navigation }: SimpleScreenProps<'MyPlans'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="My plans" onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="add" label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />} />}><PlanList scope="mine" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function JoinedPlansScreen({ navigation }: SimpleScreenProps<'JoinedPlans'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="Joined plans" onBack={() => navigation.goBack()} />}><PlanList scope="joined" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function MyPlacesScreen({ navigation }: SimpleScreenProps<'MyPlaces'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="My places" onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="add" label="Create Place" onPress={() => navigation.navigate('CreatePlace')} />} />}><PlaceList scope="mine" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function PlaceLibraryScreen({ navigation }: SimpleScreenProps<'PlaceLibrary'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="Place Library" onBack={() => navigation.goBack()} />}><PlaceList scope="library" navigation={navigation} /></AppFixedHeaderScreen>;
}

function ModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.modeSegment, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      {(['local', 'remote'] as PlanPlaceMode[]).map((mode) => {
        const active = value === mode;
        return (
          <Pressable key={mode} accessibilityRole="button" onPress={() => onChange(mode)} style={({ pressed }) => [styles.modeSegmentButton, { backgroundColor: active ? theme.color.text : 'transparent' }, pressed && styles.pressed]}>
            <AppText style={[styles.modeSegmentText, { color: active ? theme.color.background : theme.color.text }]}>{mode === 'remote' ? 'Online' : 'Offline'}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formField}>
      <AppText style={styles.formLabel}>{label}</AppText>
      {children}
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numbers-and-punctuation' | 'url';
  maxLength?: number;
}) {
  const theme = useThemeTokens();
  return (
    <FormLabel label={label}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
        keyboardType={keyboardType}
        maxLength={maxLength}
        inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
        returnKeyType={multiline ? 'default' : 'done'}
        blurOnSubmit={!multiline}
        style={[styles.input, multiline && styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
      />
    </FormLabel>
  );
}

function PillButton({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.pillButton, { borderColor: active ? theme.color.text : theme.color.border, backgroundColor: active ? theme.color.text : theme.color.surface }, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText style={[styles.pillButtonText, { color: active ? theme.color.background : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: MobileIconName }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, disabled && styles.disabled]}>
      {icon ? <MobileIcon name={icon} size={16} color={theme.color.text} /> : null}
      <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function PlaceChoiceCard({ place, onAdd }: { place: PlaceDto; onAdd: () => void }) {
  const theme = useThemeTokens();
  const meta = [place.mode === 'remote' ? 'Online' : 'Offline', place.category, place.areaLabel || place.addressPublicText || place.onlineLabel]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
  return (
    <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.choiceCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.choiceIcon, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}>
        <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={18} color={theme.semantic.instruction.text} />
      </View>
      <View style={styles.choiceCopy}>
        <View style={styles.rowTop}>
          <SemanticBadge label={placeSourceLabel(place)} tone={place.source === 'hellowhen_library' ? 'instruction' : 'proposal'} size="sm" />
          <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
        </View>
        <AppText style={styles.choiceTitle}>{place.title}</AppText>
        <AppText style={[styles.choiceMeta, { color: theme.color.muted }]} numberOfLines={2}>{meta || place.description || 'Reusable Place'}</AppText>
      </View>
      <View style={[styles.addMini, { backgroundColor: theme.color.text }]}>
        <MobileIcon name="add" size={16} color={theme.color.background} />
      </View>
    </Pressable>
  );
}

function PlaceEditorCard({
  place,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onResetToCustom,
}: {
  place: SelectedPlanPlaceState;
  index: number;
  total: number;
  onChange: (patch: Partial<SelectedPlanPlaceState>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onResetToCustom: () => void;
}) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.placeEditorCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.placeEditorHeader}>
        <View style={styles.rowTop}>
          <SemanticBadge label={`Place ${index + 1}`} tone="instruction" size="sm" />
          {place.sourcePlaceId ? <SemanticBadge label={place.sourcePlaceSource === 'hellowhen_library' ? 'Library snapshot' : 'My Place snapshot'} tone="proposal" size="sm" /> : <SemanticBadge label="Custom" tone="muted" size="sm" />}
        </View>
        <View style={styles.smallButtonRow}>
          <SecondaryButton label="↑" disabled={index === 0} onPress={() => onMove(-1)} />
          <SecondaryButton label="↓" disabled={index === total - 1} onPress={() => onMove(1)} />
        </View>
      </View>
      {place.sourcePlaceId ? (
        <View style={[styles.snapshotStrip, { backgroundColor: theme.semantic.instruction.softBg, borderColor: theme.semantic.instruction.border }]}>
          <AppText style={[styles.snapshotText, { color: theme.semantic.instruction.text }]} numberOfLines={2}>Copied from {place.sourcePlaceTitle || place.title}. This Plan keeps a snapshot.</AppText>
          <SecondaryButton label="Use custom" onPress={onResetToCustom} />
        </View>
      ) : null}
      <ModeSegment value={place.mode} onChange={(mode) => onChange({ mode, location: mode === 'remote' ? '' : place.location })} />
      <View style={styles.twoColumnRow}>
        <TextField label="Date" value={place.date} onChangeText={(date) => onChange({ date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <TextField label="Time" value={place.time} onChangeText={(time) => onChange({ time })} placeholder="13:00" keyboardType="numbers-and-punctuation" />
      </View>
      <TextField label="Place name" value={place.title} onChangeText={(title) => onChange({ title })} placeholder={place.mode === 'remote' ? 'Planning call' : 'Coffee meeting point'} maxLength={120} />
      {place.mode === 'remote' ? (
        <>
          <TextField label="Online label" value={place.onlineLabel} onChangeText={(onlineLabel) => onChange({ onlineLabel })} placeholder="Zoom, Discord, website" maxLength={120} />
          <TextField label="Online URL" value={place.onlineUrl} onChangeText={(onlineUrl) => onChange({ onlineUrl })} placeholder="https://..." keyboardType="url" maxLength={500} />
        </>
      ) : (
        <TextField label="Address or meeting point" value={place.location} onChangeText={(location) => onChange({ location })} placeholder="Paris 11 or a public meeting point" maxLength={240} />
      )}
      <TextField label="Plan note" value={place.note} onChangeText={(note) => onChange({ note })} placeholder="Why this place is part of the Plan." multiline maxLength={1000} />
      {total > 1 ? <SecondaryButton label="Remove place" icon="close" onPress={onRemove} /> : null}
    </View>
  );
}

function QuickCreatePlaceBox({ state, onChange, onSave, saving }: { state: PlaceCreateFormState; onChange: (state: PlaceCreateFormState) => void; onSave: () => void; saving?: boolean }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.quickCreateBox, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.sectionTitleRow}>
        <AppText style={styles.sectionTitle}>Create My Place</AppText>
        <SemanticBadge label="Private" tone="proposal" size="sm" />
      </View>
      <ModeSegment value={state.mode} onChange={(mode) => onChange({ ...state, mode })} />
      <TextField label="Place name" value={state.title} onChangeText={(title) => onChange({ ...state, title })} placeholder="Quiet coffee near République" maxLength={120} />
      <TextField label="Category" value={state.category} onChangeText={(category) => onChange({ ...state, category })} placeholder="Work, culture, food..." maxLength={80} />
      {state.mode === 'remote' ? (
        <>
          <TextField label="Online label" value={state.onlineLabel} onChangeText={(onlineLabel) => onChange({ ...state, onlineLabel })} placeholder="Zoom, Discord, website" maxLength={120} />
          <TextField label="Online URL" value={state.onlineUrl} onChangeText={(onlineUrl) => onChange({ ...state, onlineUrl })} placeholder="https://..." keyboardType="url" maxLength={500} />
        </>
      ) : (
        <TextField label="Area / address" value={state.location} onChangeText={(location) => onChange({ ...state, location })} placeholder="Paris 11 or meeting point" maxLength={240} />
      )}
      <TextField label="Description" value={state.description} onChangeText={(description) => onChange({ ...state, description })} placeholder="Reusable Place description." multiline maxLength={2000} />
      <TextField label="Default note" value={state.note} onChangeText={(note) => onChange({ ...state, note })} placeholder="What this Place is good for." multiline maxLength={1000} />
      <Pressable accessibilityRole="button" disabled={saving || state.title.trim().length < 3} onPress={onSave} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, (saving || state.title.trim().length < 3) && styles.disabled]}>
        <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? 'Saving...' : 'Save My Place'}</AppText>
      </Pressable>
    </View>
  );
}

export function CreatePlanScreen({ navigation }: SimpleScreenProps<'CreatePlan'>) {
  const theme = useThemeTokens();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Culture');
  const [places, setPlaces] = useState<SelectedPlanPlaceState[]>([]);
  const [myPlaces, setMyPlaces] = useState<PlaceDto[]>([]);
  const [libraryPlaces, setLibraryPlaces] = useState<PlaceDto[]>([]);
  const [pickerTab, setPickerTab] = useState<PlacePickerTab>('mine');
  const [placeQuery, setPlaceQuery] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickPlace, setQuickPlace] = useState<PlaceCreateFormState>(makePlaceCreateForm());
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredMyPlaces = useMemo(() => filterPlaces(myPlaces, placeQuery), [myPlaces, placeQuery]);
  const filteredLibraryPlaces = useMemo(() => filterPlaces(libraryPlaces, placeQuery), [libraryPlaces, placeQuery]);
  const schedule = useMemo(() => buildMobilePlanSchedule(places.filter((place) => place.title.trim() && place.date.trim() && place.time.trim())), [places]);

  const loadReusablePlaces = useCallback(async () => {
    if (!isPlansVisible()) return;
    setLoadingPlaces(true);
    setError(null);
    try {
      const [mineResponse, libraryResponse] = await Promise.all([api.places.mine({ take: 100 }), api.places.library({ take: 100 })]);
      setMyPlaces(mineResponse.places ?? []);
      setLibraryPlaces(libraryResponse.places ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadReusablePlaces(); }, [loadReusablePlaces]));

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  function addCustomPlace() {
    setPlaces((current) => [...current, makeSelectedPlanPlace(current.length, current[current.length - 1]?.date || toDateInputValue())]);
  }

  function addReusablePlace(place: PlaceDto) {
    setPlaces((current) => [...current, selectedPlaceFromReusable(place, current.length, current[current.length - 1]?.date || toDateInputValue())]);
    setMessage(`Added ${place.title}.`);
    setError(null);
  }

  function updateSelectedPlace(index: number, patch: Partial<SelectedPlanPlaceState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...patch } : place));
  }

  function moveSelectedPlace(index: number, direction: -1 | 1) {
    setPlaces((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const currentPlace = next[index];
      const targetPlace = next[nextIndex];
      if (!currentPlace || !targetPlace) return current;
      next[index] = targetPlace;
      next[nextIndex] = currentPlace;
      return next;
    });
  }

  async function createPlaceAndAdd() {
    setCreatingPlace(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.places.create({
        mode: quickPlace.mode,
        title: quickPlace.title,
        description: quickPlace.description.trim() || undefined,
        category: quickPlace.category.trim() || undefined,
        visibility: 'private',
        status: 'active',
        addressPublicText: quickPlace.mode === 'local' ? quickPlace.location.trim() || undefined : undefined,
        onlineLabel: quickPlace.mode === 'remote' ? quickPlace.onlineLabel.trim() || undefined : undefined,
        onlineUrl: quickPlace.mode === 'remote' ? quickPlace.onlineUrl.trim() || undefined : undefined,
        defaultNote: quickPlace.note.trim() || undefined,
      });
      setMyPlaces((current) => [response.place, ...current.filter((place) => place.id !== response.place.id)]);
      addReusablePlace(response.place);
      setQuickPlace(makePlaceCreateForm());
      setQuickCreateOpen(false);
      setMessage('Place saved and added to this Plan.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setCreatingPlace(false);
    }
  }

  async function submit() {
    const usablePlaces = places.filter((place) => place.title.trim() && place.date.trim() && place.time.trim());
    const nextSchedule = buildMobilePlanSchedule(usablePlaces);
    if (title.trim().length < 3) { setError('Add a Plan title.'); return; }
    if (description.trim().length < 10) { setError('Add a short Plan description.'); return; }
    if (nextSchedule.error || !nextSchedule.startsAt || usablePlaces.length === 0) { setError(nextSchedule.error || 'Add at least one place.'); return; }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.plans.create({
        title,
        description,
        category: category.trim() || undefined,
        mode: planModeFromSelectedPlaces(usablePlaces),
        startsAt: nextSchedule.startsAt,
        endsAt: nextSchedule.endsAt || nextSchedule.startsAt,
        joinApprovalMode: 'automatic',
        status: 'open',
        places: usablePlaces.map((place, index) => ({
          placeId: place.sourcePlaceId,
          mode: place.mode,
          title: place.title,
          note: place.note.trim() || undefined,
          addressPublicText: place.mode === 'local' ? place.location.trim() || undefined : undefined,
          onlineLabel: place.mode === 'remote' ? place.onlineLabel.trim() || placePreviewLocation(place) || undefined : undefined,
          onlineUrl: place.mode === 'remote' ? place.onlineUrl.trim() || undefined : undefined,
          startsAt: nextSchedule.placeStartsAt[index],
          order: index,
        })),
      });
      navigation.replace('PlanDetail', { planId: response.plan.id, title: response.plan.title });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  const activeList = pickerTab === 'mine' ? filteredMyPlaces : filteredLibraryPlaces;

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Create plan" onBack={() => navigation.goBack()} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <SemanticBadge label="Free join" tone="success" />
            <AppText style={styles.heroTitle}>Create a Plan from Places</AppText>
            <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Choose reusable Places, arrange them in order and time, or add custom stops. No Trade, Need, Offer, Agenda, payment, or approval connection is added here.</AppText>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Saturday museum route" maxLength={120} />
            <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Explain the whole Plan and who can freely join." multiline maxLength={2000} />
            <TextField label="Category" value={category} onChangeText={setCategory} placeholder="Culture" maxLength={80} />
          </View>

          <View style={styles.sectionTitleRow}>
            <AppText style={styles.sectionTitle}>Place Library</AppText>
            <SemanticBadge label={loadingPlaces ? 'Loading' : `${myPlaces.length + libraryPlaces.length}`} tone="instruction" size="sm" />
          </View>
          <View style={styles.filterRow}>
            <PillButton label="My Places" active={pickerTab === 'mine'} onPress={() => setPickerTab('mine')} />
            <PillButton label="Hellowhen Library" active={pickerTab === 'library'} onPress={() => setPickerTab('library')} />
            <PillButton label="Refresh" onPress={() => { void loadReusablePlaces(); }} />
          </View>
          <TextField label="Search Places" value={placeQuery} onChangeText={setPlaceQuery} placeholder="Search title, category, area..." />
          {loadingPlaces ? <View style={styles.inlineSmallLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Places...</AppText></View> : null}
          {!loadingPlaces && activeList.length === 0 ? <EmptyBlock title="No matching Places" body={pickerTab === 'mine' ? 'Create a My Place below or add a custom one-off place.' : 'No matching Hellowhen Library Places yet.'} /> : null}
          {activeList.map((place) => <PlaceChoiceCard key={place.id} place={place} onAdd={() => addReusablePlace(place)} />)}

          <View style={styles.actionGrid}>
            <SecondaryButton label="Add custom place" icon="add" onPress={addCustomPlace} />
            <SecondaryButton label={quickCreateOpen ? 'Hide create place' : 'Create My Place'} icon="save" onPress={() => setQuickCreateOpen((value) => !value)} />
          </View>
          {quickCreateOpen ? <QuickCreatePlaceBox state={quickPlace} onChange={setQuickPlace} saving={creatingPlace} onSave={() => { void createPlaceAndAdd(); }} /> : null}

          <View style={styles.sectionTitleRow}>
            <AppText style={styles.sectionTitle}>Selected Places</AppText>
            <SemanticBadge label={`${places.length}`} tone="proposal" size="sm" />
          </View>
          {places.length === 0 ? <EmptyBlock title="No places selected" body="Choose a My Place, choose a Hellowhen Library Place, or add a custom one-off place." actionLabel="Add custom place" onAction={addCustomPlace} /> : null}
          {places.map((place, index) => (
            <PlaceEditorCard
              key={place.id}
              place={place}
              index={index}
              total={places.length}
              onChange={(patch) => updateSelectedPlace(index, patch)}
              onMove={(direction) => moveSelectedPlace(index, direction)}
              onRemove={() => setPlaces((current) => current.filter((_, placeIndex) => placeIndex !== index))}
              onResetToCustom={() => setPlaces((current) => current.map((item, placeIndex) => placeIndex === index ? resetSelectedPlaceToCustom(item) : item))}
            />
          ))}

          <View style={[styles.previewCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.sectionTitleRow}><AppText style={styles.sectionTitle}>Preview</AppText><SemanticBadge label="Place-only feed deck" tone="instruction" size="sm" /></View>
            {places.length === 0 ? <AppText style={[styles.rowBody, { color: theme.color.muted }]}>Selected Places will become the feed deck cards: Place 1, Place 2, Place 3.</AppText> : null}
            {places.map((place, index) => (
              <View key={`preview-${place.id}`} style={styles.previewPlaceRow}>
                <View style={[styles.timelineNumber, { backgroundColor: theme.color.text }]}><AppText style={[styles.timelineNumberText, { color: theme.color.background }]}>{index + 1}</AppText></View>
                <View style={styles.timelineCopy}>
                  <AppText style={styles.rowTitle}>{place.title || `Place ${index + 1}`}</AppText>
                  <AppText style={[styles.metaText, { color: theme.color.muted }]}>{placePreviewLocation(place)} · {place.date || 'Date'} {place.time || 'Time'}</AppText>
                </View>
              </View>
            ))}
            {schedule.error && places.length > 0 ? <InfoNotice tone="warning" title="Schedule check" body={schedule.error} /> : null}
          </View>

          {message ? <InfoNotice tone="success" title="Plans" body={message} /> : null}
          {error ? <InfoNotice tone="warning" title="Could not save" body={error} /> : null}
          <Pressable accessibilityRole="button" disabled={saving || creatingPlace} onPress={() => { void submit(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, (saving || creatingPlace) && styles.disabled]}>
            <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? 'Creating...' : 'Create Plan'}</AppText>
          </Pressable>
        </ScrollView>
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>
    </AppFixedHeaderScreen>
  );
}

export function CreatePlaceScreen({ navigation }: SimpleScreenProps<'CreatePlace'>) {
  const theme = useThemeTokens();
  const [state, setState] = useState<PlaceCreateFormState>(makePlaceCreateForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  async function submit() {
    if (state.title.trim().length < 3) { setError('Add a Place name.'); return; }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.places.create({
        mode: state.mode,
        title: state.title,
        description: state.description.trim() || undefined,
        category: state.category.trim() || undefined,
        visibility: 'private',
        status: 'active',
        addressPublicText: state.mode === 'local' ? state.location.trim() || undefined : undefined,
        onlineLabel: state.mode === 'remote' ? state.onlineLabel.trim() || undefined : undefined,
        onlineUrl: state.mode === 'remote' ? state.onlineUrl.trim() || undefined : undefined,
        defaultNote: state.note.trim() || undefined,
      });
      setMessage(`${response.place.title} was saved to My Places.`);
      setState(makePlaceCreateForm());
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Create place" onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="save" label="My Places" onPress={() => navigation.navigate('MyPlaces')} />} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <SemanticBadge label="My Place" tone="proposal" />
            <AppText style={styles.heroTitle}>Create reusable Place</AppText>
            <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Save an offline or online Place once, then reuse it while creating Plans. Future Plans copy it as snapshots.</AppText>
          </View>
          <View style={[styles.formCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <ModeSegment value={state.mode} onChange={(mode) => setState((current) => ({ ...current, mode }))} />
            <TextField label="Place name" value={state.title} onChangeText={(title) => setState((current) => ({ ...current, title }))} placeholder="Quiet coffee near République" maxLength={120} />
            <TextField label="Category" value={state.category} onChangeText={(category) => setState((current) => ({ ...current, category }))} placeholder="Work, culture, food..." maxLength={80} />
            {state.mode === 'remote' ? (
              <>
                <TextField label="Online label" value={state.onlineLabel} onChangeText={(onlineLabel) => setState((current) => ({ ...current, onlineLabel }))} placeholder="Zoom, Discord, website" maxLength={120} />
                <TextField label="Online URL" value={state.onlineUrl} onChangeText={(onlineUrl) => setState((current) => ({ ...current, onlineUrl }))} placeholder="https://..." keyboardType="url" maxLength={500} />
              </>
            ) : (
              <TextField label="Area / address" value={state.location} onChangeText={(location) => setState((current) => ({ ...current, location }))} placeholder="Paris 11 or a public meeting point" maxLength={240} />
            )}
            <TextField label="Description" value={state.description} onChangeText={(description) => setState((current) => ({ ...current, description }))} placeholder="Reusable Place description." multiline maxLength={2000} />
            <TextField label="Default note" value={state.note} onChangeText={(note) => setState((current) => ({ ...current, note }))} placeholder="What this Place is good for." multiline maxLength={1000} />
            <InfoNotice tone="info" title="Media limit" body="Place image limits are enforced by tier: Free 1 image, Plus 5 images, Hellowhen Library 6 images. Mobile image upload for Places can be polished separately." />
            {message ? <InfoNotice tone="success" title="Place saved" body={message} /> : null}
            {error ? <InfoNotice tone="warning" title="Could not save Place" body={error} /> : null}
            <Pressable accessibilityRole="button" disabled={saving || state.title.trim().length < 3} onPress={() => { void submit(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, (saving || state.title.trim().length < 3) && styles.disabled]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? 'Saving...' : 'Save Place'}</AppText>
            </Pressable>
          </View>
        </ScrollView>
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  bodyWrap: { flex: 1, minHeight: 0, gap: 10 },
  contentPad: { paddingVertical: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  largeIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { fontSize: 25, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  centerBody: { textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  feedTitleWrap: { flex: 1, gap: 6 },
  feedTitle: { fontSize: 35, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  filterChipText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  menuPanel: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  menuItem: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, gap: 2 },
  menuTitle: { fontSize: 16, fontWeight: '900' },
  menuBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  listContent: { gap: 12, paddingBottom: 34 },
  deckFeedContent: { gap: 20, paddingTop: 2, paddingBottom: 34 },
  deckSection: { gap: 10 },
  deckSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2 },
  deckSectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  deckSectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 },
  deckSectionMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  inlineLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontWeight: '800' },
  rowCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 9 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rowTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  rowBody: { lineHeight: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  placePreview: { fontSize: 13, fontWeight: '900' },
  emptyBlock: { borderRadius: 24, borderWidth: 1, alignItems: 'center', padding: 22, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyBody: { textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  primaryButton: { minHeight: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  primaryButtonText: { fontWeight: '900' },
  hero: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 12 },
  heroTitle: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9 },
  heroBody: { lineHeight: 21, fontWeight: '700' },
  detailContent: { gap: 14, paddingBottom: 34 },
  detailMetaStack: { gap: 8 },
  detailActionStack: { gap: 10 },
  statGrid: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 11, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  statLabel: { fontSize: 11, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.45 },
  joinedState: { minHeight: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  joinedStateText: { fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  secondaryButtonText: { fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  timelineRail: { alignItems: 'center', width: 34 },
  timelineCard: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineMedia: { width: 62, height: 62, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  timelineImage: { width: '100%', height: '100%' },
  timelineNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timelineNumberText: { fontSize: 13, fontWeight: '900' },
  timelineLine: { flex: 1, width: 2, marginTop: 6, borderRadius: 999 },
  timelineCopy: { flex: 1, gap: 7, minWidth: 0 },
  detailSection: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailSectionCopy: { flex: 1, gap: 5 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  participantAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  participantInitial: { fontSize: 14, fontWeight: '900' },
  participantCopy: { flex: 1, gap: 2 },
  participantName: { fontSize: 15, fontWeight: '900' },
  participantStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  keyboardWrap: { flex: 1, minHeight: 0 },
  inlineSmallLoading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  formCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 13 },
  formField: { gap: 7, flex: 1, minWidth: 0 },
  formLabel: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 104, lineHeight: 20 },
  modeSegment: { borderRadius: 18, borderWidth: 1, padding: 4, flexDirection: 'row', gap: 4 },
  modeSegmentButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modeSegmentText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  pillButtonText: { fontSize: 12, fontWeight: '900' },
  choiceCard: { borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, minWidth: 0, gap: 5 },
  choiceTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  choiceMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  addMini: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickCreateBox: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 13 },
  placeEditorCard: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  placeEditorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  smallButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  snapshotStrip: { borderRadius: 18, borderWidth: 1, padding: 11, gap: 8 },
  snapshotText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  twoColumnRow: { flexDirection: 'row', gap: 10 },
  previewCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  previewPlaceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  supportSection: { marginTop: 2 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
