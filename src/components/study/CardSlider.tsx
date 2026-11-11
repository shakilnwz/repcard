import { useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'
import { FlashcardView, type FrontHint } from './FlashcardView'

export type SlideDirection = 'left-to-right' | 'right-to-left'

interface CardSliderProps {
  currentCard: FlashcardItem;
  nextCard: FlashcardItem | null;
  currentProgress: LocalCardProgress | null;
  nextProgress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip: () => void;
  onToggleBookmark: () => void;
  /** Swipe released past the threshold. Return false to reject it (the card springs back). */
  onSwipeAdvance: (direction: SlideDirection) => boolean;
  frontHint?: FrontHint;
  /** Direction of the in-flight slide (from a swipe, rating button or key), or null when idle. */
  slide: SlideDirection | null;
  /** The outgoing card has fully left: the parent should now swap in the next card. */
  onSlideComplete: () => void;
  currentCardIndexLabel: string;
  nextCardIndexLabel: string;
}

/*
 * Rotary track. A card's pose is a pure function of its track position `p`:
 * 0 = resting, +1 = one card-width to the right, -1 = one card-width to the left.
 * The incoming card always trails exactly one slot behind the current one, so the
 * pair moves as a single rigid wheel — while dragging, on release, and on button slides.
 */
const ROTATE_DEG = 8
const DROP_PX = 16
const SLIDE_MS = 300
const MIN_SLIDE_MS = 160
const SNAP_BACK_MS = 220
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const AXIS_LOCK_PX = 6
const COMMIT_PX = 60
const FLICK_PX = 35
const FLICK_MS = 260
const TAP_PX = 8
const TAP_MS = 350

interface Slots {
  current: HTMLDivElement | null;
  incoming: HTMLDivElement | null;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  width: number;
  dragging: boolean;
}

const poseAt = (p: number) =>
  `translate3d(${p * 100}%, ${Math.abs(p) * DROP_PX}px, 0) rotate(${p * ROTATE_DEG}deg)`

/** Pose both cards for track position `p`. At rest the incoming card is hidden. */
function place({ current, incoming }: Slots, p: number) {
  if (current) current.style.transform = p === 0 ? '' : poseAt(p)
  if (incoming) {
    incoming.style.visibility = p === 0 ? 'hidden' : 'visible'
    incoming.style.transform = p === 0 ? '' : poseAt(p - Math.sign(p))
  }
}

/** Glide both cards along the track. The end pose is held until `settle` runs. */
function glide({ current, incoming }: Slots, from: number, to: number, duration: number): Promise<void> {
  const side = Math.sign(to || from)
  if (side === 0) return Promise.resolve()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const timing: KeyframeAnimationOptions = {
    duration: reduceMotion ? 0 : duration,
    easing: EASE_OUT,
    fill: 'forwards',
  }
  const animations: Animation[] = []
  if (current) {
    animations.push(current.animate([{ transform: poseAt(from) }, { transform: poseAt(to) }], timing))
  }
  if (incoming) {
    incoming.style.visibility = 'visible'
    animations.push(incoming.animate([{ transform: poseAt(from - side) }, { transform: poseAt(to - side) }], timing))
  }
  return Promise.all(animations.map((a) => a.finished)).then(() => undefined)
}

/** Release any held animation and put both cards back at rest. */
function settle(slots: Slots) {
  for (const el of [slots.current, slots.incoming]) {
    el?.getAnimations().forEach((a) => a.cancel())
  }
  place(slots, 0)
}

export function CardSlider({
  currentCard,
  nextCard,
  currentProgress,
  nextProgress,
  isFlipped,
  onFlip,
  onToggleBookmark,
  onSwipeAdvance,
  frontHint,
  slide,
  onSlideComplete,
  currentCardIndexLabel,
  nextCardIndexLabel,
}: CardSliderProps) {
  const currentRef = useRef<HTMLDivElement>(null)
  const incomingRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const gestureRef = useRef<Gesture | null>(null)
  const busyRef = useRef(false)
  const runIdRef = useRef(0)
  const completeSlide = useEffectEvent(onSlideComplete)

  const getSlots = (): Slots => ({ current: currentRef.current, incoming: incomingRef.current })

  // A slide continues from wherever the cards are right now (mid-drag or at rest). Once the
  // outgoing card lands, the parent swaps cards and sets `slide` back to null; this effect then
  // resets both slots before the browser paints, so the new card appears exactly where the
  // incoming one landed.
  useLayoutEffect(() => {
    const slots = { current: currentRef.current, incoming: incomingRef.current }
    if (!slide) {
      settle(slots)
      positionRef.current = 0
      busyRef.current = false
      return
    }

    gestureRef.current = null
    busyRef.current = true
    const runId = ++runIdRef.current
    const from = positionRef.current
    const to = slide === 'left-to-right' ? 1 : -1
    positionRef.current = to

    let done = false
    const finish = () => {
      if (done) return
      done = true
      completeSlide()
    }
    const duration = Math.max(MIN_SLIDE_MS, SLIDE_MS * (1 - Math.min(Math.abs(from), 1)))
    glide(slots, from, to, duration).then(
      () => {
        if (runIdRef.current === runId) finish()
      },
      () => {},
    )
    // If the slider unmounts mid-slide, still let the parent commit so it never stays locked.
    return finish
  }, [slide])

  const springBack = () => {
    busyRef.current = true
    const runId = ++runIdRef.current
    const from = positionRef.current
    positionRef.current = 0
    glide(getSlots(), from, 0, SNAP_BACK_MS).then(
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

    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: e.timeStamp,
      width: currentRef.current?.offsetWidth || e.currentTarget.clientWidth || 1,
      dragging: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return

    const deltaX = e.clientX - gesture.startX
    const deltaY = e.clientY - gesture.startY

    if (!gesture.dragging) {
      if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Primarily vertical: leave it to native scrolling
        gestureRef.current = null
        return
      }
      gesture.dragging = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Pointer may already be gone
      }
    }

    const p = Math.min(Math.max(deltaX / gesture.width, -1), 1)
    positionRef.current = p
    place(getSlots(), p)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return
    gestureRef.current = null

    const deltaX = e.clientX - gesture.startX
    const deltaY = e.clientY - gesture.startY
    const elapsed = e.timeStamp - gesture.startTime

    if (!gesture.dragging) {
      if (Math.abs(deltaX) < TAP_PX && Math.abs(deltaY) < TAP_PX && elapsed < TAP_MS) onFlip()
      return
    }

    const isFlick = elapsed < FLICK_MS && Math.abs(deltaX) > FLICK_PX
    if (Math.abs(deltaX) > COMMIT_PX || isFlick) {
      // Moving right (deltaX > 0) is left-to-right; the slide effect picks up from the current pose
      if (onSwipeAdvance(deltaX > 0 ? 'left-to-right' : 'right-to-left')) return
    }
    springBack()
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== e.pointerId) return
    gestureRef.current = null
    if (gesture.dragging) springBack()
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="absolute inset-0 select-none touch-pan-y touch-pinch-zoom"
    >
      {/* Incoming card: always mounted (hidden at rest) so a slide can start from any pose */}
      {nextCard && (
        <div
          ref={incomingRef}
          inert
          aria-hidden="true"
          style={{ visibility: 'hidden' }}
          className="absolute inset-x-0 inset-y-2 origin-[50%_130%] will-change-transform pointer-events-none"
        >
          <FlashcardView
            key={nextCard.id}
            card={nextCard}
            progress={nextProgress}
            isFlipped={false}
            frontHint={frontHint}
            cardIndexLabel={nextCardIndexLabel}
          />
        </div>
      )}

      {/* Current card */}
      <div ref={currentRef} className="absolute inset-x-0 inset-y-2 origin-[50%_130%] will-change-transform">
        <FlashcardView
          key={currentCard.id}
          card={currentCard}
          progress={currentProgress}
          isFlipped={isFlipped}
          onToggleBookmark={onToggleBookmark}
          frontHint={frontHint}
          cardIndexLabel={currentCardIndexLabel}
        />
      </div>
    </div>
  )
}
