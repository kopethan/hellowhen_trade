import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
}: {
  images: SelectedLocalImage[];
  onChange: (images: SelectedLocalImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  label?: string;
  hint?: string;
  reviewBody?: string;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const resolvedLabel = label ?? t('inventory.labels.images');
  const resolvedReviewBody = reviewBody ?? t('inventory.form.imagePickerDefaultBody');
  const remaining = Math.max(0, maxImages - images.length);
  const atLimit = remaining <= 0;

  async function pickImages() {
    if (disabled || selecting) return;
    setError(null);
    if (remaining <= 0) {
      setError(t('inventory.messages.addImagesLimit', { count: maxImages }));
      return;
    }

    setSelecting(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('inventory.messages.photoLibraryPermission'));
        return;
      }

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

  function removeImage(uri: string) {
    if (disabled) return;
    onChange(images.filter((image) => image.uri !== uri));
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
          {images.map((image) => (
            <View key={image.uri} style={styles.preview}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.remove')} accessibilityState={{ disabled: Boolean(disabled) }} onPress={() => removeImage(image.uri)} disabled={disabled} style={({ pressed }) => [styles.remove, disabled && styles.disabled, pressed && styles.pressed]}>
                <AppText style={styles.removeText}>{t('common.actions.remove')}</AppText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}><AppText style={styles.emptyText}>{t('inventory.labels.noImagesSelected')}</AppText></View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, copy: { flex: 1 }, label: { fontSize: 16, fontWeight: '900' }, hint: { color: '#64748B', fontSize: 12, lineHeight: 18, fontWeight: '700' }, count: { marginTop: 4, color: '#475569', fontSize: 12, fontWeight: '900' }, button: { borderRadius: 14, backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10 }, buttonText: { color: '#FFFFFF', fontWeight: '900' }, previewRow: { gap: 10 }, preview: { width: 118, gap: 7 }, image: { width: 118, height: 92, borderRadius: 16, backgroundColor: '#E2E8F0' }, remove: { borderRadius: 999, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 7, alignItems: 'center' }, removeText: { fontSize: 12, fontWeight: '900', color: '#991B1B' }, empty: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 12 }, emptyText: { color: '#64748B', fontWeight: '700' }, error: { color: '#B91C1C', fontWeight: '700' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
