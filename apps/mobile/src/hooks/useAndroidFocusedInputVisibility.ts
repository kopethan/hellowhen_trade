import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { findNodeHandle, Keyboard, Platform, ScrollView, TextInput } from 'react-native';

type AndroidFocusedInputVisibilityOptions = {
  scrollViewRef: RefObject<ScrollView | null>;
  safeGap?: number;
  bottomClearance?: number;
  enabled?: boolean;
};

type FocusedInputTarget = {
  input: TextInput;
  additionalOffset: number;
};

export type AndroidFocusedInputVisibilityHandlers = {
  onInputFocus: (input: TextInput | null, additionalOffset?: number) => void;
  onInputBlur: (input: TextInput | null) => void;
  revealFocusedInput: (animated?: boolean) => void;
};

/**
 * Keeps the focused field visible above the Android IME without changing the
 * existing iOS KeyboardAvoidingView behavior.
 *
 * The first correction handles focus changes while the keyboard is already
 * open. A second correction runs after keyboardDidShow so the final position
 * uses Android's resized viewport instead of a fixed animation delay.
 */
export function useAndroidFocusedInputVisibility({
  scrollViewRef,
  safeGap = 16,
  bottomClearance = 0,
  enabled = true,
}: AndroidFocusedInputVisibilityOptions): AndroidFocusedInputVisibilityHandlers {
  const focusedTargetRef = useRef<FocusedInputTarget | null>(null);
  const bottomClearanceRef = useRef(bottomClearance);

  useEffect(() => {
    bottomClearanceRef.current = bottomClearance;
  }, [bottomClearance]);

  const revealFocusedInput = useCallback((animated = true) => {
    if (!enabled || Platform.OS !== 'android') return;
    const target = focusedTargetRef.current;
    const scrollView = scrollViewRef.current;
    if (!target || !scrollView || !target.input.isFocused()) return;

    const nodeHandle = findNodeHandle(target.input);
    if (!nodeHandle) return;

    requestAnimationFrame(() => {
      scrollView.scrollResponderScrollNativeHandleToKeyboard(
        nodeHandle,
        safeGap + bottomClearanceRef.current + target.additionalOffset,
        animated,
      );
    });
  }, [enabled, safeGap, scrollViewRef]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return undefined;
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      revealFocusedInput(true);
    });
    return () => keyboardDidShow.remove();
  }, [enabled, revealFocusedInput]);

  const onInputFocus = useCallback((input: TextInput | null, additionalOffset = 0) => {
    if (!enabled || Platform.OS !== 'android' || !input) return;
    focusedTargetRef.current = { input, additionalOffset };
    revealFocusedInput(true);
  }, [revealFocusedInput]);

  const onInputBlur = useCallback((input: TextInput | null) => {
    if (!enabled || Platform.OS !== 'android' || !input) return;
    if (focusedTargetRef.current?.input === input) focusedTargetRef.current = null;
  }, [enabled]);

  return { onInputFocus, onInputBlur, revealFocusedInput };
}
