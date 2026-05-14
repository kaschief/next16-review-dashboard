"use client";

import Image from "next/image";
import {
  useCallback,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { updateReviewStatus } from "@/app/actions/reviews";
import {
  STATUS_LABEL,
  type ChannelSource,
  type Review,
  type ReviewStatus,
} from "@/app/types/review";

interface ReviewCardProps {
  review: Review;
}

/**
 * Single review card with an inline status selector.
 *
 * Status is modelled as a two-option radiogroup (Approve / Flag). A radio is
 * the correct semantic for mutually-exclusive selection from a small fixed
 * set, and — critically — it eliminates the "press-to-approve looks identical
 * to is-approved" problem that aria-pressed buttons can't fully solve: a
 * radio is visually and semantically *selected vs. unselected*, not pressed
 * vs. unpressed. "Reset to pending" is offered as an inline Undo link on the
 * consequence row, not as a third button — pending has no consequence and
 * therefore no undo affordance, and the action row's shape never changes.
 *
 * Optimistic state is local — each card owns its own pending status because
 * mutations don't interact across cards. Lifting state up would buy nothing
 * and make the card less reusable.
 */
export function ReviewCard({ review }: ReviewCardProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    review.status,
    (_, next: ReviewStatus) => next,
  );
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<ReviewStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAction = useCallback(
    (next: ReviewStatus) => {
      if (next === optimisticStatus) return; // no-op click guard
      setErrorMessage(null);
      setPendingAction(next);
      startTransition(async () => {
        setOptimisticStatus(next);
        const result = await updateReviewStatus(review.id, next);
        setPendingAction(null);
        if (!result.ok) setErrorMessage(result.error);
        // Success is signalled by the consequence-line transition + badge swap.
      });
    },
    [optimisticStatus, review.id, setOptimisticStatus],
  );

  // The "settling" condition: an action is in flight AND its target is the
  // currently-displayed (optimistic) status. Drives the honest-language flip
  // on both the badge and the consequence line — neither asserts a server-
  // confirmed fact while the server is still confirming.
  const isSettling = pendingAction !== null && pendingAction === optimisticStatus;

  return (
    <article
      aria-labelledby={`review-${review.id}-guest`}
      data-busy={isSettling ? "" : undefined}
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src={review.guestAvatar}
            alt=""
            width={40}
            height={40}
            // Avatars are small and identical-sized; below-the-fold reviews
            // get lazy-loaded by default. No `priority` needed.
            className="h-10 w-10 rounded-full bg-zinc-100 object-cover"
          />
          <div>
            <p
              id={`review-${review.id}-guest`}
              className="font-medium text-zinc-900"
            >
              {review.guestName}
            </p>
            <p className="text-xs text-zinc-500">
              {review.propertyName} · {review.city}
            </p>
          </div>
        </div>

        {/* `key` on the badge forces React to remount it when status changes,
            re-triggering the fade-in animation as a visual confirmation.
            `data-busy` triggers a low-amplitude opacity pulse so the badge
            participates in the in-flight signal, not just the radio. */}
        <StatusBadge
          key={optimisticStatus}
          status={optimisticStatus}
          isSettling={isSettling}
        />
      </header>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <StarRating value={review.rating} />
        <span aria-hidden="true">·</span>
        <span>{CHANNEL_LABEL[review.channelSource]}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={review.createdAt}>
          {formatReviewDate(review.createdAt)}
        </time>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-700">
        {review.text}
      </p>

      <StatusSelector
        reviewId={review.id}
        currentStatus={optimisticStatus}
        pendingAction={pendingAction}
        isPending={isPending}
        onSelect={handleAction}
      />

      {/* Reserved slot — same vertical space whether or not a consequence
          line renders. Prevents the card from jumping between pending (no
          line) and approved/flagged (one line). */}
      <StatusConsequence
        status={optimisticStatus}
        isSettling={isSettling}
        canUndo={optimisticStatus !== "pending" && !isPending}
        onUndo={() => handleAction("pending")}
      />

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200"
        >
          Couldn&apos;t update: {errorMessage}
        </p>
      )}
    </article>
  );
}

// ---- status selector (radiogroup) ------------------------------------------

interface StatusSelectorProps {
  reviewId: number;
  currentStatus: ReviewStatus;
  pendingAction: ReviewStatus | null;
  isPending: boolean;
  onSelect: (next: ReviewStatus) => void;
}

/**
 * Two-option radiogroup: Approve | Flag.
 *
 * - Selected radio renders as a filled, colored chip with a check icon —
 *   reads as "this is the current state", not as a pressable action.
 * - Unselected radio renders as an outlined verb chip ("Approve" / "Flag") —
 *   reads as "click to do this".
 * - When current status is "pending" neither radio is selected; both render
 *   as offers. The row shape (two equal-width chips) never changes.
 *
 * Keyboard model: roving tabindex. Only one radio is in the tab order at a
 * time (the selected one, or the first one when nothing is selected). Arrow
 * keys move focus AND select within the group, matching native radio
 * behaviour. Space/Enter selects the focused option.
 */
function StatusSelector({
  reviewId,
  currentStatus,
  pendingAction,
  isPending,
  onSelect,
}: StatusSelectorProps) {
  const groupId = `review-${reviewId}-status-group`;
  const radioRefs = useRef<Record<RadioValue, HTMLButtonElement | null>>({
    approved: null,
    flagged: null,
  });

  // The tabbable radio: selected one if any, else the first.
  const tabbableValue: RadioValue =
    currentStatus === "approved" || currentStatus === "flagged"
      ? currentStatus
      : "approved";

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const order: RadioValue[] = ["approved", "flagged"];
    const activeEl = document.activeElement as HTMLElement | null;
    const currentIndex = order.findIndex(
      (v) => radioRefs.current[v] === activeEl,
    );
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % order.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + order.length) % order.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = order.length - 1;
        break;
      default:
        return;
    }
    if (nextIndex === null) return;
    e.preventDefault();
    const nextValue = order[nextIndex]!;
    radioRefs.current[nextValue]?.focus();
    onSelect(nextValue);
  }

  return (
    <div
      id={groupId}
      role="radiogroup"
      aria-label="Review status"
      aria-busy={isPending}
      data-busy={isPending ? "" : undefined}
      onKeyDown={handleKeyDown}
      // Right-aligned, intrinsically sized — actions are an inline detail,
      // not a banner. The full-width 2-col grid that lived here previously
      // turned every card into two competing primary CTAs.
      className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3"
    >
      <StatusRadio
        ref={(el) => {
          radioRefs.current.approved = el;
        }}
        value="approved"
        currentStatus={currentStatus}
        pendingAction={pendingAction}
        isPending={isPending}
        tabbable={tabbableValue === "approved"}
        onSelect={onSelect}
      />
      <StatusRadio
        ref={(el) => {
          radioRefs.current.flagged = el;
        }}
        value="flagged"
        currentStatus={currentStatus}
        pendingAction={pendingAction}
        isPending={isPending}
        tabbable={tabbableValue === "flagged"}
        onSelect={onSelect}
      />
    </div>
  );
}

type RadioValue = Exclude<ReviewStatus, "pending">;

interface StatusRadioProps {
  ref: (el: HTMLButtonElement | null) => void;
  value: RadioValue;
  currentStatus: ReviewStatus;
  pendingAction: ReviewStatus | null;
  isPending: boolean;
  tabbable: boolean;
  onSelect: (next: ReviewStatus) => void;
}

function StatusRadio({
  ref,
  value,
  currentStatus,
  pendingAction,
  isPending,
  tabbable,
  onSelect,
}: StatusRadioProps) {
  const isSelected = currentStatus === value;
  const isLoading = pendingAction === value;
  // We don't disable the selected radio — that would make it un-tab-focusable
  // and break the radiogroup. We DO prevent re-selection in the click handler.
  // Disable only happens during in-flight on the *other* radio, to prevent a
  // double-mutation race.
  const isBlocked = isPending && !isLoading && !isSelected;

  const styles = RADIO_STYLES[value][isSelected ? "selected" : "offer"];

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-busy={isLoading}
      aria-label={
        isSelected ? RADIO_SELECTED_ARIA[value] : RADIO_OFFER_ARIA[value]
      }
      tabIndex={tabbable ? 0 : -1}
      disabled={isBlocked}
      onClick={() => {
        if (isSelected) return;
        onSelect(value);
      }}
      className={`inline-flex min-w-[6rem] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {isLoading ? (
        <Spinner />
      ) : isSelected ? (
        <span aria-hidden="true">✓</span>
      ) : null}
      <span>
        {isLoading
          ? RADIO_LOADING_LABEL[value]
          : isSelected
            ? RADIO_SELECTED_LABEL[value]
            : RADIO_OFFER_LABEL[value]}
      </span>
    </button>
  );
}

// ---- status consequence ----------------------------------------------------

interface StatusConsequenceProps {
  status: ReviewStatus;
  isSettling: boolean;
  canUndo: boolean;
  onUndo: () => void;
}

/**
 * Reserves vertical space even for `pending` (no consequence) so the card
 * height does not jump as status changes. Undo lives here, inline, because
 * "undo" is conceptually attached to *what just happened* — not a peer of
 * Approve/Flag in the action row.
 *
 * No icon: the selected radio chip above already carries the ✓ confirmation
 * mark. Duplicating it here added visual noise without adding meaning. Colour
 * + copy (emerald-green "Visible on…" vs rose-red "Escalated…") already
 * disambiguate the two states.
 */
function StatusConsequence({
  status,
  isSettling,
  canUndo,
  onUndo,
}: StatusConsequenceProps) {
  const consequence = STATUS_CONSEQUENCE[status];
  return (
    <div className="mt-3 min-h-[1.25rem]">
      {consequence && (
        <p
          // `key` retriggers the fade-in when status changes, signalling the change.
          // role/aria-live so screen readers announce the new product effect.
          key={status}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`inline-flex animate-fade-in items-center gap-1.5 text-xs ${consequence.className}`}
        >
          <span>
            {isSettling ? consequence.pending : consequence.confirmed}
          </span>
          {canUndo && !isSettling && (
            <>
              <span aria-hidden="true" className="text-zinc-400">
                ·
              </span>
              <button
                type="button"
                onClick={onUndo}
                className="rounded-sm font-medium text-zinc-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
              >
                Undo
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Two labels per status: present-progressive while the server confirms the
 * write, past-tense once settled. The product effect (visible on listing /
 * escalation to ops) is a server-side fact — we only assert it as a fact
 * after the server has actually confirmed.
 */
const STATUS_CONSEQUENCE = {
  pending: null,
  approved: {
    pending: "Publishing to property listing…",
    confirmed: "Visible on property listing",
    className: "text-emerald-700",
  },
  flagged: {
    pending: "Escalating to operations team…",
    confirmed: "Escalated to operations team",
    className: "text-rose-700",
  },
} as const satisfies Record<
  ReviewStatus,
  { pending: string; confirmed: string; className: string } | null
>;

// ---- subcomponents ---------------------------------------------------------

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
        className="opacity-90"
      />
    </svg>
  );
}

function StarRating({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <span
      role="img"
      aria-label={`${value} out of 5 stars`}
      className="font-medium text-amber-500"
    >
      {"★".repeat(value)}
      <span className="text-zinc-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function StatusBadge({
  status,
  isSettling,
}: {
  status: ReviewStatus;
  isSettling: boolean;
}) {
  const styles = STATUS_STYLES[status];
  // Present-progressive while the server confirms; past-tense once settled.
  // Same honesty rule as the consequence line — the badge is the most
  // prominent status surface on the card, so it can't lie even briefly.
  const label = isSettling
    ? STATUS_SETTLING_LABEL[status]
    : STATUS_LABEL[status];
  return (
    <span
      data-busy={isSettling ? "" : undefined}
      className={`inline-flex shrink-0 animate-fade-in items-center rounded-full px-2.5 py-0.5 text-xs font-medium data-[busy]:animate-busy-pulse ${styles}`}
    >
      {label}
    </span>
  );
}

const STATUS_SETTLING_LABEL = {
  pending: "Resetting…",
  approved: "Approving…",
  flagged: "Flagging…",
} as const satisfies Record<ReviewStatus, string>;

// ---- display tokens --------------------------------------------------------

const CHANNEL_LABEL = {
  airbnb: "Airbnb",
  "booking.com": "Booking.com",
  direct: "Direct",
} as const satisfies Record<ChannelSource, string>;

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  flagged: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
} as const satisfies Record<ReviewStatus, string>;

const RADIO_OFFER_LABEL = {
  approved: "Approve",
  flagged: "Flag",
} as const satisfies Record<RadioValue, string>;

const RADIO_SELECTED_LABEL = {
  approved: "Approved",
  flagged: "Flagged",
} as const satisfies Record<RadioValue, string>;

const RADIO_LOADING_LABEL = {
  approved: "Approving…",
  flagged: "Flagging…",
} as const satisfies Record<RadioValue, string>;

const RADIO_OFFER_ARIA = {
  approved: "Approve review",
  flagged: "Flag review",
} as const satisfies Record<RadioValue, string>;

const RADIO_SELECTED_ARIA = {
  approved: "Approved (current status)",
  flagged: "Flagged (current status)",
} as const satisfies Record<RadioValue, string>;

/**
 * Visual treatments by (value, state).
 *
 * Restraint-first design. Neither state shouts at rest. The affordance
 * difference is conveyed by *shape and behaviour* (ring + hover transition
 * + cursor), not by colour saturation. Colour is reserved for the text and
 * the icon — fills stay near-white.
 *
 * `offer`    → white background, colored text (emerald-700 / rose-700),
 *   neutral zinc ring. Hover reveals a faint colored fill that confirms the
 *   intent of the action. Reads as a button because it has button shape and
 *   a colored hover state.
 * `selected` → light tinted pill matching the status badge's own treatment
 *   (`bg-X-50 text-X-800 ring-X-200`). `cursor-default`, no hover. Reads as
 *   "current state, embedded inline" — passive information, not an action.
 *
 * Result: at rest, the card is mostly monochrome. Colour appears in three
 * disciplined places — the status badge, the consequence line, and the
 * coloured text of the action you can take. Hovering reveals intent.
 * Nothing competes for attention until the operator chooses to engage.
 */
const RADIO_STYLES = {
  approved: {
    offer:
      "bg-white text-emerald-700 ring-1 ring-zinc-200 hover:bg-emerald-50 hover:ring-emerald-200",
    selected:
      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 cursor-default",
  },
  flagged: {
    offer:
      "bg-white text-rose-700 ring-1 ring-zinc-200 hover:bg-rose-50 hover:ring-rose-200",
    selected: "bg-rose-50 text-rose-800 ring-1 ring-rose-200 cursor-default",
  },
} as const satisfies Record<RadioValue, { selected: string; offer: string }>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatReviewDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}
