import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'
import { ArrowDownward, ArrowUpward } from '@/components/ui/MaterialIcons'
import { FlashcardView } from './FlashcardView'

/**
 * How the current card leaves. Sideways turns the carousel: left-to-right brings in the previous
 * card, right-to-left the next. Up or down flings the card off the deck, uncovering the one behind.
 */
export type SlideDirection = 'left-to-right' | 'right-to-left' | 'up' | 'down'

/** Short captions for the floating arrows, keyed by the direction the finger moves. */
export interface SwipeLabels {
  up: string;
  down: string;
  left: string;
  right: string;
}

/** A card waiting off-stage, ready to slide in. */
export interface NeighborCard {
  card: FlashcardItem;
  progress: LocalCardProgress | null;
  label: string;
}

interface CardSliderProps {
  currentCard: FlashcardItem;
  currentProgress: LocalCardProgress | null;
  currentCardIndexLabel: string;
  /** Waits off the left edge: dragging right (a left-to-right slide) brings it in. */
  prev: NeighborCard | null;
  /** Waits off the right edge: dragging left (a right-to-left slide) brings it in. */
  next: NeighborCard | null;
  /** Waits behind the current card: flinging it up or down uncovers this one. */
  behind: NeighborCard | null;
  isFlipped: boolean;
  onFlip: () => void;
  onToggleBookmark: () => void;
  /** Swipe released past the threshold. Return false to reject it (the card springs back). */
  onSwipe: (direction: SlideDirection) => boolean;
  swipeLabels: SwipeLabels;
  /** Direction of the in-flight slide (from a swipe, rating button or key), or null when idle. */
  slide: SlideDirection | null;
  /** The outgoing card has fully left: the parent should now swap in the card that slid in. */
  onSlideComplete: () => void;
}

/*
 * Two tracks, one per axis. Every card's pose is a pure function of the track position `v`, so
 * all cards move rigidly together — while dragging, on release, and on button/key slides.
 *
 * x (rotary wheel): 0 = resting, +1 = one card-width to the right, -1 = one to the left. The
 *   previous card rides one slot to the left of the current one and the next card one slot to
 *   the right; each is only shown while the wheel has turned toward it.
 * y (fling): 0 = resting, -1 = one viewport-height up, +1 = one down. The card behind grows into
 *   place as the current one clears it.
 */
const ROTATE_DEG = 8
const DROP_PX = 16
const BEHIND_SCALE = 0.92
/** Share of the fling after which the card behind is fully in place */
const REVEAL_AT = 0.5
const SLIDE_MS = 300
const MIN_SLIDE_MS = 160
const SNAP_BACK_MS = 220
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const AXIS_LOCK_PX = 6
const COMMIT_PX = { x: 60, y: 80 }
const FLICK_PX = { x: 35, y: 45 }
const FLICK_MS = 260
const TAP_PX = 8
const TAP_MS = 350
/** How much a guide arrow grows as the drag toward it reaches the commit threshold */
const GUIDE_GROW = 0.2
/** Keyframes per glide: enough to follow the non-linear poses (|v|, the reveal clamp) closely */
const GLIDE_STEPS = 12

type Axis = 'x' | 'y'
type SlotName = 'current' | 'prev' | 'next' | 'behind'
type Slots = Record<SlotName, HTMLDivElement | null>

type Pose = {
  transform: string;
  opacity?: number;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  width: number;
  /** Null until the drag direction is clear */
  axis: Axis | null;
  /** Whether the card body under the finger can still scroll content toward the top / bottom */
  canScrollUp: boolean;
  canScrollDown: boolean;
}

const wheel = (p: number): Pose => ({
  transform: `translate3d(${p * 100}%, ${Math.abs(p) * DROP_PX}px, 0) rotate(${p * ROTATE_DEG}deg)`,
})
const fling = (q: number): Pose => ({ transform: `translate3d(0, ${q * window.innerHeight}px, 0)` })
const rise = (q: number): Pose => {
  const t = Math.min(Math.abs(q) / REVEAL_AT, 1)
  return { transform: `scale(${BEHIND_SCALE + (1 - BEHIND_SCALE) * t})`, opacity: t }
}

function poseOf(slot: SlotName, axis: Axis, v: number): Pose {
  if (axis === 'y') return slot === 'behind' ? rise(v) : fling(v)
  return wheel(slot === 'prev' ? v - 1 : slot === 'next' ? v + 1 : v)
}

function onStage(slot: SlotName, axis: Axis, v: number): boolean {
  switch (slot) {
    case 'current':
      return true
    case 'prev':
      return axis === 'x' && v > 0
    case 'next':
      return axis === 'x' && v < 0
    case 'behind':
      return axis === 'y' && v !== 0
  }
}

const SLOT_NAMES: SlotName[] = ['current', 'prev', 'next', 'behind']

/** Pose every card for track position `v` on `axis`. At rest only the current card shows. */
function place(slots: Slots, axis: Axis, v: number) {
  for (const slot of SLOT_NAMES) {
    const el = slots[slot]
    if (!el) continue
    const shown = onStage(slot, axis, v)
    const pose = shown && !(slot === 'current' && v === 0) ? poseOf(slot, axis, v) : null
    el.style.visibility = shown ? 'visible' : 'hidden'
    el.style.transform = pose?.transform ?? ''
    el.style.opacity = pose?.opacity === undefined ? '' : String(pose.opacity)
  }
}

/** Move every card along the track. The end pose is held until `settle` runs. */
function glide(slots: Slots, axis: Axis, from: number, to: number, duration: number): Promise<void> {
  if (from === to) return Promise.resolve()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const timing: KeyframeAnimationOptions = {
    duration: reduceMotion ? 0 : duration,
    easing: EASE_OUT,
    fill: 'forwards',
  }
  const animations: Animation[] = []
  for (const slot of SLOT_NAMES) {
    const el = slots[slot]
    // A card rides along whenever it is on stage at either end of the move
    if (!el || !(onStage(slot, axis, from) || onStage(slot, axis, to))) continue
    el.style.visibility = 'visible'
    const keyframes = Array.from({ length: GLIDE_STEPS + 1 }, (_, i) =>
      poseOf(slot, axis, from + ((to - from) * i) / GLIDE_STEPS),
    )
    animations.push(el.animate(keyframes, timing))
  }
  return Promise.all(animations.map((a) => a.finished)).then(() => undefined)
}

/** Release any held animation and put every card back at rest. */
function settle(slots: Slots) {
  for (const slot of SLOT_NAMES) {
    slots[slot]?.getAnimations().forEach((a) => a.cancel())
  }
  place(slots, 'x', 0)
}

export function CardSlider({
  currentCard,
  currentProgress,
  currentCardIndexLabel,
  prev,
  next,
  behind,
  isFlipped,
  onFlip,
  onToggleBookmark,
  onSwipe,
  swipeLabels,
  slide,
  onSlideComplete,
}: CardSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)
  const behindRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef<{ axis: Axis; at: number }>({ axis: 'x', at: 0 })
  const gestureRef = useRef<Gesture | null>(null)
  const busyRef = useRef(false)
  const runIdRef = useRef(0)
  const completeSlide = useEffectEvent(onSlideComplete)

  const getSlots = (): Slots => ({
    current: currentRef.current,
    prev: prevRef.current,
    next: nextRef.current,
    behind: behindRef.current,
  })

  // The card is `touch-action: pan-y` so long answers scroll natively, which means the browser
  // would also claim a vertical fling as a scroll and cancel the pointer stream. Pointer events
  // fire before touch events, so by the time a touchmove arrives the drag's axis is decided:
  // cancelling it keeps a claimed vertical drag ours.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onTouchMove = (e: TouchEvent) => {
      if (gestureRef.current?.axis === 'y' && e.cancelable) e.preventDefault()
    }
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => root.removeEventListener('touchmove', onTouchMove)
  }, [])

  // A slide continues from wherever the cards are right now (mid-drag or at rest). Once the
  // outgoing card lands, the parent swaps cards and sets `slide` back to null; this effect then
  // resets every slot before the browser paints, so the new card appears exactly where the
  // incoming one landed.
  useLayoutEffect(() => {
    const slots = {
      current: currentRef.current,
      prev: prevRef.current,
      next: nextRef.current,
      behind: behindRef.current,
    }
    if (!slide) {
      settle(slots)
      positionRef.current = { axis: 'x', at: 0 }
      busyRef.current = false
      return
    }

    gestureRef.current = null
    busyRef.current = true
    const runId = ++runIdRef.current
    const axis: Axis = slide === 'up' || slide === 'down' ? 'y' : 'x'
    const to = slide === 'left-to-right' || slide === 'down' ? 1 : -1
    // A key slide on the other axis mid-drag (rare) starts over from rest
    const sameAxis = positionRef.current.axis === axis
    if (!sameAxis) settle(slots)
    const from = sameAxis ? positionRef.current.at : 0
    positionRef.current = { axis, at: to }

    let done = false
    const finish = () => {
      if (done) return
      done = true
      completeSlide()
    }
    const duration = Math.max(MIN_SLIDE_MS, SLIDE_MS * Math.min(Math.abs(to - from), 1))
    glide(slots, axis, from, to, duration).then(
      () => {
        if (runIdRef.current === runId) finish()
      },
      () => {},
    )
    // If the slider unmounts mid-slide, still let the parent commit so it never stays locked.
    return finish
  }, [slide])

  // The guide is driven straight from the gesture (no re-render per move): it appears once a drag
  // starts, and the arrow being dragged toward grows with the drag (`pull`: 0 at rest, 1 at the
  // commit threshold), then fills once releasing would commit. Only changed values are written.
  const showGuide = (dir: keyof SwipeLabels | null, pull: number) => {
    const guide = guideRef.current
    if (!guide) return
    if (guide.dataset.active !== 'true') guide.dataset.active = 'true'
    guide.querySelectorAll<HTMLElement>('[data-dir]').forEach((arrow) => {
      const toward = arrow.dataset.dir === dir
      const state = !toward ? 'idle' : pull >= 1 ? 'armed' : 'active'
      if (arrow.dataset.state !== state) arrow.dataset.state = state
      const scale = (1 + GUIDE_GROW * (toward ? Math.min(pull, 1) : 0)).toFixed(3)
      if (arrow.style.scale !== scale) arrow.style.scale = scale
    })
  }
  const hideGuide = () => {
    if (guideRef.current) guideRef.current.dataset.active = 'false'
  }

  const springBack = () => {
    busyRef.current = true
    const runId = ++runIdRef.current
    const { axis, at } = positionRef.current
    positionRef.current = { axis, at: 0 }
    glide(getSlots(), axis, at, 0, SNAP_BACK_MS).then(
      () => {
        if (runIdRef.current !== runId) return
        settle(getSlots())
        busyRef.current = false
      },
      () => {},
    )
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // Let interactive controls (bookmark, links) handle their own presses
    if ((e.target as HTMLElement).closest('button, a, input')) return
    if (slide || busyRef.current) return

    // A mouse drag never scrolls, so only touch and pen defer to a scrollable card body
    const scroller =
      e.pointerType === 'mouse' ? null : (e.target as HTMLElement).closest<HTMLElement>('.card-scroll')
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: e.timeStamp,
      width: currentRef.current?.offsetWidth || e.currentTarget.clientWidth || 1,
      axis: null,
      canScrollUp: Boolean(scroller && scroller.scrollTop > 0),
      canScrollDown: Boolean(scroller && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1),
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return

    const deltaX = e.clientX - gesture.startX
    const deltaY = e.clientY - gesture.startY

    if (!gesture.axis) {
      if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical: a long answer scrolls natively until it reaches its end, and only then flings
        if (deltaY < 0 ? gesture.canScrollDown : gesture.canScrollUp) {
          gestureRef.current = null
          return
        }
        gesture.axis = 'y'
      } else {
        gesture.axis = 'x'
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Pointer may already be gone
      }
    }

    const axis = gesture.axis
    const delta = axis === 'x' ? deltaX : deltaY
    const at = Math.min(Math.max(delta / (axis === 'x' ? gesture.width : window.innerHeight), -1), 1)
    positionRef.current = { axis, at }
    place(getSlots(), axis, at)

    const dir = delta === 0 ? null : axis === 'x' ? (delta < 0 ? 'left' : 'right') : delta < 0 ? 'up' : 'down'
    showGuide(dir, Math.abs(delta) / COMMIT_PX[axis])
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return
    gestureRef.current = null

    const deltaX = e.clientX - gesture.startX
    const deltaY = e.clientY - gesture.startY
    const elapsed = e.timeStamp - gesture.startTime

    if (!gesture.axis) {
      if (Math.abs(deltaX) < TAP_PX && Math.abs(deltaY) < TAP_PX && elapsed < TAP_MS) onFlip()
      return
    }

    hideGuide()
    const axis = gesture.axis
    const delta = axis === 'x' ? deltaX : deltaY
    const isFlick = elapsed < FLICK_MS && Math.abs(delta) > FLICK_PX[axis]
    if (Math.abs(delta) > COMMIT_PX[axis] || isFlick) {
      const direction: SlideDirection =
        axis === 'x' ? (delta > 0 ? 'left-to-right' : 'right-to-left') : delta > 0 ? 'down' : 'up'
      // The slide effect picks up from the current pose
      if (onSwipe(direction)) return
    }
    springBack()
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return
    gestureRef.current = null
    if (!gesture.axis) return
    hideGuide()
    springBack()
  }

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="absolute inset-0 select-none touch-pan-y touch-pinch-zoom"
    >
      {/* Off-stage cards: always mounted (hidden at rest) so a slide can start from any pose */}
      {behind && <OffStageSlot ref={behindRef} neighbor={behind} className="origin-center" />}
      {prev && <OffStageSlot ref={prevRef} neighbor={prev} />}
      {next && <OffStageSlot ref={nextRef} neighbor={next} />}

      {/* Current card */}
      <div ref={currentRef} className="absolute inset-x-0 inset-y-2 origin-[50%_130%] will-change-transform">
        <FlashcardView
          key={currentCard.id}
          card={currentCard}
          progress={currentProgress}
          isFlipped={isFlipped}
          onToggleBookmark={onToggleBookmark}
          cardIndexLabel={currentCardIndexLabel}
        />
      </div>

      {/* Swipe guide: arrows pinned to the edges of the app column (not the card), floating above
          everything only while a card is being dragged. Left / right appear only when there is a
          card to browse to. */}
      <div
        ref={guideRef}
        aria-hidden="true"
        data-active="false"
        className="swipe-guide fixed inset-0 z-20 pointer-events-none select-none"
      >
        <div className="relative h-full max-w-lg mx-auto">
          <GuideArrow dir="up" label={swipeLabels.up} />
          <GuideArrow dir="down" label={swipeLabels.down} />
          {next && <GuideArrow dir="left" label={swipeLabels.left} />}
          {prev && <GuideArrow dir="right" label={swipeLabels.right} />}
        </div>
      </div>
    </div>
  )
}

/*
 * Every guide button is the same circle: an arrow with its caption beneath. Left / right are that
 * layout turned a quarter, so the caption still sits under the arrow when read, the arrow facing
 * the screen edge. Inset from the edges by the app's own padding.
 */
const GUIDE_BUTTONS: Record<keyof SwipeLabels, { position: string; turn: string }> = {
  up: { position: 'top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2', turn: '' },
  down: { position: 'bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2', turn: '' },
  left: { position: 'left-[max(1rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2', turn: '-rotate-90' },
  right: { position: 'right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2', turn: 'rotate-90' },
}

function GuideArrow({ dir, label }: { dir: keyof SwipeLabels; label: string }) {
  const { position, turn } = GUIDE_BUTTONS[dir]
  const Icon = dir === 'down' ? ArrowDownward : ArrowUpward
  return (
    <div className={`absolute ${position}`}>
      <div
        data-dir={dir}
        data-state="idle"
        className="swipe-arrow liquid-glass size-12 flex items-center justify-center rounded-full"
      >
        <div className={`flex flex-col items-center gap-0.5 ${turn}`}>
          <Icon className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] leading-none whitespace-nowrap">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

function OffStageSlot({
  ref,
  neighbor,
  className = 'origin-[50%_130%]',
}: {
  ref: React.Ref<HTMLDivElement>;
  neighbor: NeighborCard;
  className?: string;
}) {
  return (
    <div
      ref={ref}
      inert
      aria-hidden="true"
      style={{ visibility: 'hidden' }}
      className={`absolute inset-x-0 inset-y-2 will-change-transform pointer-events-none ${className}`}
    >
      <FlashcardView
        key={neighbor.card.id}
        card={neighbor.card}
        progress={neighbor.progress}
        isFlipped={false}
        cardIndexLabel={neighbor.label}
      />
    </div>
  )
}
