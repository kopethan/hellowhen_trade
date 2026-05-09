import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { InventoryTypePicker, itemTypeLabel } from './components/InventoryFormFields';
import { DangerButton, ExistingMediaManager, getOptionalString, getStringArray, InventoryModePicker, InventoryTextField, joinCsv, modeLabel, normalizeMode, optionalText, parseCsv, PrimaryButton, SecondaryButton, type InventoryMode } from './components/InventoryDetailFields';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';
import type { InventoryItemType } from '@hellowhen/contracts';
import type { NeedItem, OfferItem } from './types';

type InventoryKind = 'need' | 'offer';
type InventoryItem = (NeedItem | OfferItem) & Record<string, unknown>;
type InventoryResponse = { need?: NeedItem; offer?: OfferItem; archived?: boolean };

export function InventoryDetailScreen({ kind, itemId, fallbackTitle, navigation }: { kind: InventoryKind; itemId: string; fallbackTitle?: string; navigation: NativeStackNavigationProp<RootStackParamList> }) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('service');
  const [category, setCategory] = useState('');
  const [timingOrAvailability, setTimingOrAvailability] = useState('');
  const [mode, setMode] = useState<InventoryMode>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [includesInput, setIncludesInput] = useState('');
  const [newImages, setNewImages] = useState<SelectedLocalImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNeed = kind === 'need';
  const label = isNeed ? 'Need' : 'Offer';
  const tone = isNeed ? 'need' : 'offer';
  const titlePlaceholder = isNeed ? 'Landing page design' : 'Product photography';
  const timingLabel = isNeed ? 'Timing' : 'Availability';
  const timingPlaceholder = isNeed ? 'This week, today, weekend...' : 'Weekend, evenings, this week...';

  const hydrateForm = useCallback((nextItem: InventoryItem) => {
    setItem(nextItem);
    setTitle(nextItem.title ?? '');
    setDescription(nextItem.description ?? '');
    setItemType((nextItem.itemType as InventoryItemType | undefined) ?? 'service');
    setCategory(getOptionalString(nextItem, 'category'));
    setTimingOrAvailability(isNeed ? getOptionalString(nextItem, 'timing') : getOptionalString(nextItem, 'availability'));
    setMode(normalizeMode(getOptionalString(nextItem, 'mode')));
    setLocationLabel(getOptionalString(nextItem, 'locationLabel'));
    setTagsInput(joinCsv(getStringArray(nextItem, 'tags')));
    setIncludesInput(joinCsv(getStringArray(nextItem, 'includes')));
    setNewImages([]);
  }, [isNeed]);

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = isNeed ? await api.needs.get(itemId) as InventoryResponse : await api.offers.get(itemId) as InventoryResponse;
      const nextItem = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
      if (!nextItem) throw new Error(`${label} was not returned by the API.`);
      hydrateForm(nextItem);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, isNeed, itemId, label]);

  useEffect(() => { void loadItem(); }, [loadItem]);

  async function saveItem(nextStatus?: string) {
    if (title.trim().length < 3) { setError(`Add a clear ${label.toLowerCase()} title.`); return; }
    if (description.trim().length < 10) { setError(`Describe the ${label.toLowerCase()} with at least one useful detail.`); return; }

    setSaving(true);
    setError(null);
    try {
      const mediaIds = await uploadSelectedImages(newImages);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        itemType,
        category: optionalText(category),
        mode,
        locationLabel: optionalText(locationLabel),
        tags: parseCsv(tagsInput),
        status: nextStatus ?? item?.status ?? 'draft',
        mediaIds,
        ...(isNeed ? { timing: optionalText(timingOrAvailability) } : { availability: optionalText(timingOrAvailability), includes: parseCsv(includesInput) }),
      } as never;
      const result = isNeed ? await api.needs.update(itemId, payload) as InventoryResponse : await api.offers.update(itemId, payload) as InventoryResponse;
      const nextItem = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
      if (nextItem) hydrateForm(nextItem);
      setEditing(false);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(mediaId: string) {
    setSaving(true);
    setError(null);
    try {
      await api.media.remove(mediaId);
      await loadItem();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${label.toLowerCase()}?`, `Unused ${label.toLowerCase()}s are deleted. ${label}s already used in trades are closed so trade history stays intact.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteItem(); } },
    ]);
  }

  async function deleteItem() {
    setSaving(true);
    setError(null);
    try {
      const result = isNeed ? await api.needs.remove(itemId) as InventoryResponse | undefined : await api.offers.remove(itemId) as InventoryResponse | undefined;
      if (result?.archived) {
        const archived = (isNeed ? result.need : result.offer) as InventoryItem | undefined;
        if (archived) hydrateForm(archived);
        setEditing(false);
        setError(`This ${label.toLowerCase()} is used by a trade, so it was closed instead of permanently deleted.`);
      } else {
        navigation.goBack();
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  const meta = [itemTypeLabel(itemType), category, timingOrAvailability, modeLabel(mode), locationLabel].filter(Boolean).join(' · ');

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadItem(); }} />}>
        <AppHeader title={editing ? `Edit ${label}` : label} onBack={() => navigation.goBack()} />
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}><SemanticBadge label={label} tone={tone} /><AppText style={styles.title}>{item?.title ?? fallbackTitle ?? label}</AppText></View>
        </View>
        {error ? <InfoNotice tone="warning" body={error} /> : null}
        {!item && !loading ? <InfoNotice tone="danger" title={`${label} unavailable`} body={`This ${label.toLowerCase()} could not be loaded.`} /> : null}
        {item ? <><AppCard><View style={styles.statusRow}><StatusBadge status={item.status} size="sm" /><AppText style={styles.updatedText}>Updated {new Date(item.updatedAt).toLocaleDateString()}</AppText></View>{editing ? <View style={styles.form}><InventoryTextField label="Title" value={title} onChangeText={setTitle} placeholder={titlePlaceholder} disabled={saving} /><InventoryTextField label="Description" value={description} onChangeText={setDescription} placeholder={`Describe this ${label.toLowerCase()}.`} multiline disabled={saving} /><InventoryTypePicker value={itemType} onChange={setItemType} disabled={saving} /><InventoryTextField label="Category" value={category} onChangeText={setCategory} placeholder="Design, writing, photography..." disabled={saving} /><InventoryTextField label={timingLabel} value={timingOrAvailability} onChangeText={setTimingOrAvailability} placeholder={timingPlaceholder} disabled={saving} /><InventoryModePicker value={mode} onChange={setMode} disabled={saving} /><InventoryTextField label="Location" value={locationLabel} onChangeText={setLocationLabel} placeholder="Remote, Paris, local pickup..." disabled={saving} />{!isNeed ? <InventoryTextField label="Includes" value={includesInput} onChangeText={setIncludesInput} placeholder="10 edited shots, 1 revision" disabled={saving} /> : null}<InventoryTextField label="Tags" value={tagsInput} onChangeText={setTagsInput} placeholder="brand, figma, urgent" disabled={saving} /></View> : <View style={styles.readOnly}><AppText style={styles.readTitle}>{item.title}</AppText><AppText style={styles.readDescription}>{item.description}</AppText>{meta ? <AppText style={styles.metaText}>{meta}</AppText> : null}</View>}</AppCard><AppCard><AppText style={styles.sectionTitle}>Images</AppText><ExistingMediaManager media={item.media} disabled={saving} onRemove={removeImage} />{editing ? <ImagePickerField images={newImages} onChange={setNewImages} disabled={saving} /> : null}</AppCard><View style={styles.actions}>{editing ? <PrimaryButton label={saving ? 'Saving...' : 'Save Changes'} disabled={saving} onPress={() => { void saveItem(); }} /> : <PrimaryButton label={`Edit ${label}`} disabled={saving} onPress={() => setEditing(true)} />}{editing ? <SecondaryButton label="Cancel" disabled={saving} onPress={() => { hydrateForm(item); setEditing(false); }} /> : null}{item.status !== 'active' ? <SecondaryButton label="Mark Active" disabled={saving} onPress={() => { void saveItem('active'); }} /> : <SecondaryButton label={`Close ${label}`} disabled={saving} onPress={() => { void saveItem('closed'); }} />}<DangerButton label={`Delete ${label}`} disabled={saving} onPress={confirmDelete} /></View></> : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ content: { paddingBottom: 32, gap: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, headerCopy: { flex: 1, gap: 8 }, title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 }, statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, updatedText: { color: '#64748B', fontSize: 12, fontWeight: '800' }, form: { gap: 14 }, readOnly: { gap: 9 }, readTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 }, readDescription: { color: '#475569', lineHeight: 21, fontWeight: '600' }, metaText: { color: '#64748B', fontWeight: '800' }, sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' }, actions: { gap: 10 } });
