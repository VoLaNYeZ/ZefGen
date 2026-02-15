# ZefGen Sidebar Title Hover Effect — Logic & Requirements

> Target: sidebar title "ZefGen" (see screenshot). This describes the hover animation and the minimal structure you need to recreate it in another project.

## What It Is
- **Font:** default app font (Manrope). Optional: add a custom logo font if you want.
- **Effect:** per‑letter “bubble” on hover using `scaleX` with staggered delay.
- **Usage:** sidebar title / logo word.

## Required Assets
1. **CSS classes**
   - `.logo-wrap`, `.logo-word`, `.logo-word span`

2. **Markup structure**
   - Each letter must be wrapped in its own `<span>`.
   - Each span must have `--char-index` for staggered delay.

## Current Implementation (Summary)
**Logo/hover effect** (from `index.css`):
```css
.logo-wrap {
  user-select: none;
}

.logo-word {
  display: inline-block;
  letter-spacing: 0.04em;
}

.logo-word span {
  display: inline-block;
  transform: scaleX(1);
  transform-origin: center;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes logo-letter-bubble {
  0%   { transform: scaleX(1); }
  55%  { transform: scaleX(1.35); }
  100% { transform: scaleX(1); }
}

.logo-wrap:hover .logo-word span {
  animation: logo-letter-bubble 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--char-index, 0) * 45ms);
}
```

**React markup** (from `App.tsx`):
```tsx
<h1 className="text-2xl font-semibold text-white logo-word select-none">
  {Array.from('ZefGen').map((char, index) => (
    <span key={`${char}-${index}`} style={{ ['--char-index' as any]: index }}>
      {char}
    </span>
  ))}
</h1>
```

## Requirements Checklist (For a New Project)
- [ ] Each character is wrapped in a `<span>`.
- [ ] Each `<span>` has `--char-index` (0..n) for stagger.
- [ ] CSS for `.logo-wrap`, `.logo-word`, `.logo-word span` and `logo-letter-bubble` is present.

## Common Pitfalls
- **No stagger:** If `--char-index` is missing, all letters animate together.
- **No animation:** If `display: inline-block` is missing on spans, transform won’t show.

## Suggested Defaults (Sidebar Title)
- Font size: `text-2xl` (Tailwind) or ~24px.
- Letter spacing: `0.04em`.
- Bubble scale: `1.35` (adjust in keyframes if you want stronger).
- Delay: `45ms` per letter.
- Duration: `620ms` total.

## Status Check for This Repo
✅ CSS present in `index.css`
✅ Markup uses per‑letter spans with `--char-index` in `App.tsx`

So the effect is correctly defined here; you can copy the same structure and assets to the next project.

---

# 6 Variants (Fancy Text)
These are the six variants used in the prototype project.

## Shared Requirements (Important)
- **For variable‑font variants** you must use a **real variable font**.
- Recommended: `@fontsource-variable/roboto-flex`.
- The font family for that package is **"Roboto Flex Variable"**.

**Install**
```
npm install @fontsource-variable/roboto-flex
```

**Import (recommended)**
```ts
// index.tsx
import '@fontsource-variable/roboto-flex/full.css';
```

⚠️ Do not import the same `@fontsource-variable/roboto-flex` CSS in both `index.tsx` and `index.css`
(it can create broken `/assets/files/*.woff2` requests in production).

**Font family**
```css
font-family: "Roboto Flex Variable", "Roboto Flex", sans-serif;
```

## Variant 1 — Letter Swap (Forward)
- Works with any font.
- Swaps each letter once then returns.
- Component: `LetterSwapForward`.

Example:
```tsx
<LetterSwapForward label="ZefGen" className="text-2xl" />
```

## Variant 2 — Letter Swap (PingPong)
- Works with any font.
- Swaps on hover in, returns on hover out.
- Component: `LetterSwapPingPong`.

Example:
```tsx
<LetterSwapPingPong label="ZefGen" staggerFrom="center" className="text-2xl" />
```

## Variant 3 — Variable Font Hover By Random Letter
- **Requires variable font** (`wght`, optionally `slnt`).
- Component: `VariableFontHoverByRandomLetter`.

Example:
```tsx
<VariableFontHoverByRandomLetter
  label="ZefGen"
  fromFontVariationSettings="'wght' 400, 'slnt' 0"
  toFontVariationSettings="'wght' 900, 'slnt' 0"
/>
```

## Variant 4 — Variable Font Cursor Proximity
- **Requires variable font**.
- Component: `VariableFontCursorProximity`.
- Needs `containerRef` and `label` (or children).

Example:
```tsx
const ref = useRef<HTMLDivElement>(null);
<div ref={ref}>
  <VariableFontCursorProximity
    label="ZefGen"
    fromFontVariationSettings="'wght' 400, 'slnt' 0"
    toFontVariationSettings="'wght' 900, 'slnt' -10"
    radius={200}
    falloff="gaussian"
    containerRef={ref}
  />
</div>
```

## Variant 5 — Breathing Text
- **Requires variable font**.
- Component: `BreathingText`.

Example:
```tsx
<BreathingText
  fromFontVariationSettings="'wght' 120, 'slnt' 0"
  toFontVariationSettings="'wght' 850, 'slnt' -8"
>
  ZefGen
</BreathingText>
```

## Variant 6 — Scramble Hover
- Works with any font.
- Component: `ScrambleHover`.

Example:
```tsx
<ScrambleHover text="ZefGen" scrambleSpeed={50} maxIterations={8} />
```

---

# Randomize the Sidebar Title Variant on Each Refresh
You asked for the title to change every refresh. This is a simple client‑side random pick.

## Option A — Randomize across ALL 6 variants
**Use this only if you are using a variable font**.

```tsx
const variants = [
  () => <LetterSwapForward label="ZefGen" />,
  () => <LetterSwapPingPong label="ZefGen" />,
  () => (
    <VariableFontHoverByRandomLetter
      label="ZefGen"
      fromFontVariationSettings="'wght' 400, 'slnt' 0"
      toFontVariationSettings="'wght' 900, 'slnt' 0"
    />
  ),
  () => (
    <VariableFontCursorProximity
      label="ZefGen"
      fromFontVariationSettings="'wght' 400, 'slnt' 0"
      toFontVariationSettings="'wght' 900, 'slnt' -10"
      radius={200}
      falloff="gaussian"
      containerRef={ref}
    />
  ),
  () => (
    <BreathingText
      fromFontVariationSettings="'wght' 120, 'slnt' 0"
      toFontVariationSettings="'wght' 850, 'slnt' -8"
    >
      ZefGen
    </BreathingText>
  ),
  () => <ScrambleHover text="ZefGen" />,
];

const pick = Math.floor(Math.random() * variants.length);
return variants[pick]();
```

## Option B — Randomize only variants that don’t need variable font
If you want to keep a non-variable font (e.g. the default sans).

```tsx
const variants = [
  () => <LetterSwapForward label="ZefGen" className="font-sans" />,
  () => <LetterSwapPingPong label="ZefGen" className="font-sans" />,
  () => <ScrambleHover text="ZefGen" className="font-sans" />,
];
```

## SSR Note (if applicable)
If you render on the server, pick the random variant inside `useEffect` to avoid hydration mismatch.

```
const [variant, setVariant] = useState(0);
useEffect(() => {
  setVariant(Math.floor(Math.random() * variants.length));
}, []);
```

That’s it — now the sidebar title will be different on each refresh.
