import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { CreditPill, InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { ImagePickerField } from './components/ImagePickerField';
import { uploadSelectedImages, type SelectedLocalImage } from './mediaUpload';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrade'>;
type CreateTradeResponse = { trade: { id: string; title: string; description: string; creditAmount: number; status: string; expiresAt?: string | null } };
export function CreateTradeScreen({ navigation }: Props) {
  const [title, setTitle] = useState('Need help editing a short launch video');
  const [description, setDescription] = useState('Polish a 45-second launch video for social. Clips and copy are ready.');
  const [creditAmount, setCreditAmount] = useState('25');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleCreate() {
    const cleanTitle = title.trim(); const cleanDescription = description.trim(); const parsedCredits = Number.parseInt(creditAmount, 10);
    if (cleanTitle.length < 3 || cleanDescription.length < 10) { setError('Add a title and a useful description before publishing.'); return; }
    if (!Number.isFinite(parsedCredits) || parsedCredits <= 0) { setError('Credit amount must be a positive whole number.'); return; }
    setSubmitting(true); setError(null);
    try { const mediaIds = await uploadSelectedImages(images); const result = await api.trades.create({ title: cleanTitle, description: cleanDescription, creditAmount: parsedCredits, mediaIds }) as CreateTradeResponse; navigation.replace('TradeDetail', { tradeId: result.trade.id, title: result.trade.title, description: result.trade.description, creditAmount: result.trade.creditAmount, status: result.trade.status, expiresAt: result.trade.expiresAt ?? null }); }
    catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSubmitting(false); }
  }
  const previewCredits = Number.parseInt(creditAmount, 10);
  return <AppScreen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><AppCard><SemanticBadge label="Trade" tone="trade" /><AppText style={styles.title}>Create Trade</AppText><InfoNotice tone="info" title="Public trade" body="Purple marks public trade discovery. Orange time labels are for deadlines; gold labels are fake/test credits only." />{error ? <InfoNotice tone="danger" title="Could not publish" body={error} /> : null}<TextInput value={title} onChangeText={setTitle} placeholder="Title" style={styles.input} editable={!submitting} /><TextInput value={description} onChangeText={setDescription} placeholder="Description" multiline style={[styles.input, styles.textarea]} textAlignVertical="top" editable={!submitting} /><TextInput value={creditAmount} onChangeText={setCreditAmount} placeholder="Credits" keyboardType="number-pad" style={styles.input} editable={!submitting} />{Number.isFinite(previewCredits) && previewCredits > 0 ? <CreditPill amount={previewCredits} label="fake test credits" /> : null}<ImagePickerField images={images} onChange={setImages} disabled={submitting} /><Button title={submitting ? 'Publishing...' : 'Create Public Trade'} disabled={submitting} onPress={handleCreate} /><Button title="Back" disabled={submitting} onPress={() => navigation.goBack()} /></AppCard></ScrollView></AppScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, title: { fontSize: 30, fontWeight: '900' }, input: { borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 12, fontSize: 16 }, textarea: { minHeight: 120 } });
