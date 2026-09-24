# FitTrack Liquid Navbar Implementation Guide

For the top navigation: **Today / Schedule / Stats / Body**
Implementation: HTML + CSS + JavaScript, with no external libraries required.

## 1. Intended Result

Keep the navigation centered in the header, matching the original FitTrack layout, with the logo on the left and the profile avatar on the right. Use a dark green capsule-shaped navigation bar with a mint green wave rising from its bottom edge beneath the selected item. When another item is selected, the wave moves horizontally, stretches during the transition, and returns to its original shape at the destination. The selected label turns green.

This guide recreates an effect similar to the reference video. It does not contain the video's original source code or simulate real liquid physics. SVG defines the wave shape, and JavaScript controls its movement.

The example uses tabs to switch content within one page. It is suitable for prototyping before integration into the actual dashboard. Workout timers, workout data, and data persistence are outside the scope of this example.

## 2. Effect Structure

The navigation consists of three layers:

1. **Navigation background** — a dark surface with rounded corners.
2. **SVG wave** — absolutely positioned at the bottom, without intercepting clicks.
3. **Tab buttons** — placed above the wave and accepting mouse and keyboard input.

Use a single wave that moves between items, rather than four separate waves. This allows its position to remain continuous during rapid switching.

| Property | Example default |
|---|---|
| Page background | `#101912` |
| Navigation background | `#222c24` |
| Accent color | `#61d88b` |
| Navigation width | Up to `700px` |
| Navigation height | `88px` |
| Resting wave size | `70 × 18px` |
| Movement duration | `460ms` |
| Maximum horizontal stretch | Approximately `1.65` times the resting width |

These values are starting points for tuning, not measurements taken from the video's source code.

## 3. Create the Demo File

Create a new folder and an `index.html` file inside it. Copy all the code from the next section into that file, save it as UTF-8, and open it in a browser. This example does not require npm or downloaded dependencies.

If you use VS Code, you can optionally open the file with Live Server to reload the page automatically when saving changes.

## 4. Complete Example Code

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FitTrack — Liquid Navbar</title>
  <style>
    :root {
      --page: #101912;
      --nav: #222c24;
      --accent: #61d88b;
      --text: #f6faf7;
      --muted: #a5b5a9;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background: radial-gradient(ellipse at top right, #203b2a, transparent 60%), var(--page);
      font-family: Arial, sans-serif;
    }
    button { font: inherit; }
    .site-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 700px) minmax(0, 1fr);
      align-items: center;
      gap: 24px;
      padding: 22px 40px;
      border-bottom: 1px solid #ffffff14;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 18px;
      font-size: 30px;
      font-weight: 700;
      white-space: nowrap;
    }
    .brand-mark {
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      border-radius: 15px;
      background: var(--accent);
    }
    .profile {
      justify-self: end;
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #dce9ff;
      color: #2659a8;
      font-weight: 700;
    }
    .liquid-nav {
      position: relative;
      isolation: isolate;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      width: 100%;
      height: 88px;
      padding: 0 12px;
      border-radius: 28px;
      background: var(--nav);
      overflow: hidden;
    }
    .nav-tab {
      position: relative;
      z-index: 2;
      min-width: 0;
      padding: 0 8px 6px;
      border: 0;
      background: transparent;
      color: var(--text);
      cursor: pointer;
      font-size: clamp(18px, 2vw, 30px);
      font-weight: 700;
      transition: color 180ms ease;
    }
    .nav-tab:hover { color: #c5f8d6; }
    .nav-tab[aria-selected="true"] { color: var(--accent); }
    .nav-tab:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -8px;
      border-radius: 20px;
    }
    .wave-position {
      position: absolute;
      z-index: 1;
      left: 0;
      bottom: 0;
      width: 70px;
      height: 18px;
      pointer-events: none;
      will-change: transform;
    }
    .wave-shape {
      display: block;
      width: 100%;
      height: 100%;
      fill: var(--accent);
      transform-origin: center bottom;
    }
    main { max-width: 1200px; margin: 48px auto; padding: 0 24px; }
    .panel {
      padding: 32px;
      border: 1px solid #ffffff20;
      border-radius: 24px;
      background: #182019;
    }
    .panel h1 { margin-top: 0; }
    .panel p { color: var(--muted); line-height: 1.7; }
    [hidden] { display: none !important; }
    @media (max-width: 1100px) {
      .site-header { grid-template-columns: 1fr auto; padding: 20px 24px; }
      .brand { grid-column: 1; grid-row: 1; }
      .profile { grid-column: 2; grid-row: 1; }
      .liquid-nav {
        grid-column: 1 / -1;
        grid-row: 2;
        max-width: 700px;
        justify-self: center;
      }
    }
    @media (max-width: 480px) {
      .site-header { padding: 16px; gap: 16px; }
      .brand { font-size: 24px; }
      .brand-mark, .profile { width: 44px; height: 44px; }
      .liquid-nav { height: 68px; padding: 0 4px; border-radius: 22px; }
      .nav-tab { font-size: 15px; padding-inline: 2px; }
      .wave-position { width: 52px; height: 13px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .nav-tab { transition: none; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span>FitTrack</div>

    <div class="liquid-nav" role="tablist" aria-label="FitTrack dashboard">
      <button class="nav-tab" id="tab-today" role="tab"
        aria-selected="true" aria-controls="panel-today" tabindex="0">Today</button>
      <button class="nav-tab" id="tab-schedule" role="tab"
        aria-selected="false" aria-controls="panel-schedule" tabindex="-1">Schedule</button>
      <button class="nav-tab" id="tab-stats" role="tab"
        aria-selected="false" aria-controls="panel-stats" tabindex="-1">Stats</button>
      <button class="nav-tab" id="tab-body" role="tab"
        aria-selected="false" aria-controls="panel-body" tabindex="-1">Body</button>
      <span class="wave-position" aria-hidden="true">
        <svg class="wave-shape" viewBox="0 0 100 24" preserveAspectRatio="none">
          <path d="M0 24 C18 24 23 0 50 0 C77 0 82 24 100 24 Z"/>
        </svg>
      </span>
    </div>

    <div class="profile" role="img" aria-label="Example profile avatar">KT</div>
  </header>

  <main>
    <section class="panel" id="panel-today" role="tabpanel" aria-labelledby="tab-today" tabindex="0">
      <h1>Today — Upper A</h1><p>Place today's workout list and timer here.</p>
    </section>
    <section class="panel" id="panel-schedule" role="tabpanel" aria-labelledby="tab-schedule" tabindex="0" hidden>
      <h1>Schedule</h1><p>Place the weekly workout schedule here.</p>
    </section>
    <section class="panel" id="panel-stats" role="tabpanel" aria-labelledby="tab-stats" tabindex="0" hidden>
      <h1>Stats</h1><p>Place statistics and progress charts here.</p>
    </section>
    <section class="panel" id="panel-body" role="tabpanel" aria-labelledby="tab-body" tabindex="0" hidden>
      <h1>Body</h1><p>Place body weight and measurement data here.</p>
    </section>
  </main>

  <script>
    const nav = document.querySelector('.liquid-nav');
    const tabs = [...nav.querySelectorAll('.nav-tab')];
    const wave = nav.querySelector('.wave-position');
    const shape = nav.querySelector('.wave-shape');
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const duration = 460;
    let activeIndex = 0;
    let currentX = 0;
    let frameId = null;

    function targetX(index) {
      const tab = tabs[index];
      // offsetLeft/offsetWidth describe layout within nav, the positioned parent.
      return tab.offsetLeft + tab.offsetWidth / 2 - wave.offsetWidth / 2;
    }

    function draw(x, stretch = 1, height = 1) {
      currentX = x;
      wave.style.transform = `translateX(${x}px)`;
      shape.style.transform = `scale(${stretch}, ${height})`;
    }

    function moveWave(index, animate = true) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      const destination = targetX(index);
      if (!animate || reducedMotion.matches) {
        draw(destination);
        return;
      }
      const origin = currentX;
      const distance = destination - origin;
      const amplitude = Math.min(Math.abs(distance) / 260, 0.65);
      const startedAt = performance.now();

      function tick(now) {
        const t = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const bulge = Math.sin(Math.PI * t);
        draw(origin + distance * eased, 1 + amplitude * bulge, 1 - 0.2 * bulge);
        if (t < 1) frameId = requestAnimationFrame(tick);
        else { draw(destination); frameId = null; }
      }
      frameId = requestAnimationFrame(tick);
    }

    function activate(index, focus = false) {
      activeIndex = index;
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[i].hidden = !selected;
      });
      if (focus) tabs[index].focus();
      moveWave(index);
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index));
      tab.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(next, true);
      });
    });

    // Resizing and font loading can change button positions, so measure again.
    const observer = new ResizeObserver(() => moveWave(activeIndex, false));
    observer.observe(nav);
    tabs.forEach(tab => observer.observe(tab));
    document.fonts.ready.then(() => moveWave(activeIndex, false));
    reducedMotion.addEventListener('change', () => moveWave(activeIndex, false));
    moveWave(activeIndex, false);
  </script>
</body>
</html>
```

## 5. Important CSS Details

### 5.1 The Wave's Positioning Context

Set `position: relative` on `.liquid-nav` so the absolutely positioned wave is located relative to the navigation bar rather than the entire page.

`overflow: hidden` clips any part of the wave extending beyond the capsule. `isolation: isolate` keeps its internal stacking order separate from surrounding elements. If you add a thick border to the navigation, recheck the wave alignment.

### 5.2 Separate Movement from Stretching

`.wave-position` receives `translateX()`, while `.wave-shape` receives `scale()`. Applying these transforms to separate elements prevents one transform from overwriting the other.

`pointer-events: none` prevents the wave from blocking button clicks. `aria-hidden="true"` tells assistive technology to ignore this decorative element.

### 5.3 The Wave Shape

The SVG uses a `100 × 24` coordinate space. Its path starts at the bottom-left corner, curves upward to a central peak, curves downward to the right, and closes with `Z`. This creates a small rounded crest rising from the bottom edge.

To make the wave taller, increase the CSS `height` of `.wave-position`. To widen its base, increase its `width`. You do not need to edit the path for every size adjustment.

## 6. How the Animation Works

The horizontal position is calculated as follows:

```text
Wave left position = Button left position + Half the button width − Half the wave width
```

This centers the wave beneath each button without hardcoding separate coordinates for Today, Schedule, Stats, and Body.

JavaScript uses `requestAnimationFrame` to update the position based on elapsed time. The value `t` increases from 0 to 1 over 460 milliseconds. Timing is not based on a fixed frame count, so the intended duration remains consistent across display refresh rates.

The formula `1 - (1 - t)^3` creates a fast start followed by deceleration near the destination. Meanwhile, `sin(πt)` starts at zero, increases midway, and returns to zero. It temporarily increases the wave's width and reduces its height to suggest liquid movement.

If the user selects another item before the previous animation finishes, the previous frame request is canceled and movement starts from the latest `currentX`. The wave therefore does not jump back to the previous tab. Its shape may change slightly when interrupted: this example preserves position continuity, but does not preserve velocity and deformation as a complete spring simulation would.

## 7. Integrate It into the Existing FitTrack Page

1. Back up the existing header and CSS files.
2. Locate the container holding Today / Schedule / Stats / Body.
3. Replace that container and its buttons with the example's `.liquid-nav` markup.
4. Remove the background or pseudo-element used for the original dark active highlight on Today, so it does not overlap the wave.
5. Copy the CSS for `.liquid-nav`, `.nav-tab`, `.wave-position`, and `.wave-shape`, including the relevant responsive and reduced-motion rules.
6. Keep the existing logo and profile elements. Use the example's header CSS only if you want to change their layout.
7. Place the JavaScript after the markup, or load an external JavaScript file with `defer`.
8. Connect each tab to its actual content. Match `aria-controls` to the panel's `id`, and match `aria-labelledby` to the button's `id`.
9. Check that existing event listeners do not duplicate the active-state updates performed by `activate()`.
10. Click every tab and resize the window before integrating it into the main page.

To separate the files, move the contents of `<style>` into `liquid-navbar.css` and the contents of `<script>` into `liquid-navbar.js`. Link them as follows:

```html
<link rel="stylesheet" href="./liquid-navbar.css">
<script src="./liquid-navbar.js" defer></script>
```

Do not include the surrounding `<style>` or `<script>` tags inside the `.css` or `.js` files.

## 8. When Each Item Has a Separate URL

The complete example uses tabs within one page. If Today, Schedule, Stats, and Body lead to separate URLs, replace the buttons with `<a href="...">` links inside `<nav aria-label="Main navigation">`. Use `aria-current="page"` on the current link instead of `role="tab"` and `aria-selected`.

Changing to links also requires JavaScript changes: remove panel visibility management and tab-specific arrow-key handling. Derive the active item from the URL or router, rather than clicks alone. Do not simply change the HTML tag and retain the entire script unchanged.

On a traditional website that reloads the whole document, the navigation is recreated on each page load, so movement cannot remain continuous across pages as it does in this demo. In a single-page application, keep the header in the shared layout and update only the content below it. Do not delay navigation just to force the animation to finish.

## 9. Using React or Next.js

Apply the same visual approach, but adapt DOM management to the framework:

- Store the selected item in state, or derive it from the router.
- Use refs for the navigation, buttons, and SVG instead of querying the entire document.
- Measure positions after the DOM is ready, then call `moveWave` when the selection or dimensions change.
- Store the animation frame ID and `currentX` in refs to avoid rendering the component every frame.
- Cancel pending animation frames and disconnect the `ResizeObserver` when the component unmounts.
- Remove the `matchMedia` event listener when the component unmounts.
- With the Next.js App Router, place DOM-dependent behavior inside a Client Component.

Do not execute the entire example script on every render, as that would duplicate listeners and observers. This guide provides a complete Vanilla JavaScript example; this section is migration guidance, not a ready-made React or Next.js component.

## 10. Adjusting Style and Timing

| Adjustment | Setting to change | Example |
|---|---|---|
| Wave and active label color | `--accent` | `#61d88b` |
| Navigation background | `--nav` | `#222c24` |
| Overall width | Header's middle column and the media query's max-width | `700px` → `620px` |
| Navigation height | `.liquid-nav` height | `88px` → `76px` |
| Wave width | `.wave-position` width | `70px` → `82px` |
| Wave height | `.wave-position` height | `18px` → `14px` |
| Movement speed | JavaScript `duration` | `460` → `350` |
| Stretch intensity | Maximum `amplitude` | `0.65` → `0.35` |
| Vertical compression | `0.2 * bulge` | Reduce to `0.1 * bulge` |

Start with a wave height of 14–18px to keep it clear of the labels. Recheck the space below the text whenever changing the font or navigation height. Avoid excessive stretching that makes the wave span several items at once.

## 11. Keyboard Support and Reduced Motion

The example supports Tab to enter the tab list, Left/Right Arrow to switch tabs, Home/End to select the first/last tab, and Enter/Space through standard button behavior.

Only the selected tab is in the Tab sequence; the other tabs are reached using arrow keys. This interaction is intended for tabs that switch content within a page, and should not be applied indiscriminately to navigation links.

When the user enables reduced motion (`prefers-reduced-motion: reduce`), the wave moves to its destination immediately without stretching. The active item remains identifiable through its color and the wave indicator.

## 12. Verification Checklist

- [ ] On initial load, the wave appears beneath Today without animating from the left edge.
- [ ] Selecting Today → Schedule → Stats → Body centers the wave beneath each button.
- [ ] Selecting Body → Today correctly reverses the movement direction.
- [ ] Rapid clicks leave the wave beneath the most recently selected item.
- [ ] Visible content and `aria-selected` match the selected tab.
- [ ] At viewport widths of 1440, 1024, 768, and 375px, labels do not overlap.
- [ ] Navigation remains usable at 200% browser zoom.
- [ ] Tab, arrow keys, Home, and End work, with a visible focus indicator.
- [ ] Reduced motion disables sliding and stretching.
- [ ] The target browsers show no Console errors.
- [ ] Wave movement does not cause layout shifts.
- [ ] Framework integration does not duplicate listeners or observers after navigating away and back.

## 13. Troubleshooting

| Symptom | Possible cause | Fix |
|---|---|---|
| Wave does not align with the label | Hardcoded coordinates or an incorrect positioned parent | Check the nav's `position: relative` and calculate the button center |
| Wave is invisible | Overridden CSS or missing SVG fill | Check its color, dimensions, z-index, and bottom position |
| Buttons cannot be clicked | Decorative layer intercepts input | Apply `pointer-events: none` to the wave |
| Two active highlights appear | Original dark highlight remains | Remove the previous active background rule or override it as transparent |
| Clicking causes a null error | JavaScript loads before HTML, or IDs do not match | Use `defer` and verify `aria-controls` against panel IDs |
| Wave is misaligned after fonts load | Position is not measured again | Use `document.fonts.ready` and `ResizeObserver` |
| Labels are crowded on mobile | Desktop sizing is used at all widths | Reduce font size/padding and move navigation to a second header row |
| Wave jumps when changing pages | Header is recreated | Use a persistent shared layout in a single-page application |

## 14. Scope and Verification Status

This document provides a starting implementation for adaptation to the actual project. It has not been integrated with FitTrack's source code or visually verified across browsers. Use the checklist above before production use.

The implementation uses standard Web APIs and does not depend on a particular animation library version. To match the reference more closely, begin by tuning the wave's width, height, and movement duration before adding other effects.
