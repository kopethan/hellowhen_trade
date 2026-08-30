import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppHeaderActionButton } from '../AppHeaderActionButton';
import type { LibraryHeaderControlsState } from './LibraryHeaderControls';

type LibraryHeaderActionsProps = {
  tone: SemanticColorName;
  state: LibraryHeaderControlsState;
  searchAccessibilityLabel: string;
  filterAccessibilityLabel: string;
  createAccessibilityLabel: string;
  onToggleSearch: () => void;
  onOpenFilters: () => void;
  onCreate: () => void;
};

export function LibraryHeaderActions({
  tone,
  state,
  searchAccessibilityLabel,
  filterAccessibilityLabel,
  createAccessibilityLabel,
  onToggleSearch,
  onOpenFilters,
  onCreate,
}: LibraryHeaderActionsProps) {
  const searchActive = state.searchExpanded || state.hasQuery;
  const filterActive = state.filterCount > 0;

  return (
    <View style={styles.row}>
      <AppHeaderActionButton
        icon="search"
        accessibilityLabel={searchAccessibilityLabel}
        onPress={onToggleSearch}
        tone={searchActive ? tone : undefined}
        disabled={!state.canSearch}
      />
      <AppHeaderActionButton
        icon="filter"
        accessibilityLabel={filterAccessibilityLabel}
        onPress={onOpenFilters}
        tone={filterActive ? tone : undefined}
        badgeCount={state.filterCount}
        badgeTone={tone}
        disabled={!state.canFilter}
      />
      <AppHeaderActionButton
        icon="add"
        iconSize={23}
        accessibilityLabel={createAccessibilityLabel}
        onPress={onCreate}
        tone={tone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
