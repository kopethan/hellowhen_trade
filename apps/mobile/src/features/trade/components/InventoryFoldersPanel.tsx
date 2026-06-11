import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { InventoryFolderDto, InventoryFolderItemDto, InventoryFolderItemType } from '@hellowhen/contracts';
import { api } from '../../../lib/api';
import { getFriendlyApiErrorMessage } from '../../../lib/errors';
import { MobileIcon } from '../../../components/MobileIcon';
import { AppConfirmSheet } from '../../../components/AppConfirmSheet';
import { AppText } from '../../../components/AppText';
import { InfoNotice } from '../../../components/SemanticUI';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';

type ManagedInventoryItem = { id: string; title: string };

export type InventoryFolderSelection = {
  folderId: string | null;
  folderTitle: string | null;
  itemIds: string[];
};

type InventoryFoldersPanelProps = {
  kind: InventoryFolderItemType;
  items: ManagedInventoryItem[];
  refreshKey: number;
  onSelectionChange: (selection: InventoryFolderSelection) => void;
};

type FolderEditorMode = 'create' | 'edit';

function folderItemTargetId(folderItem: InventoryFolderItemDto, kind: InventoryFolderItemType) {
  return kind === 'need' ? folderItem.needId ?? null : folderItem.offerId ?? null;
}

function folderItemTitle(folderItem: InventoryFolderItemDto, kind: InventoryFolderItemType, items: ManagedInventoryItem[]) {
  const targetId = folderItemTargetId(folderItem, kind);
  const localItem = targetId ? items.find((item) => item.id === targetId) : null;
  if (localItem?.title) return localItem.title;
  if (kind === 'need' && folderItem.need?.title) return folderItem.need.title;
  if (kind === 'offer' && folderItem.offer?.title) return folderItem.offer.title;
  return null;
}

function matchingFolderItems(folder: InventoryFolderDto | null | undefined, kind: InventoryFolderItemType) {
  return (folder?.items ?? []).filter((folderItem) => folderItem.itemType === kind && Boolean(folderItemTargetId(folderItem, kind)));
}

export function InventoryFoldersPanel({ kind, items, refreshKey, onSelectionChange }: InventoryFoldersPanelProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const semantic = kind === 'need' ? theme.semantic.need : theme.semantic.offer;
  const itemsLabel = t(kind === 'need' ? 'inventory.labels.needs' : 'inventory.labels.offers').toLowerCase();
  const [folders, setFolders] = useState<InventoryFolderDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<FolderEditorMode | null>(null);
  const [folderTitle, setFolderTitle] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderTitleError, setFolderTitleError] = useState<string | null>(null);
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const selectedFolder = useMemo(() => folders.find((folder) => folder.id === selectedFolderId) ?? null, [folders, selectedFolderId]);
  const selectedFolderItems = useMemo(() => matchingFolderItems(selectedFolder, kind), [kind, selectedFolder]);
  const selectedFolderItemIds = useMemo(() => selectedFolderItems.map((folderItem) => folderItemTargetId(folderItem, kind)).filter((id): id is string => Boolean(id)), [kind, selectedFolderItems]);
  const selectedFolderItemIdSet = useMemo(() => new Set(selectedFolderItemIds), [selectedFolderItemIds]);
  const availableItems = useMemo(() => items.filter((item) => !selectedFolderItemIdSet.has(item.id)), [items, selectedFolderItemIdSet]);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.inventoryFolders.list({ itemType: kind, includeItems: true });
      const nextFolders = Array.isArray(response.folders) ? response.folders : [];
      setFolders(nextFolders);
      setSelectedFolderId((current) => (current && !nextFolders.some((folder) => folder.id === current) ? null : current));
    } catch (caughtError) {
      setFolders([]);
      setSelectedFolderId(null);
      setError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.foldersCouldNotLoad')));
    } finally {
      setLoading(false);
    }
  }, [kind, t]);

  useEffect(() => { void loadFolders(); }, [loadFolders, refreshKey]);

  useEffect(() => {
    onSelectionChange({ folderId: selectedFolder?.id ?? null, folderTitle: selectedFolder?.title ?? null, itemIds: selectedFolderItemIds });
  }, [onSelectionChange, selectedFolder?.id, selectedFolder?.title, selectedFolderItemIds]);

  function openCreateFolder() {
    setMessage(null);
    setError(null);
    setFolderTitleError(null);
    setFolderTitle('');
    setFolderDescription('');
    setEditorMode('create');
  }

  function openEditFolder() {
    if (!selectedFolder) return;
    setMessage(null);
    setError(null);
    setFolderTitleError(null);
    setFolderTitle(selectedFolder.title);
    setFolderDescription(selectedFolder.description ?? '');
    setEditorMode('edit');
  }

  async function saveFolder() {
    const title = folderTitle.trim();
    const description = folderDescription.trim();
    if (!title) {
      setFolderTitleError(t('inventory.errors.folderTitleRequired'));
      return;
    }

    setFolderTitleError(null);
    setBusyAction('folder-save');
    setError(null);
    try {
      if (editorMode === 'edit' && selectedFolder) {
        const response = await api.inventoryFolders.update(selectedFolder.id, { title, description: description || null });
        setFolders((current) => current.map((folder) => (folder.id === response.folder.id ? response.folder : folder)));
        setMessage(t('inventory.messages.folderUpdated', { title: response.folder.title }));
      } else {
        const response = await api.inventoryFolders.create({ title, description: description || undefined });
        setFolders((current) => [response.folder, ...current.filter((folder) => folder.id !== response.folder.id)]);
        setSelectedFolderId(response.folder.id);
        setMessage(t('inventory.messages.folderCreated', { title: response.folder.title }));
      }
      setEditorMode(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.folderCouldNotSave')));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteFolder() {
    if (!selectedFolder) return;
    const deletedTitle = selectedFolder.title;
    setBusyAction('folder-delete');
    setError(null);
    try {
      await api.inventoryFolders.remove(selectedFolder.id);
      setFolders((current) => current.filter((folder) => folder.id !== selectedFolder.id));
      setSelectedFolderId(null);
      setDeleteConfirmVisible(false);
      setMessage(t('inventory.messages.folderDeleted', { title: deletedTitle }));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.folderCouldNotDelete')));
    } finally {
      setBusyAction(null);
    }
  }

  async function addItemToFolder(item: ManagedInventoryItem) {
    if (!selectedFolder) return;
    setBusyAction(`add-${item.id}`);
    setError(null);
    try {
      await api.inventoryFolders.addItem(selectedFolder.id, { itemType: kind, itemId: item.id });
      await loadFolders();
      setMessage(t('inventory.messages.itemAddedToFolder', { title: item.title, folder: selectedFolder.title }));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.folderItemCouldNotAdd')));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeItemFromFolder(folderItem: InventoryFolderItemDto) {
    if (!selectedFolder) return;
    const title = folderItemTitle(folderItem, kind, items) ?? t(kind === 'need' ? 'inventory.labels.need' : 'inventory.labels.offer');
    setBusyAction(`remove-${folderItem.id}`);
    setError(null);
    try {
      await api.inventoryFolders.removeItem(selectedFolder.id, folderItem.id);
      await loadFolders();
      setMessage(t('inventory.messages.itemRemovedFromFolder', { title, folder: selectedFolder.title }));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('inventory.errors.folderItemCouldNotRemove')));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleBlock}>
          <View style={[styles.panelIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}><MobileIcon name="save" size={16} color={semantic.text} /></View>
          <View style={styles.panelCopy}>
            <AppText style={styles.panelTitle}>{t('inventory.labels.myFolders')}</AppText>
            <AppText style={[styles.panelBody, { color: theme.color.muted }]}>{t('inventory.messages.foldersBody', { items: itemsLabel })}</AppText>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={openCreateFolder} style={({ pressed }) => [styles.iconButton, { backgroundColor: semantic.softBg, borderColor: semantic.border }, pressed && styles.pressed]}><MobileIcon name="add" size={17} color={semantic.text} /></Pressable>
      </View>

      {message ? <InfoNotice tone="success" title={t('common.states.saved')} body={message} /> : null}
      {error ? <InfoNotice tone="danger" title={t('inventory.errors.foldersCouldNotLoad')} body={error} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
        <FolderChip label={t('inventory.labels.allFolders')} active={!selectedFolderId} count={items.length} onPress={() => setSelectedFolderId(null)} />
        {folders.map((folder) => {
          const count = matchingFolderItems(folder, kind).length;
          return <FolderChip key={folder.id} label={folder.title} active={selectedFolderId === folder.id} count={count} onPress={() => setSelectedFolderId(folder.id)} />;
        })}
      </ScrollView>

      {loading ? <AppText style={[styles.statusText, { color: theme.color.muted }]}>{t('inventory.messages.foldersLoading')}</AppText> : null}

      {selectedFolder ? (
        <View style={[styles.selectedFolderBar, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <View style={styles.selectedFolderCopy}>
            <AppText style={styles.selectedFolderTitle} numberOfLines={1}>{selectedFolder.title}</AppText>
            <AppText style={[styles.selectedFolderMeta, { color: theme.color.muted }]}>{t('inventory.labels.folderItemCount', { count: selectedFolderItemIds.length })}</AppText>
          </View>
          <View style={styles.selectedFolderActions}>
            <SmallFolderAction label={t('inventory.actions.addItemsToFolder', { items: itemsLabel })} onPress={() => setItemsModalVisible(true)} />
            <Pressable accessibilityRole="button" onPress={openEditFolder} style={({ pressed }) => [styles.roundAction, { borderColor: theme.color.border }, pressed && styles.pressed]}><MobileIcon name="edit" size={15} color={theme.color.text} /></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDeleteConfirmVisible(true)} style={({ pressed }) => [styles.roundAction, { borderColor: theme.semantic.danger.border, backgroundColor: theme.semantic.danger.softBg }, pressed && styles.pressed]}><MobileIcon name="close" size={15} color={theme.semantic.danger.text} /></Pressable>
          </View>
        </View>
      ) : null}

      <FolderEditorModal
        busy={busyAction === 'folder-save'}
        description={folderDescription}
        descriptionPlaceholder={t('inventory.form.folderDescriptionPlaceholder')}
        mode={editorMode}
        onChangeDescription={setFolderDescription}
        onChangeTitle={(value) => { setFolderTitle(value); setFolderTitleError(null); }}
        onClose={() => setEditorMode(null)}
        onSave={saveFolder}
        itemsLabel={itemsLabel}
        saveLabel={busyAction === 'folder-save' ? t('common.states.saving') : t('inventory.actions.saveFolder')}
        title={folderTitle}
        titleError={folderTitleError}
        titlePlaceholder={t('inventory.form.folderTitlePlaceholder')}
      />

      <FolderItemsModal
        availableItems={availableItems}
        busyAction={busyAction}
        folderItems={selectedFolderItems}
        folderTitle={selectedFolder?.title ?? ''}
        itemKind={kind}
        items={items}
        itemsLabel={itemsLabel}
        onAddItem={addItemToFolder}
        onClose={() => setItemsModalVisible(false)}
        onRemoveItem={removeItemFromFolder}
        visible={itemsModalVisible && Boolean(selectedFolder)}
      />

      <AppConfirmSheet
        cancelLabel={t('common.actions.cancel')}
        confirmDisabled={busyAction === 'folder-delete'}
        confirmLabel={busyAction === 'folder-delete' ? t('common.states.working') : t('inventory.actions.deleteFolder')}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => { void deleteFolder(); }}
        title={selectedFolder ? t('inventory.messages.confirmDeleteFolder', { title: selectedFolder.title }) : t('inventory.actions.deleteFolder')}
        tone="danger"
        visible={deleteConfirmVisible}
      />
    </View>
  );
}

function FolderChip({ label, active, count, onPress }: { label: string; active: boolean; count: number; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.folderChip, { backgroundColor: active ? theme.color.text : theme.color.subtleSurface, borderColor: active ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.folderChipText, { color: active ? theme.color.background : theme.color.text }]} numberOfLines={1}>{label}</AppText>
      <AppText style={[styles.folderChipCount, { color: active ? theme.color.background : theme.color.muted }]}>{count}</AppText>
    </Pressable>
  );
}

function SmallFolderAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallAction, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.smallActionText, { color: theme.color.text }]} numberOfLines={1}>{label}</AppText></Pressable>;
}

function FolderEditorModal({ busy, description, descriptionPlaceholder, itemsLabel, mode, onChangeDescription, onChangeTitle, onClose, onSave, saveLabel, title, titleError, titlePlaceholder }: { busy: boolean; description: string; descriptionPlaceholder: string; itemsLabel: string; mode: FolderEditorMode | null; onChangeDescription: (value: string) => void; onChangeTitle: (value: string) => void; onClose: () => void; onSave: () => void; saveLabel: string; title: string; titleError: string | null; titlePlaceholder: string }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const visible = Boolean(mode);
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalTapArea}>
          <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>{mode === 'edit' ? t('inventory.actions.editFolder') : t('inventory.actions.createFolder')}</AppText>
              <AppText style={[styles.modalBody, { color: theme.color.muted }]}>{t('inventory.messages.foldersBody', { items: itemsLabel })}</AppText>
            </View>
            <View style={styles.formFields}>
              <TextInput value={title} onChangeText={onChangeTitle} maxLength={80} placeholder={titlePlaceholder} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: titleError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]} />
              {titleError ? <AppText style={[styles.fieldError, { color: theme.semantic.danger.text }]}>{titleError}</AppText> : null}
              <TextInput value={description} onChangeText={onChangeDescription} maxLength={240} placeholder={descriptionPlaceholder} placeholderTextColor={theme.color.muted} multiline textAlignVertical="top" style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
            </View>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.modalButtonText, { color: theme.color.text }]}>{t('common.actions.cancel')}</AppText></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, pressed && !busy && styles.pressed, busy && styles.disabled]}><AppText style={[styles.modalButtonText, { color: theme.semantic.proposal.text }]}>{saveLabel}</AppText></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FolderItemsModal({ availableItems, busyAction, folderItems, folderTitle, itemKind, items, itemsLabel, onAddItem, onClose, onRemoveItem, visible }: { availableItems: ManagedInventoryItem[]; busyAction: string | null; folderItems: InventoryFolderItemDto[]; folderTitle: string; itemKind: InventoryFolderItemType; items: ManagedInventoryItem[]; itemsLabel: string; onAddItem: (item: ManagedInventoryItem) => Promise<void>; onClose: () => void; onRemoveItem: (folderItem: InventoryFolderItemDto) => Promise<void>; visible: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, styles.itemsModalSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
          <View style={styles.modalHeader}>
            <AppText style={styles.modalTitle} numberOfLines={2}>{folderTitle}</AppText>
            <AppText style={[styles.modalBody, { color: theme.color.muted }]}>{t('inventory.actions.addItemsToFolder', { items: itemsLabel })}</AppText>
          </View>
          <ScrollView contentContainerStyle={styles.itemModalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.itemGroup}>
              <AppText style={[styles.itemGroupTitle, { color: theme.color.muted }]}>{t('inventory.actions.addToFolder')}</AppText>
              {availableItems.length === 0 ? <AppText style={[styles.emptyInline, { color: theme.color.muted }]}>{t('inventory.empty.allItemsAlreadyInFolder', { items: itemsLabel })}</AppText> : availableItems.map((item) => <FolderItemActionRow key={item.id} busy={busyAction === `add-${item.id}`} label={item.title} actionLabel={t('inventory.actions.addToFolder')} onPress={() => { void onAddItem(item); }} />)}
            </View>
            <View style={styles.itemGroup}>
              <AppText style={[styles.itemGroupTitle, { color: theme.color.muted }]}>{t('inventory.labels.folderItemCount', { count: folderItems.length })}</AppText>
              {folderItems.length === 0 ? <AppText style={[styles.emptyInline, { color: theme.color.muted }]}>{t('inventory.empty.noFolderItems', { folder: folderTitle })}</AppText> : folderItems.map((folderItem) => <FolderItemActionRow key={folderItem.id} busy={busyAction === `remove-${folderItem.id}`} label={folderItemTitle(folderItem, itemKind, items) ?? t(itemKind === 'need' ? 'inventory.labels.need' : 'inventory.labels.offer')} actionLabel={t('inventory.actions.removeFromFolder')} danger onPress={() => { void onRemoveItem(folderItem); }} />)}
            </View>
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeModalButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.closeModalText, { color: theme.color.muted }]}>{t('common.actions.close')}</AppText></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FolderItemActionRow({ actionLabel, busy, danger, label, onPress }: { actionLabel: string; busy: boolean; danger?: boolean; label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  const colors = danger ? theme.semantic.danger : theme.semantic.proposal;
  return (
    <View style={[styles.itemActionRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <AppText style={styles.itemActionTitle} numberOfLines={2}>{label}</AppText>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.itemActionButton, { backgroundColor: colors.softBg, borderColor: colors.border }, pressed && !busy && styles.pressed, busy && styles.disabled]}><AppText style={[styles.itemActionButtonText, { color: colors.text }]}>{busy ? '…' : actionLabel}</AppText></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 28, padding: 14, gap: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  panelTitleBlock: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  panelIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  panelCopy: { flex: 1, gap: 3 },
  panelTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  panelBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  folderChips: { gap: 8, paddingRight: 2 },
  folderChip: { minHeight: 40, maxWidth: 180, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  folderChipText: { flexShrink: 1, fontSize: 13, fontWeight: '900' },
  folderChipCount: { fontSize: 12, fontWeight: '900' },
  statusText: { fontSize: 12, fontWeight: '800' },
  selectedFolderBar: { borderWidth: 1, borderRadius: 22, padding: 12, gap: 10 },
  selectedFolderCopy: { gap: 2 },
  selectedFolderTitle: { fontSize: 15, fontWeight: '900' },
  selectedFolderMeta: { fontSize: 12, fontWeight: '800' },
  selectedFolderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallAction: { flex: 1, minHeight: 38, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  smallActionText: { fontSize: 12, fontWeight: '900' },
  roundAction: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.62)', padding: 14 },
  modalTapArea: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderWidth: 1, borderRadius: 28, padding: 16, gap: 16, maxHeight: '86%' },
  itemsModalSheet: { minHeight: 360 },
  modalHeader: { gap: 5, paddingHorizontal: 2 },
  modalTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  modalBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  formFields: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 86, paddingTop: 12 },
  fieldError: { fontSize: 12, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modalButtonText: { fontSize: 14, fontWeight: '900' },
  itemModalContent: { gap: 16, paddingBottom: 4 },
  itemGroup: { gap: 8 },
  itemGroupTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  emptyInline: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  itemActionRow: { minHeight: 58, borderWidth: 1, borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemActionTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  itemActionButton: { minHeight: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  itemActionButtonText: { fontSize: 12, fontWeight: '900' },
  closeModalButton: { minHeight: 48, borderTopWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeModalText: { fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
