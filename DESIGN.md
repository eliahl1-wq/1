# Arenifi product design system

This document is the visual source of truth for the Arenifi frontend. The
product should feel like a compact crypto application built for multiplayer
games: dark, precise, information-dense and recognizably Arenifi.

## Audit summary

The July/August 2026 frontend already contains several strong foundations:
Geist for display text, tabular number utilities, reusable topbar/auth/page
header components, compact game controls and a dark surface hierarchy.

The main inconsistencies found during the refinement audit were:

- Shared components were restyled in multiple later override blocks. Primary
  buttons, the topbar, page shells and several cards each had several competing
  definitions.
- Purple gradients, glow shadows, backdrop blur and oversized radii still
  appeared in older controls and overlays.
- Product pages mixed shared page headers with one-off inline headers and
  spacing. This weakened alignment between Modes, Rewards, Profile, Shop,
  Transactions and Admin.
- Buttons with the same purpose differed in height, label weight, radius and
  text contrast. Disabled and loading states did not always preserve geometry.
- Pregame had a clear functional flow, but its visual hierarchy was split
  across a large preview, nested cards and floating utility links.
- Mobile rules were frequently layered on top of desktop rules. Several
  components relied on one-off overrides rather than deliberate mobile
  composition.
- Gameplay HUDs were compact, but older glow/gradient treatments made them feel
  disconnected from the application shell.

The implementation should migrate existing components toward this system. New
features must not add another late override block when a shared token or
primitive can be updated instead.

## Principles

1. Function first, polish second, decoration last.
2. Use surface contrast and one-pixel separators before shadows.
3. Purple identifies selection and primary action; it is not decoration.
4. Related information stays close together and aligns to a common grid.
5. Numerical values use tabular figures and never cause layout shift.
6. Mobile is composed intentionally; desktop cards are not simply stacked.
7. Motion is short and stateful. Constant motion is reserved for a subtle live
   indicator or a required onboarding cue.

## Tokens

### Color

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--bg` | `#08090b` |
| Primary surface | `--bg-1` | `#0d0f12` |
| Raised surface | `--bg-2` | `#111318` |
| Interactive surface | `--bg-3` | `#16191f` |
| Divider | `--border` | `rgba(255,255,255,.065)` |
| Strong divider | `--border-2` | `rgba(255,255,255,.105)` |
| Primary text | `--text-h` | `rgba(255,255,255,.94)` |
| Body text | `--text` | `rgba(255,255,255,.68)` |
| Secondary text | `--text-2` | `rgba(255,255,255,.50)` |
| Tertiary text | `--text-3` | `rgba(255,255,255,.34)` |
| Primary purple | `--accent` | `#ad98ff` |
| Purple hover | `--accent-hover` | `#baa8ff` |
| On-primary text | `--accent-ink` | `#090a0d` |

Green is reserved for success/profit/live, red for destructive/error, amber for
warnings and orange for game-specific risk/entry information. These semantic
colors must not be used as decorative card themes.

### Typography

- Interface and headings: Geist.
- Numbers and transaction identifiers: Geist Mono.
- Page title: 28–34px desktop, 24–28px mobile.
- Section heading: 14–16px, weight 650–700.
- Control text: 12–14px, weight 600–700.
- Metadata: 10–12px, weight 550–650.
- Uppercase labels use restrained tracking (`.06em` to `.09em`).
- Monetary values, balances, player counts and timers use tabular numerals.

### Spacing and geometry

- Spacing scale: 4, 8, 12, 16, 20, 24, 32 and 48px.
- Control heights: 32px compact, 38px default, 44px touch.
- Radius: 4px small, 6px control, 8px panel, 10px large overlay.
- Pills are reserved for status badges, balances and true segmented controls.
- Page content width: 1120px maximum with 24–28px desktop gutters and 12–16px
  mobile gutters.

## Shared component rules

### Buttons

- Primary: solid light purple, dark text, one subtle border, no glow or
  gradient.
- Secondary: raised dark surface, light text, strong divider.
- Ghost: transparent/dark hover, no decorative shadow.
- Danger: dark red-tinted surface and restrained red border.
- Loading and disabled states preserve width and height.
- Icon and text share the same optical center and use a 6–8px gap.

### Panels and cards

- Default panel: `--bg-1`, one-pixel `--border`, 8px radius, no shadow.
- Raised/interactive panel: `--bg-2`, `--border-2` on hover/focus.
- Use dividers within a panel instead of wrapping every row in a new card.
- Overlay shadows are allowed only for popovers and modals.

### Navigation

- Header height is 52px with a precise bottom divider.
- Active navigation uses stronger text plus a quiet purple surface/underline.
- Deposit is a compact pill-shaped exception, using the primary solid fill.
- Popovers align to their trigger and use the same 6px control radius.

### Product pages

- Use `ProductPageHeader` for title, description and actions.
- Sections start on the same horizontal grid and use 24–32px vertical rhythm.
- Loading, empty and error states reserve enough space to prevent layout shift.

### Pregame

- Decision order is Game → Gamemode → Entry → Play.
- Game discovery stays horizontal and compact; mobile uses horizontal scroll.
- Selected state is unmistakable but restrained.
- The center play surface keeps stable dimensions while selections change.
- Free tickets use the same entry-control geometry as paid amounts.

### HUD

- Persistent HUD surfaces use a dark opaque/translucent fill without backdrop
  blur over the game canvas.
- Borders are one pixel; shadows are minimal.
- Cashout remains discoverable but does not dominate the playfield.
- Touch controls remain at least 44px and respect safe areas.

## Interaction and accessibility

- Standard transition: 150–200ms using `--ease-standard`.
- Hover may change surface/border by one level; avoid large scale effects.
- Keyboard focus uses the shared focus ring and is never removed.
- `prefers-reduced-motion` disables nonessential animation.
- Interactive text and icons meet contrast requirements in every state.
- Long usernames truncate rather than pushing controls out of alignment.

## Responsive checkpoints

The UI is verified at 375, 430, 768, 1024, 1440 and 1920px widths. At each
checkpoint check horizontal overflow, sticky/fixed controls, popover bounds,
safe-area padding, readable numerical columns and stable primary-action size.
