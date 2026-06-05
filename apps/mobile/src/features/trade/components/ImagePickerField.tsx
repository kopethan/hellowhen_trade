import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppActionSheet } from '../../../components/AppActionSheet';
import { AppText } from '../../../components/AppText';
import { InfoNotice } from '../../../components/SemanticUI';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import type { SelectedLocalImage } from '../mediaUpload';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function sanitizeImageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 96) || `hellowhen-image-${Date.now()}.jpg`;
}

function isAllowedMimeType(mimeType?: string | null) {
  if (!mimeType) return true;
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function ImagePickerField({
  images,
  onChange,
  disabled,
  maxImages = 5,
  label,
  hint,
  reviewBody,
  enableOrderControls,
}: {
  images: SelectedLocalImage[];
  onChange: (images: SelectedLocalImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  label?: string;
  hint?: string;
  reviewBody?: string;
  enableOrderControls?: boolean;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [accessIntroVisible, setAccessIntroVisible] = useState(false);
  const [accessIntroAccepted, setAccessIntroAccepted] = useState(false);
  const resolvedLabel = label ?? t('inventory.labels.images');
  const resolvedReviewBody = reviewBody ?? t('inventory.form.imagePickerDefaultBody');
  const remaining = Math.max(0, maxImages - images.length);
  const atLimit = remaining <= 0;

  async function openImagePicker() {
    if (disabled || selecting) return;
    setError(null);
    if (remaining <= 0) {
      setError(t('inventory.messages.addImagesLimit', { count: maxImages }));
      return;
    }

    setSelecting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.82,
      });
      if (result.canceled) return;

      const selected: SelectedLocalImage[] = [];
      let rejectedForType = 0;
      let rejectedForSize = 0;

      for (const [index, asset] of result.assets.entries()) {
        if (!isAllowedMimeType(asset.mimeType)) {
          rejectedForType += 1;
          continue;
        }
        if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
          rejectedForSize += 1;
          continue;
        }
        selected.push({
          uri: asset.uri,
          name: sanitizeImageName(asset.fileName ?? `hellowhen-image-${Date.now()}-${index}.jpg`),
          type: asset.mimeType ?? 'image/jpeg',
          sizeBytes: asset.fileSize,
        });
      }

      if (rejectedForType > 0 || rejectedForSize > 0) {
        const reasons = [
          rejectedForType > 0 ? t('inventory.messages.imageUnsupportedType') : null,
          rejectedForSize > 0 ? t('inventory.messages.imageTooLarge', { maxMb: 8 }) : null,
        ].filter(Boolean).join(' ');
        setError(reasons);
      }

      if (selected.length > 0) onChange([...images, ...selected].slice(0, maxImages));
    } catch {
      setError(t('inventory.messages.imagePickerFailed'));
    } finally {
      setSelecting(false);
    }
  }


  function pickImages() {
    if (disabled || selecting) return;
    setError(null);
    if (remaining <= 0) {
      setError(t('inventory.messages.addImagesLimit', { count: maxImages }));
      return;
    }
    if (!accessIntroAccepted) {
      setAccessIntroVisible(true);
      return;
    }
    void openImagePicker();
  }

  function continueAfterAccessIntro() {
    setAccessIntroVisible(false);
    setAccessIntroAccepted(true);
    void openImagePicker();
  }

  function normalizeCoverOrder(nextImages: SelectedLocalImage[]) {
    return nextImages;
  }

  function removeImage(uri: string) {
    if (disabled) return;
    onChange(normalizeCoverOrder(images.filter((image) => image.uri !== uri)));
  }

  function moveImage(uri: string, direction: 'up' | 'down') {
    if (disabled) return;
    const index = images.findIndex((image) => image.uri === uri);
    if (index < 0) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(nextIndex, 0, item);
    onChange(normalizeCoverOrder(next));
  }

  function setCoverImage(uri: string) {
    if (disabled) return;
    const index = images.findIndex((image) => image.uri === uri);
    if (index <= 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.unshift(item);
    onChange(normalizeCoverOrder(next));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <AppText style={styles.label}>{resolvedLabel}</AppText>
          <AppText style={styles.hint}>{hint ?? t('inventory.form.imagePickerHint', { count: maxImages })}</AppText>
          <AppText style={styles.count}>{t('inventory.form.selectedCount', { count: images.length, max: maxImages })}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.actions.add')} ${resolvedLabel}`} accessibilityState={{ disabled: Boolean(disabled || selecting || atLimit), busy: selecting }} disabled={disabled || selecting || atLimit} onPress={pickImages} style={({ pressed }) => [styles.button, (disabled || selecting || atLimit) && styles.disabled, pressed && styles.pressed]}>
          <AppText style={styles.buttonText}>{selecting ? t('common.states.loading') : atLimit ? t('inventory.actions.imageLimitReached') : t('common.actions.add')}</AppText>
        </Pressable>
      </View>
      {resolvedReviewBody ? <InfoNotice tone="info" title={t('inventory.labels.images')} body={resolvedReviewBody} /> : null}
      {error ? <InfoNotice tone="danger" title={t('inventory.labels.images')} body={error} /> : null}
      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {images.map((image, index) => {
            const isCover = index === 0;
            return (
              <View key={image.uri} style={styles.preview}>
                <Image source={{ uri: image.uri }} style={styles.image} />
                {enableOrderControls ? <AppText style={styles.coverLabel}>{isCover ? 'Cover' : `Image ${index + 1}`}</AppText> : null}
                {enableOrderControls ? (
                  <View style={styles.orderRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Move image earlier" accessibilityState={{ disabled: Boolean(disabled || index === 0) }} onPress={() => moveImage(image.uri, 'up')} disabled={disabled || index === 0} style={({ pressed }) => [styles.orderButton, (disabled || index === 0) && styles.disabled, pressed && styles.pressed]}><AppText style={styles.orderText}>↑</AppText></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Move image later" accessibilityState={{ disabled: Boolean(disabled || index === images.length - 1) }} onPress={() => moveImage(image.uri, 'down')} disabled={disabled || index === images.length - 1} style={({ pressed }) => [styles.orderButton, (disabled || index === images.length - 1) && styles.disabled, pressed && styles.pressed]}><AppText style={styles.orderText}>↓</AppText></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Set as cover" accessibilityState={{ disabled: Boolean(disabled || isCover) }} onPress={() => setCoverImage(image.uri)} disabled={disabled || isCover} style={({ pressed }) => [styles.orderButtonWide, (disabled || isCover) && styles.disabled, pressed && styles.pressed]}><AppText style={styles.orderText}>Cover</AppText></Pressable>
                  </View>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.remove')} accessibilityState={{ disabled: Boolean(disabled) }} onPress={() => removeImage(image.uri)} disabled={disabled} style={({ pressed }) => [styles.remove, disabled && styles.disabled, pressed && styles.pressed]}>
                  <AppText style={styles.removeText}>{t('common.actions.remove')}</AppText>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.empty}><AppText style={styles.emptyText}>{t('inventory.labels.noImagesSelected')}</AppText></View>
      )}
      <AppActionSheet
        visible={accessIntroVisible}
        title={t('inventory.permissions.imagePickerTitle')}
        body={t('inventory.permissions.imagePickerBody')}
        cancelLabel={t('common.actions.cancel')}
        onCancel={() => setAccessIntroVisible(false)}
        actions={[{
          key: 'continue',
          label: t('common.actions.continue'),
          icon: 'image',
          tone: 'primary',
          helper: t('inventory.permissions.imagePickerHelper'),
          onPress: continueAfterAccessIntro,
        }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, copy: { flex: 1 }, label: { fontSize: 16, fontWeight: '900' }, hint: { color: '#64748B', fontSize: 12, lineHeight: 18, fontWeight: '700' }, count: { marginTop: 4, color: '#475569', fontSize: 12, fontWeight: '900' }, button: { borderRadius: 14, backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10 }, buttonText: { color: '#FFFFFF', fontWeight: '900' }, previewRow: { gap: 10 }, preview: { width: 132, gap: 7 }, image: { width: 132, height: 98, borderRadius: 16, backgroundColor: '#E2E8F0' }, coverLabel: { position: 'absolute', top: 8, left: 8, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.78)', color: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '900' }, orderRow: { flexDirection: 'row', gap: 5 }, orderButton: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 7, alignItems: 'center' }, orderButtonWide: { flex: 2, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 7, alignItems: 'center' }, orderText: { fontSize: 11, fontWeight: '900', color: '#334155' }, remove: { borderRadius: 999, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 7, alignItems: 'center' }, removeText: { fontSize: 12, fontWeight: '900', color: '#991B1B' }, empty: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 12 }, emptyText: { color: '#64748B', fontWeight: '700' }, error: { color: '#B91C1C', fontWeight: '700' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
