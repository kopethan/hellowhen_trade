'use client';

import type { CSSProperties, PointerEvent, ReactNode, WheelEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { SQUARE_DECK_TRANSITION_MS, getDragPose, getForwardPose, getLayerPose } from './squareDeckMotion';

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
  swiping: boolean;
};

type SquareStackDeckProps = {
  items: SquareStackDeckItem[];
  label: string;
  className?: string;
  onOpen?: (item: SquareStackDeckItem, index: number) => void;
};

const VISIBLE_LAYERS = 3;
const TOUCH_COMMIT_PX = 54;
const TOUCH_LOCK_PX = 12;
const WHEEL_COMMIT_PX = 24;
const WHEEL_COOLDOWN_MS = 340;

function positiveModulo(value: number, length: number) {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

export function SquareStackDeck({ items, label, className, onOpen }: SquareStackDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [motion, setMotion] = useState<'next' | 'prev' | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const wheelLockedUntilRef = useRef(0);
  const suppressOpenUntilRef = useRef(0);
  const commitTimerRef = useRef<number | null>(null);

  const itemCount = items.length;
  const canGoNext = itemCount > 1 && activeIndex < itemCount - 1;
  const canGoPrev = itemCount > 1 && activeIndex > 0;
  const activeItem = items[activeIndex];

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => () => {
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
  }, []);

  const visibleItems = useMemo(() => {
    return Array.from({ length: Math.min(VISIBLE_LAYERS, itemCount) }, (_, layer) => {
      const itemIndex = positiveModulo(activeIndex + layer, itemCount);
      return { item: items[itemIndex], itemIndex, layer };
    }).filter((entry): entry is { item: SquareStackDeckItem; itemIndex: number; layer: number } => Boolean(entry.item));
  }, [activeIndex, itemCount, items]);

  const commit = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next' && !canGoNext) return;
    if (direction === 'prev' && !canGoPrev) return;
    if (motion) return;

    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
    setMotion(direction);
    commitTimerRef.current = window.setTimeout(() => {
      setActiveIndex((current) => direction === 'next' ? Math.min(current + 1, itemCount - 1) : Math.max(current - 1, 0));
      setMotion(null);
      setDrag(null);
    }, SQUARE_DECK_TRANSITION_MS);
  }, [canGoNext, canGoPrev, itemCount, motion]);

  const openActive = useCallback(() => {
    if (!activeItem || motion || drag?.swiping) return;
    if (window.performance.now() < suppressOpenUntilRef.current) return;
    onOpen?.(activeItem, activeIndex);
  }, [activeIndex, activeItem, drag?.swiping, motion, onOpen]);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (itemCount <= 1 || motion) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (Math.max(absX, absY) < WHEEL_COMMIT_PX) return;

    const axisDelta = absX > absY ? event.deltaX : event.deltaY;
    const direction = axisDelta > 0 ? 'next' : 'prev';

    if ((direction === 'next' && !canGoNext) || (direction === 'prev' && !canGoPrev)) {
      return;
    }

    event.preventDefault();
    const now = window.performance.now();
    if (now < wheelLockedUntilRef.current) return;
    wheelLockedUntilRef.current = now + WHEEL_COOLDOWN_MS;
    commit(direction);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || itemCount <= 1 || motion) return;
    if ((event.target as Element | null)?.closest('[data-deck-control],a,button,input,textarea,select,label')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      swiping: false,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId || drag.pointerType === 'mouse') return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const swiping = drag.swiping || (Math.abs(dx) > TOUCH_LOCK_PX && Math.abs(dx) > Math.abs(dy) * 1.08);
    if (!swiping) return;
    event.preventDefault();
    setDrag({ ...drag, dx, dy, swiping });
  }

  function endTouchDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may already have released the pointer capture.
    }

    const dx = drag.dx;
    const swiping = drag.swiping;
    setDrag(null);
    if (!swiping) return;
    suppressOpenUntilRef.current = window.performance.now() + 260;
    if (dx < -TOUCH_COMMIT_PX) commit('next');
    if (dx > TOUCH_COMMIT_PX) commit('prev');
  }

  function getLayerStyle(layer: number): CSSProperties {
    const pose = getLayerPose(layer);
    let x = pose.x;
    let y = pose.y;
    let scale = pose.scale;
    let rotate = 0;
    let opacity = pose.opacity;

    if (layer === 0 && drag?.swiping) {
      const dragPose = getDragPose(drag.dx);
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
        opacity = exit.opacity;
      } else {
        const nextPose = getLayerPose(Math.max(0, layer - 1));
        x = nextPose.x;
        y = nextPose.y;
        scale = nextPose.scale;
        opacity = nextPose.opacity;
      }
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

  return (
    <section className={className ? `square-stack-deck ${className}` : 'square-stack-deck'} aria-label={label}>
      <div
        className={motion === 'prev' ? 'square-stack-deck__surface is-prev-entering' : 'square-stack-deck__surface'}
        role="button"
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
        onWheel={handleWheel}
      >
        {visibleItems.slice().reverse().map(({ item, itemIndex, layer }) => (
          <article key={`${item.id}-${itemIndex}`} className={layer === 0 ? 'square-stack-deck__layer is-front' : 'square-stack-deck__layer'} style={getLayerStyle(layer)} aria-hidden={layer !== 0}>
            {item.content}
          </article>
        ))}
      </div>

      {itemCount > 1 ? (
        <>
          <button
            type="button"
            data-deck-control="true"
            className="square-stack-deck__control square-stack-deck__control--prev"
            disabled={!canGoPrev || Boolean(motion)}
            onClick={(event) => { event.stopPropagation(); commit('prev'); }}
            aria-label="Previous card"
          >
            <WebIcon name="back" size={18} decorative />
          </button>
          <button
            type="button"
            data-deck-control="true"
            className="square-stack-deck__control square-stack-deck__control--next"
            disabled={!canGoNext || Boolean(motion)}
            onClick={(event) => { event.stopPropagation(); commit('next'); }}
            aria-label="Next card"
          >
            <WebIcon name="arrow-right" size={18} decorative />
          </button>
          <div className="square-stack-deck__dots" aria-label={`Card ${activeIndex + 1} of ${itemCount}`}>
            {items.map((item, index) => <span key={item.id} className={index === activeIndex ? 'is-active' : ''} />)}
          </div>
        </>
      ) : null}
    </section>
  );
}
