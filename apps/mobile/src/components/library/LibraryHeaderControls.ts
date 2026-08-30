export type LibraryHeaderControlsHandle = {
  toggleSearch: () => void;
  closeSearch: () => void;
  openFilters: () => void;
};

export type LibraryHeaderControlsState = {
  searchExpanded: boolean;
  hasQuery: boolean;
  filterCount: number;
  canSearch: boolean;
  canFilter: boolean;
};

export const EMPTY_LIBRARY_HEADER_CONTROLS_STATE: LibraryHeaderControlsState = {
  searchExpanded: false,
  hasQuery: false,
  filterCount: 0,
  canSearch: false,
  canFilter: false,
};
