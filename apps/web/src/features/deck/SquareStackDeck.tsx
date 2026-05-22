'use client';

import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import {
  SQUARE_DECK_COMMIT_THRESHOLD,
  SQUARE_DECK_PROGRESS_DISTANCE_FACTOR,
  SQUARE_DECK_TRANSITION_MS,
  SQUARE_DECK_VELOCITY_THRESHOLD,
  getDiagonalProgress,
  getDragPose,
  getForwardPose,
  getLayerPose,
  getNativeRailPose,
} from './squareDeckMotion';
import { classifySquareDeckPanIntent, type SquareDeckGestureIntent } from './squareDeckGestureIntent';

export type SquareStackDeckItem = {
  id: string;
  ariaLabel: string;
  content: ReactNode;
};

type DragState = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  intent: SquareDeckGestureIntent;
  swiping: boolean;
  captured: boolean;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  cardSize: number;
};

type SquareStackDeckProps = {
  items: SquareStackDeckItem[];
  label: string;
  className?: string;
  onOpen?: (item: SquareStackDeckItem, index: number) => void;
  /**
   * Used by embedded preview decks where the surrounding form should not scroll
   * while the user's finger/pointer starts inside the deck surface. Feed decks
   * keep this disabled so vertical gestures can scroll the feed.
   */
  lockScrollWithinDeck?: boolean;
};

const VISIBLE_LAYERS = 4;
const MOBILE_VISIBLE_LAYERS = 6;
const TOUCH_COMMIT_PX = 54;
const WHEEL_COMMIT_PX = 24;
const WHEEL_COOLDOWN_MS = 340;
const WHEEL_LINE_PX = 16;
const WHEEL_ACTIVE_ZONE_INSET_PX = 24;
const MOBILE_VIEWPORT_QUERY = '(max-width: 759px)';

function useMobileDeckViewport() {
  const [isMobileDeckViewport, setIsMobileDeckViewport] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setIsMobileDeckViewport(query.matches);
    update();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return isMobileDeckViewport;
}

function getPointerVelocity(drag: DragState, clientX: number, clientY: number) {
  const now = window.performance.now();
  const elapsedSeconds = Math.max(0.016, (now - drag.lastTime) / 1000);

  return {
    now,
    velocityX: (clientX - drag.lastX) / elapsedSeconds,
    velocityY: (clientY - drag.lastY) / elapsedSeconds,
  };
}

function scrollDeckContainer(surface: HTMLElement, deltaY: number) {
  const scrollArea = surface.closest('.web-scroll-area') as HTMLElement | null;
  if (scrollArea) {
    scrollArea.scrollTop += deltaY;
    return;
  }

  window.scrollBy({ top: deltaY, left: 0, behavior: 'auto' });
}

function normalizeWheelDeltas(event: WheelEvent) {
  const factor = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? window.innerHeight : 1;

  return {
    dx: event.deltaX * factor,
    dy: event.deltaY * factor,
  };
}

function isPointInsideDeckActiveZone(rect: DOMRect, clientX: number, clientY: number) {
  const insetX = Math.min(WHEEL_ACTIVE_ZONE_INSET_PX, Math.max(0, rect.width / 2));
  const insetY = Math.min(WHEEL_ACTIVE_ZONE_INSET_PX, Math.max(0, rect.height / 2));

  return (
    clientX >= rect.left + insetX &&
    clientX <= rect.right - insetX &&
    clientY >= rect.top + insetY &&
    clientY <= rect.bottom - insetY
  );
}

export function SquareStackDeck({ items, label, className, onOpen, lockScrollWithinDeck = false }: SquareStackDeckProps) {
  const { t } = useWebTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [motion, setMotion] = useState<'next' | 'prev' | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [surfaceSize, setSurfaceSize] = useState(340);
  const deckRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => {});
  const wheelLockedUntilRef = useRef(0);
  const suppressOpenUntilRef = useRef(0);
  const commitTimerRef = useRef<number | null>(null);
  const isMobileDeckViewport = useMobileDeckViewport();

  const itemCount = items.length;
  const canGoNext = itemCount > 1 && activeIndex < itemCount - 1;
  const canGoPrev = itemCount > 1 && activeIndex > 0;
  const activeItem = items[activeIndex];
  const canOpenActive = Boolean(onOpen);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => () => {
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
  }, []);

  // React wheel handlers may be attached passively by the browser/runtime, which can
  // make preventDefault() unreliable for stopping page scroll. Use a native
  // non-passive listener on the deck root so wheel gestures are only consumed when
  // this deck can actually move.
  useEffect(() => {
    const element = deckRef.current;
    if (!element) return;

    const onNativeWheel = (event: WheelEvent) => {
      wheelHandlerRef.current(event);
    };

    element.addEventListener('wheel', onNativeWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    setDrag(null);
  }, [isMobileDeckViewport]);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;

    const updateSurfaceSize = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setSurfaceSize(width);
    };

    updateSurfaceSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSurfaceSize);
      return () => window.removeEventListener('resize', updateSurfaceSize);
    }

    const observer = new ResizeObserver(updateSurfaceSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [itemCount]);

  const dragProgress = isMobileDeckViewport && drag?.swiping ? getDiagonalProgress(drag.dx, drag.dy, drag.cardSize) : 0;

  const visibleItems = useMemo(() => {
    let startIndex = motion === 'prev' && activeIndex > 0 ? activeIndex - 1 : activeIndex;
    if (isMobileDeckViewport && dragProgress < 0 && activeIndex > 0) startIndex = activeIndex - 1;
    const layerCount = isMobileDeckViewport ? Math.min(MOBILE_VISIBLE_LAYERS, itemCount) : Math.min(VISIBLE_LAYERS, itemCount);

    return Array.from({ length: layerCount }, (_, layer) => {
      const itemIndex = startIndex + layer;
      if (itemIndex < 0 || itemIndex >= itemCount) return null;
      return { item: items[itemIndex], itemIndex, layer };
    }).filter((entry): entry is { item: SquareStackDeckItem; itemIndex: number; layer: number } => Boolean(entry?.item));
  }, [activeIndex, dragProgress, isMobileDeckViewport, itemCount, items, motion]);

  const maxVisibleBackLayers = Math.max(1, VISIBLE_LAYERS - 1);
  const visibleBackLayers = Math.min(Math.max(itemCount - activeIndex - 1, 0), maxVisibleBackLayers);
  const advanceControlOutset = 2 + Math.round(10 * (visibleBackLayers / maxVisibleBackLayers));
  const deckStyle = {
    '--deck-visible-back-layers': String(visibleBackLayers),
    '--deck-max-back-layers': String(maxVisibleBackLayers),
    '--deck-advance-control-outset': `${advanceControlOutset}px`,
  } as CSSProperties;

  const commit = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next' && !canGoNext) return;
    if (direction === 'prev' && !canGoPrev) return;
    if (motion) return;

    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
    setDrag(null);
    setMotion(direction);
    commitTimerRef.current = window.setTimeout(() => {
      setActiveIndex((current) => direction === 'next' ? Math.min(current + 1, itemCount - 1) : Math.max(current - 1, 0));
      setMotion(null);
      setDrag(null);
    }, SQUARE_DECK_TRANSITION_MS);
  }, [canGoNext, canGoPrev, itemCount, motion]);

  const openActive = useCallback(() => {
    if (!canOpenActive || !activeItem || motion || drag?.swiping) return;
    if (window.performance.now() < suppressOpenUntilRef.current) return;
    onOpen?.(activeItem, activeIndex);
  }, [activeIndex, activeItem, canOpenActive, drag?.swiping, motion, onOpen]);

  function handleWheel(event: WheelEvent) {
    const surface = surfaceRef.current;
    if (!surface) return;

    if (lockScrollWithinDeck && event.cancelable) {
      event.preventDefault();
    }

    if (itemCount <= 1) return;

    const rect = surface.getBoundingClientRect();
    if (!isPointInsideDeckActiveZone(rect, event.clientX, event.clientY)) return;

    const { dx, dy } = normalizeWheelDeltas(event);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < WHEEL_COMMIT_PX) return;

    const axisDelta = absX > absY ? dx : dy;
    const direction = axisDelta > 0 ? 'next' : 'prev';

    if ((direction === 'next' && !canGoNext) || (direction === 'prev' && !canGoPrev)) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();

    if (motion) return;

    const now = window.performance.now();
    if (now < wheelLockedUntilRef.current) return;
    wheelLockedUntilRef.current = now + WHEEL_COOLDOWN_MS;
    commit(direction);
  }

  wheelHandlerRef.current = handleWheel;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || itemCount <= 1 || motion) return;
    if ((event.target as Element | null)?.closest('[data-deck-control],a,button,input,textarea,select,label')) return;

    const cardSize = Math.max(1, event.currentTarget.getBoundingClientRect().width || surfaceSize);
    const now = window.performance.now();
    setDrag({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      intent: 'UNDECIDED',
      swiping: false,
      captured: false,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: now,
      velocityX: 0,
      velocityY: 0,
      cardSize,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId || drag.pointerType === 'mouse') return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    let intent = drag.intent;
    let captured = drag.captured;

    if (intent === 'UNDECIDED') {
      intent = classifySquareDeckPanIntent({ dx, dy, hasPrev: canGoPrev, hasNext: canGoNext });
      if (intent === 'UNDECIDED') return;
    }

    const velocity = getPointerVelocity(drag, event.clientX, event.clientY);


    if (isMobileDeckViewport && intent === 'SCROLL') {
      event.preventDefault();
      if (!captured) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          captured = true;
        } catch {
          captured = false;
        }
      }
      if (!lockScrollWithinDeck) {
        scrollDeckContainer(event.currentTarget, drag.lastY - event.clientY);
      }
      suppressOpenUntilRef.current = window.performance.now() + 260;
      setDrag({
        ...drag,
        dx,
        dy,
        intent,
        swiping: false,
        captured,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: velocity.now,
        velocityX: velocity.velocityX,
        velocityY: velocity.velocityY,
      });
      return;
    }

    if (intent === 'SCROLL') {
      if (lockScrollWithinDeck) {
        event.preventDefault();
        suppressOpenUntilRef.current = window.performance.now() + 260;
        setDrag({
          ...drag,
          dx,
          dy,
          intent,
          swiping: false,
          captured: false,
          lastX: event.clientX,
          lastY: event.clientY,
          lastTime: velocity.now,
          velocityX: velocity.velocityX,
          velocityY: velocity.velocityY,
        });
        return;
      }
      setDrag(null);
      return;
    }

    if (!captured) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        captured = true;
      } catch {
        captured = false;
      }
    }

    event.preventDefault();
    setDrag({
      ...drag,
      dx,
      dy,
      intent,
      swiping: true,
      captured,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: velocity.now,
      velocityX: velocity.velocityX,
      velocityY: velocity.velocityY,
    });
  }

  function endTouchDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.captured) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released the pointer capture.
      }
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const diagonalDrag = dx + dy * 0.9;
    const intent = drag.intent;
    const swiping = drag.swiping;
    setDrag(null);
    if (intent === 'SCROLL') {
      suppressOpenUntilRef.current = window.performance.now() + 260;
      return;
    }
    if (!swiping || (intent !== 'SWIPE_NEXT' && intent !== 'SWIPE_PREV')) return;

    suppressOpenUntilRef.current = window.performance.now() + 260;

    if (isMobileDeckViewport) {
      const currentProgress = getDiagonalProgress(dx, dy, drag.cardSize);
      const velocityProgress = -((drag.velocityX + drag.velocityY * 0.9) / (drag.cardSize * SQUARE_DECK_PROGRESS_DISTANCE_FACTOR));
      if (intent === 'SWIPE_NEXT' && (currentProgress > SQUARE_DECK_COMMIT_THRESHOLD || velocityProgress > SQUARE_DECK_VELOCITY_THRESHOLD)) commit('next');
      if (intent === 'SWIPE_PREV' && (currentProgress < -SQUARE_DECK_COMMIT_THRESHOLD || velocityProgress < -SQUARE_DECK_VELOCITY_THRESHOLD)) commit('prev');
      return;
    }

    if (intent === 'SWIPE_NEXT' && -diagonalDrag > TOUCH_COMMIT_PX) commit('next');
    if (intent === 'SWIPE_PREV' && diagonalDrag > TOUCH_COMMIT_PX) commit('prev');
  }

  function getLayerStyle(layer: number, itemIndex: number): CSSProperties {
    if (isMobileDeckViewport) {
      const progress = motion === 'next' ? 1 : motion === 'prev' ? -1 : drag?.swiping ? dragProgress : 0;
      const visualOffset = itemIndex - activeIndex - progress;
      const pose = getNativeRailPose(visualOffset, surfaceSize);

      return {
        zIndex: Math.round(1000 - visualOffset * 40),
        opacity: pose.opacity,
        transform: `translate3d(${pose.x}px, ${pose.y}px, 0) scale(${pose.scale}) rotate(${pose.rotate}deg)`,
        transition: drag?.swiping ? 'none' : undefined,
        pointerEvents: itemIndex === activeIndex && !motion ? 'auto' : 'none',
      };
    }

    const pose = getLayerPose(layer);
    let x = pose.x;
    let y = pose.y;
    let scale = pose.scale;
    let rotate = 0;
    let opacity = pose.opacity;

    if (layer === 0 && drag?.swiping) {
      const dragPose = getDragPose(drag.dx, drag.dy);
      x = dragPose.x;
      y = dragPose.y;
      rotate = dragPose.rotate;
    }

    if (motion === 'next') {
      if (layer === 0) {
        const exit = getForwardPose(1);
        x = exit.x;
        y = exit.y;
        rotate = exit.rotate;
        opacity = 1;
      } else {
        const nextPose = getLayerPose(Math.max(0, layer - 1));
        x = nextPose.x;
        y = nextPose.y;
        scale = nextPose.scale;
        opacity = nextPose.opacity;
      }
    }

    if (motion === 'prev' && layer === 0) {
      opacity = 1;
    }

    return {
      zIndex: 10 - layer,
      opacity,
      transform: motion === 'next' && layer === 0
        ? `translate3d(${x}%, ${y}%, 0) scale(${scale}) rotate(${rotate}deg)`
        : `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
      transition: drag?.swiping ? 'none' : undefined,
      pointerEvents: layer === 0 ? 'auto' : 'none',
    };
  }

  const deckClassName = [
    'square-stack-deck',
    className,
    isMobileDeckViewport ? 'square-stack-deck--native-mobile' : null,
    (motion || drag?.swiping) ? 'is-interacting' : null,
    !canOpenActive ? 'square-stack-deck--no-open' : null,
    lockScrollWithinDeck ? 'square-stack-deck--scroll-locked' : null,
  ].filter(Boolean).join(' ');

  return (
    <section ref={deckRef} className={deckClassName} style={deckStyle} aria-label={label}>
      <div
        ref={surfaceRef}
        className={motion === 'prev' && !isMobileDeckViewport ? 'square-stack-deck__surface is-prev-entering' : 'square-stack-deck__surface'}
        role={canOpenActive ? 'button' : 'group'}
        tabIndex={0}
        aria-label={activeItem?.ariaLabel ?? label}
        onClick={openActive}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openActive();
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            commit('next');
          }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            commit('prev');
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endTouchDrag}
        onPointerCancel={endTouchDrag}
      >
        {visibleItems.slice().reverse().map(({ item, itemIndex, layer }) => {
          const isFrontLayer = isMobileDeckViewport ? itemIndex === activeIndex : layer === 0;
          const isHiddenLayer = isMobileDeckViewport ? itemIndex !== activeIndex : layer !== 0;

          return (
            <article key={`${item.id}-${itemIndex}`} className={isFrontLayer ? 'square-stack-deck__layer is-front' : 'square-stack-deck__layer'} style={getLayerStyle(layer, itemIndex)} aria-hidden={isHiddenLayer}>
              {item.content}
            </article>
          );
        })}
      </div>

      {itemCount > 1 ? (
        <>
          {canGoPrev ? (
            <button
              type="button"
              data-deck-control="true"
              className="square-stack-deck__control square-stack-deck__control--prev"
              disabled={Boolean(motion)}
              onClick={(event) => { event.stopPropagation(); commit('prev'); }}
              aria-label={t('common.actions.previousCard')}
            >
              <WebIcon name="deck-back" size={22} decorative />
            </button>
          ) : null}
          {canGoNext ? (
            <button
              type="button"
              data-deck-control="true"
              className="square-stack-deck__control square-stack-deck__control--next"
              disabled={Boolean(motion)}
              onClick={(event) => { event.stopPropagation(); commit('next'); }}
              aria-label={t('common.actions.nextCard')}
            >
              <WebIcon name="deck-advance" size={22} decorative />
            </button>
          ) : null}
          <div className="square-stack-deck__dots" aria-label={`Card ${activeIndex + 1} of ${itemCount}`}>
            {items.map((item, index) => <span key={item.id} className={index === activeIndex ? 'is-active' : ''} />)}
          </div>
        </>
      ) : null}
    </section>
  );
}
