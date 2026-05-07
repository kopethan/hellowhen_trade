import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';


type Props = NativeStackScreenProps<RootStackParamList, 'CreateOffer'>;
export function CreateOfferScreen({ navigation }: Props) {
  const [title, setTitle] = useState('Offer a quick skill or service');
  const [description, setDescription] = useState('Describe what you offer, what you deliver, and how fast you can help.');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleCreate() {
    const cleanTitle = title.trim(); const cleanDescription = description.trim();
    if (cleanTitle.length < 3 || cleanDescription.length < 10) { setError('Add a title and a description with enough detail.'); return; }
    setSubmitting(true); setError(null);
    try { const mediaIds = await uploadSelectedImages(images); await api.offers.create({ title: cleanTitle, description: cleanDescription, status: 'draft', mediaIds }); navigation.goBack(); }
    catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSubmitting(false); }
  }
  return <AppScreen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><AppCard><SemanticBadge label="Offer" tone="offer" /><AppText style={styles.title}>Create Offer</AppText><InfoNotice tone="instruction" title="How to use this" body="Use green for services you can provide. Add sample images to make the offer easier to trust." />{error ? <InfoNotice tone="danger" title="Could not create" body={error} /> : null}<TextInput value={title} onChangeText={setTitle} placeholder="Title" style={styles.input} editable={!submitting} /><TextInput value={description} onChangeText={setDescription} placeholder="Description" multiline style={[styles.input, styles.textarea]} textAlignVertical="top" editable={!submitting} /><ImagePickerField images={images} onChange={setImages} disabled={submitting} /><Button title={submitting ? 'Creating...' : 'Create Offer'} disabled={submitting} onPress={handleCreate} /><Button title="Back" disabled={submitting} onPress={() => navigation.goBack()} /></AppCard></ScrollView></AppScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, title: { fontSize: 30, fontWeight: '900' }, input: { borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 12, fontSize: 16 }, textarea: { minHeight: 120 } });
