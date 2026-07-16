# UI/UX Design Guidelines

This is the authoritative UI/UX reference for FISH. Use it when planning,
designing, implementing, reviewing, or testing any user-facing surface.

FISH is a calm coaching hub for neurodivergent professionals, including many
people with ADHD, who are learning English with a coach. The interface exists
to remove choices, preserve focus, and make the next useful action obvious.
Visual quality matters because hierarchy and readability affect usability, but
decoration never outranks the task.

## How to use this guide

- "Must" and "never" are release requirements.
- "Should" is the default. Deviations need a user, accessibility, or
  task-specific reason recorded in the change.
- "May" describes an allowed option, not a requirement.
- Every recommendation ends with a source citation. Multiple citations show
  where duplicate guidance was merged.
- PDF page numbers are the physical pages shown by a PDF viewer. This matters
  for DFD, whose physical pages contain two printed book pages.

### Precedence

When guidance conflicts, apply it in this order:

1. FISH product rules in AGENTS.md and PRODUCT.md.
2. The implemented system in DESIGN.md, apps/web/app/globals.css, and the
   shared components in apps/web/components/ui/.
3. The resolved decisions in this document.
4. Generic advice from the source PDFs.

Generic advice is evidence, not permission to add complexity. In particular,
examples of plan galleries, pricing choices, streaks, red error treatments,
decorative dashboards, or multiple calls to action do not override FISH's
assigned-work model. Source: PROJECT, AGENTS.md, "The product rule that governs
everything" and "Design rules"; NB pp. 174-185, "Laws of UX".

### Required preflight for any user-facing change

Before designing or changing a screen:

1. Confirm the user's role and single task.
2. Confirm any learning technique has been validated manually by a coach.
3. Identify the one primary action.
4. Remove information, choices, and controls that are not needed now.
5. Define default, focus, loading, success, empty, error, disabled, long-copy,
   and narrow-screen behavior.
6. Reuse tokens and shared components before adding anything.
7. Test keyboard, touch, contrast, reduced motion, zoom, and realistic content.

Source: PROJECT, AGENTS.md, "Coach-first, code-second", "Design rules", and
"Code conventions"; NB pp. 49-51, 123-125, 174-185; DUI pp. 475-495, "UI
Audit".

## Source register and coverage

Every PDF in /Users/franz/Desktop/uiux/ was scanned. Image-only pages were
OCR'd and visually spot-checked. The keys below are used by citations
throughout this document.

| Key | Source file | Pages | Guidance incorporated |
| --- | --- | ---: | --- |
| DUI | Designing_User_Interfaces_EN_2024_FINAL.pdf.pdf | 578 | UI/UX foundations; screens; grids; objects; color; typography; icons; hierarchy; buttons; cards; data; forms; overlays; navigation; motion; media; language; design systems; audits |
| NB | noBullshit_2025.pdf | 231 | UX process; IA; task decomposition; research; user flows; heuristics; UX laws; dark patterns; testing |
| STYLE | ui-styles-2024.pdf | 202 | Modern minimal, flat, dark, neumorphic, glass, aurora, clay, brutalist, and spatial styles; accessibility risks |
| DFD | dark-version-updated.pdf, titled "Design for Developers" | 220 | Color; typography; component anatomy and states; hierarchy; spacing; forms; data; design systems |
| TIPS | UI-design-tips.pdf | 81 | 70 actionable interface comparisons covering forms, tables, loading, empty states, dialogs, controls, and dark mode |
| DUCK | ducking-designers-guide.pdf | 49 | Constrained color, type, icon, spacing, and hierarchy rules |
| FORM | +100 slides on HTML & CSS Best practices/html_forms_best_practices.pdf | 16 | Semantic, accessible forms and input attributes |
| SELECTOR | +100 slides on HTML & CSS Best practices/css_selector_best_practices.pdf | 6 | Selector intent, reuse, location independence, and specificity |
| CSS5 | +100 slides on HTML & CSS Best practices/five_css_mistakes_to_avoid.pdf | 6 | Magic values, component independence, selector quality, relative line height, naming |
| CSSORG | +100 slides on HTML & CSS Best practices/how_to_organize_your_css_codebase.pdf | 9 | Separation of base, component, layout, utility, vendor, and page concerns |
| BEM | +100 slides on HTML & CSS Best practices/how_to_properly_name_css_classes.pdf | 9 | Blocks, elements, modifiers, and reusable component intent |
| CSSBP | +100 slides on HTML & CSS Best practices/twitter_best_practices_css.pdf | 15 | CSS readability, declaration order, comments, naming, selector and media-query practices |
| HTMLR | +100 slides on HTML & CSS Best practices/html_learning_roadmap.pdf | 7 | Semantic structure, links, images, forms, events, and browser APIs |
| SEMREAL | +100 slides on HTML & CSS Best practices/real_world_examples_of_semantic_html.pdf | 5 | Real-world landmark, article, aside, form, list, time, and disclosure structure |
| SEMUSE | +100 slides on HTML & CSS Best practices/semantic_html_use_cases.pdf | 9 | Landmark meanings; anchor versus button; figure versus image |
| HTML7 | +100 slides on HTML & CSS Best practices/seven_common_html_mistakes.pdf | 8 | Semantic elements, figure, inline/block hierarchy, emphasis, inline styles, focus, descriptive links |
| IMG | +100 slides on HTML & CSS Best practices/web_images_best_practices.pdf | 8 | Content versus decorative images, formats, responsive delivery, CDNs, and lazy loading |
| PROJECT | AGENTS.md, PRODUCT.md, DESIGN.md, apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/components/ui/ | n/a | Product precedence, tokens, fonts, components, implementation constraints, and current FISH decisions |

## Design principles and philosophy

### Remove choices

- Every view must make one next useful action obvious. A view may have at most
  one primary button. Secondary, ghost, or text actions must be visibly quieter.
  Source: PROJECT, AGENTS.md, "One primary action per screen"; DUI pp. 240-245;
  TIPS pp. 7, 68; DUCK pp. 13-14.
- Clients must receive assigned work. They must not browse plan galleries,
  template menus, skill levels, difficulty pickers, or alternative learning
  paths. Coaches may use management tools only when those choices are necessary
  for coaching work. Source: PROJECT, AGENTS.md, "Assigned, never chosen".
- Ask only for information that cannot be inferred, prefilled, assigned,
  postponed, or safely removed. Fewer fields and choices reduce cognitive load
  and improve completion. Source: NB pp. 174, 179-180, 185; DUI pp. 331,
  358-361; TIPS pp. 11-12.
- Progressive disclosure is allowed only when it removes nonessential detail
  without hiding context or information required to complete the task. Source:
  NB pp. 145-147; DUI pp. 374, 378-379; DFD PDF pp. 99-100.

### Coach-first, code-second

- Do not productize a learning exercise, community feature, gamification
  mechanic, or coaching technique until a coach has demonstrated that it works
  manually with a real client. Source: PROJECT, AGENTS.md, "The product rule
  that governs everything".
- Build foundations before learning mechanics: auth and roles, client profiles,
  one-to-one chat, then the shared UI kit. Source: PROJECT, AGENTS.md, "Build
  order".
- Reward returning. Never reset a streak to zero, shame a gap, or present
  progress as a grade. Source: PROJECT, AGENTS.md, "Progress is visual" and
  "Gamification is reward-only".

### One task at a time

- Keep one logical category of information per screen or step. Separate
  unrelated tasks even when doing so adds a step. The goal is low cognitive
  load, not an arbitrary click count. Source: NB pp. 49-51, "The rule of
  clicks"; NB p. 179, "Reduce complexity".
- Structure a focused screen as context, clarification, then action. The action
  normally appears after the information needed to take it. Source: NB p. 166,
  "Hierarchy strips"; DUI pp. 219-225; DUCK pp. 31-34.
- Keep only elements that contribute to the task. Ask what can be removed
  without losing function before adding decoration. Source: NB pp. 146,
  180-181; DUI pp. 30-43; STYLE pp. 5-16.

### Familiar, calm, and ethical

- Prefer established patterns for registration, forms, navigation, dialogs,
  and data. Novelty is justified only when a familiar pattern cannot serve the
  user's task. Source: NB pp. 143-145, 175; DFD PDF pp. 152-158; DUI pp.
  30-43.
- Hierarchy, spacing, plain language, and familiar controls must do the work
  before color, imagery, effects, or motion. Source: DUI pp. 219-225; DUCK pp.
  25-34; DFD PDF pp. 114-174.
- Aesthetics support trust and perceived usability, but never at the cost of
  readability, accessibility, speed, or task clarity. Source: NB p. 181; TIPS
  p. 33; STYLE pp. 5-16, 89-106.
- Never implement deceptive patterns: hidden costs, fake scarcity, difficult
  cancellation, confirmshaming, trick questions, unsolicited contact import,
  disguised ads, bait-and-switch, or misdirection. Source: NB pp. 186-197,
  "Types of dark patterns".

### Design, test, refine

- Use the smallest process that answers the actual question: understand the
  problem, propose a solution, test it, refine it, and repeat. Process artifacts
  are tools, not deliverables by default. Source: NB pp. 6, 17, 62-70,
  216-226.
- Prefer conversations with real target users, competitive analysis, usage
  evidence, and one-to-one usability checks over invented personas or process
  theater. Source: NB pp. 71-79, 94-125, 217-226.
- Use mid- or high-fidelity prototypes for usability tests when visual
  perception affects the result. Test coded HTML when interaction fidelity
  matters. Source: NB pp. 123-125, 226.
- Use heuristic review to check system status, real-world language, user
  control, consistency, error prevention, recognition, efficiency,
  minimalism, recovery, and help before usability testing. Source: NB pp.
  141-147.
- Use analytics, session recordings, surveys, and A/B tests to identify or
  compare behavior, not to replace human explanation. Never use an A/B result
  to justify deception or user harm. Source: NB pp. 128-133, 223-226.
- Validate on the real device and viewport. A screenshot in a design tool is
  not enough to judge text size, touch reach, browser behavior, or input
  keyboards. Source: NB pp. 220-222; DUI pp. 58-66.

## Information architecture

### Build from purpose to surface

- Define strategy first: identify the user need and the product need, and work
  at their intersection. For FISH, user focus and coach effectiveness outrank
  feature breadth. Source: NB pp. 24-26, "Strategy"; PROJECT, PRODUCT.md,
  "Product Purpose".
- Define scope as the smallest set of capabilities needed to satisfy that
  strategy. Treat later feature ideas as out of scope until validated. Source:
  NB p. 27, "Scope"; PROJECT, AGENTS.md, "Coach-first, code-second".
- Define structure before screens: map the pages, state transitions, user
  actions, system responses, errors, and recovery paths. Include actual content
  and fields in the flow when that removes ambiguity. Source: NB p. 28,
  "Structure".
- Use a skeleton or wireframe only when it helps align a complex or unclear
  flow. Familiar, well-defined patterns may move from a clear flow directly to
  higher fidelity. Source: NB pp. 29, 104-108; DFD PDF pp. 175-180.
- Treat the surface as behavior as well as appearance. It includes component
  states, transitions, microcopy, motion, and implementation fidelity. Source:
  NB p. 30, "Surface"; DUI pp. 401-438.

### Role-based architecture

- Client IA must center on the assigned next step, one-to-one coach context,
  progress, and the minimum profile/account functions. Do not expose coaching
  administration or a content catalog. Source: PROJECT, PRODUCT.md, "Users";
  PROJECT, AGENTS.md, "Assigned, never chosen".
- Coach IA may include client lists, assignment controls, filters, history, and
  status because those are required management tasks. Keep each management
  view focused and do not copy its density into client views. Source: PROJECT,
  PRODUCT.md, "Users"; DUI pp. 295-310, "Tables and Graphs".
- Keep role vocabulary, destinations, and permissions explicit. Never rely on
  hiding a control as the only authorization boundary. Source: PROJECT,
  AGENTS.md, "API boundary"; NB pp. 142-145.

### Flows and grouping

- Diagram the core value flow first, then supporting flows. Do not spend equal
  effort diagramming familiar registration or settings patterns unless FISH
  changes them materially. Source: NB pp. 163-164, 219.
- Shorten flows by removing unnecessary steps, not by merging unrelated tasks
  onto one screen. Source: NB p. 164; NB pp. 49-51.
- Group by the user's mental task: account creation, profile details, coach
  communication, assigned work, and account settings should remain distinct
  unless the task truly requires them together. Source: NB pp. 50, 179; DUI
  pp. 219-225.
- Put related objects close together and create a clearly larger gap before a
  new group. Proximity is semantic, not cosmetic. Source: DUI pp. 219-225;
  DUCK pp. 31-34; DFD PDF pp. 142-147; TIPS p. 73.
- Prefer recognition over recall. Keep labels, current state, and required
  context visible; do not make users remember what a field or hidden action
  means. Source: NB p. 145; TIPS pp. 59-60.
- Include every meaningful state in the architecture: first use, normal,
  loading, partial data, empty, offline, permission denied, validation error,
  server error, success, and retry. Source: NB pp. 142-147; DUI pp. 311-381.

### Labels, search, and help

- Name destinations with plain, user-recognizable nouns and actions with
  specific verbs. IA labels must match the words used in headings, buttons,
  notifications, and help. Source: NB pp. 58-60, 143-147; DUI pp. 431-438.
- Use search, sorting, or filtering only where the information set is too large
  for calm direct navigation. Long option lists should support typing. Source:
  TIPS pp. 41, 61-62; DUI pp. 295-310, 340-350.
- Make help unnecessary for routine tasks through clear UI, then provide
  searchable, categorized, step-by-step help for genuinely complex work.
  Source: NB p. 147.
- Do not use card sorting by default. Established patterns plus usability
  evidence are usually sufficient; use card sorting only when the category
  model is genuinely unknown. Source: NB pp. 139-140.

## Navigation patterns

- Start with visible navigation. Hidden navigation increases recall demands
  and discoverability risk. Source: DUI pp. 382-400; DFD PDF pp. 102-105.
- Keep destination names, ordering, placement, and interaction consistent
  across views. Familiarity reduces learning cost. Source: NB pp. 144-145,
  175; DFD PDF pp. 152-158.
- Client navigation must remain small and task-oriented. Coach navigation may
  be broader but must still group related destinations and disclose depth
  progressively. Source: PROJECT, AGENTS.md, "Assigned, never chosen";
  PROJECT, PRODUCT.md, "Users".
- Use labels with icons unless the icon is truly universal in its context. An
  icon must not be the only explanation for an unfamiliar destination. Source:
  DUI pp. 206-218, 385-399; TIPS p. 21; DUCK pp. 21-24; DFD PDF pp. 103-110.
- Show active navigation with at least two cues, such as a surface change plus
  stronger text or weight. Do not rely on hue alone. Source: DUI pp. 388-391;
  DFD PDF pp. 103-105.
- Put the most important destinations where sequence and scanning make them
  easiest to remember, but do not manipulate ordering to hide account,
  privacy, or cancellation controls. Source: NB p. 182, "Serial Positioning
  Effect"; NB pp. 186-197.
- Use breadcrumbs only for genuine hierarchy with useful parent levels. Do not
  add them to shallow client flows. The current page is last and not a link;
  breadcrumbs supplement rather than replace global or local navigation.
  Source: DFD PDF pp. 81-83.
- Use text tabs for a small set of peer categories. Keep labels visible, use
  adequate target areas, and make overflow discoverable without shrinking type.
  Source: TIPS p. 5; DUI pp. 389-392; DFD PDF pp. 102-105.
- A side navigation may serve long coach/admin lists. Avoid more than three
  levels of nesting. Source: DUI p. 393.
- A hamburger or drawer is a fallback for constrained space, not the default
  hiding place for primary navigation. Drawer rows and the trigger must retain
  adequate targets. Source: DUI pp. 395-397; DFD PDF pp. 102-110.
- Mobile product navigation should use a small labeled bottom bar when the
  destinations are persistent peers. The active state must be unmistakable and
  the bar must respect device safe areas. Source: DUI pp. 383-388; DFD PDF pp.
  102-105.
- Always provide a clear back, cancel, or close route when users can enter a
  temporary flow. Preserve entered data when safe. Source: NB p. 143, "User
  control and freedom"; DUI pp. 363-381.
- Links navigate and buttons perform actions. Link text must describe the
  destination and remain visibly link-like without relying on color alone.
  Source: SEMUSE p. 7; HTML7 p. 8; DUI pp. 242, 398-399.

## Layout and spacing guidelines

### Hierarchy first

- Identify context, clarification, and action before placing components. The
  most important content must be noticed first, and the final action should
  follow the information needed to take it. Source: NB p. 166; DUI pp.
  219-225; DUCK pp. 31-34.
- Use size, weight, contrast, position, and whitespace in that order of need.
  Do not give every card, heading, or control equal visual weight. Source: DFD
  PDF pp. 114-174; DUI pp. 219-225.
- Do not put unrelated groups close together merely to reduce scrolling. Users
  are comfortable scrolling; compressed content is harder to process. Source:
  DUCK pp. 26-29; NB pp. 49-51.

### Token-only spacing

- Use only named spacing tokens from apps/web/app/globals.css for margin,
  padding, gaps, and spatial rhythm. Do not add one-off numeric Tailwind
  spacing utilities. Source: PROJECT, AGENTS.md, "Spacing discipline";
  PROJECT, apps/web/app/globals.css, "@theme".
- Current spacing roles are: 3xs 2px, 2xs 4px, nudge 6px, xs 8px, compact
  10px, sm 12px, field-y 14px, md 16px, page 20px, lg 24px, xl 40px, 2xl
  48px, 3xl 72px, and 4xl 112px. Use the role, not the number. Source:
  PROJECT, DESIGN.md, "spacing"; PROJECT, apps/web/app/globals.css, "@theme".
- Component internals should usually use a smaller token than the gap between
  components; section transitions should use a larger token than either.
  Source: DUCK pp. 28-29; DUI pp. 84-99; DFD PDF pp. 41-43; TIPS p. 73.
- Whitespace is the first separator. Add a divider or surface change only when
  spacing cannot communicate the boundary. Source: DFD PDF pp. 160-165; DUCK
  pp. 25-34.

### Widths and alignment

- Use the existing width tokens: form 440px, content 640px, chat 720px, and
  marketing 1120px unless a specific task has a documented need for another
  named token. Source: PROJECT, apps/web/app/globals.css, "Layout widths".
- Keep prose constrained to roughly 65-75 characters per line; shorter
  interface copy may be narrower. Avoid stretching text to fill desktop space.
  Source: PROJECT, DESIGN.md, "Typography"; DUI pp. 73, 190.
- Left-align forms, long text, labels, and most structured content. Center only
  short, self-contained states where the scan path remains obvious. Source:
  DUI pp. 301-304, 323; DFD PDF pp. 148-152; TIPS pp. 46-48.
- Align repeated elements to shared edges and baselines. Optical corrections
  are allowed, but they must become tokens or component behavior rather than
  page-specific offsets. Source: DUI pp. 94-99, 252-254; DFD PDF pp. 148-152.
- Do not add columns just because space exists. Use multiple columns only for
  comparison, parallel scanning, or genuinely paired content. Source: DUI pp.
  67-103; TIPS pp. 12, 43.

### Containment and elevation

- Use cards only when content forms a distinct repeated object, tool, or
  movable unit. Do not wrap every section in a card and never nest cards.
  Source: DUI pp. 258-294; DFD PDF pp. 95-98; PROJECT, DESIGN.md, "Elevation".
- FISH uses no box or text shadows. Separate layers with surface lightness,
  spacing, a semantic border, divider, or scrim. Source: PROJECT, DESIGN.md,
  "Elevation"; PROJECT, apps/web/app/globals.css, global shadow reset.
- Keep border radius consistent by role: card 16px, control 12px, chat 16px,
  chat-inner 4px, and pill 999px. Avoid almost-identical radii beside each
  other. Source: PROJECT, DESIGN.md, "rounded"; TIPS p. 16; DUI pp. 109-112.

## Typography

### Families and roles

- Use Lexend for body, labels, controls, navigation, forms, chat, and data. Use
  Fraunces only for display and headings. Source: PROJECT,
  apps/web/app/layout.tsx; PROJECT, DESIGN.md, "Typography".
- Do not introduce another typeface without a design-system decision. One
  interface should not accumulate decorative or competing families. Source:
  DUI pp. 177-205; DUCK pp. 16-19.
- Verify every required language glyph before adding a font. FISH currently
  loads the Latin subset; expanded language support requires a deliberate
  subset and performance decision. Source: DUI p. 179; PROJECT,
  apps/web/app/layout.tsx.

### Fixed product type ladder

| Role | FISH specification | Use |
| --- | --- | --- |
| Display | Fraunces 600, 32px, 1.1 | Compact product-level title |
| Heading | Fraunces 600, 20px, 1.15 | Screen or section heading |
| Body | Lexend 400, 17px, 1.55 | Explanations, messages, form guidance |
| UI | Lexend 400, 15px, 1.5 | Menus and controls |
| Label | Lexend 500, 14px, 1.45 | Field labels and compact guidance |
| Caption | Lexend 400, 13px, 1.4 | Secondary metadata only |

Source: PROJECT, DESIGN.md, "Typography"; PROJECT,
apps/web/app/globals.css, "Type".

- Most product views should use three or four roles. Avoid many near-identical
  sizes that flatten hierarchy and increase processing. Source: DUI pp.
  183-204; TIPS p. 19; DUCK pp. 18-19.
- Body text is 17px. Do not shrink required product text below 13px, and do
  not use caption styling for task-critical information. Mobile form text must
  remain at least 16px to avoid browser zoom and preserve readability. Source:
  PROJECT, DESIGN.md, "Typography"; TIPS p. 20; DUI pp. 197-198.
- Use regular, medium, semibold, and bold. Avoid thin and light weights,
  especially in dark mode. Source: TIPS pp. 8, 76; DUI pp. 179, 186-190;
  DUCK pp. 16-19.
- Use relative line height. Body copy needs more leading than headings; do not
  hard-code an absolute line height that fails when type changes. Source: CSS5
  p. 5; DUI pp. 182-190; DFD PDF p. 32.
- Keep headings tighter and body copy open. Do not justify interface text.
  Source: PROJECT, DESIGN.md, "Typography"; DUI pp. 182-190.
- Use sentence case for FISH headings, controls, labels, tabs, notices, and
  navigation. Avoid all caps except a very short, low-priority orientation
  label. Source: PROJECT, AGENTS.md, "Copy never scolds"; DUI pp. 431-438.
- Do not use viewport-fluid type on authenticated product surfaces. Fluid hero
  tokens are limited to public marketing and auth brand panels. Source:
  PROJECT, apps/web/app/globals.css, "Marketing type"; DFD PDF pp. 33-39.
- Do not use negative tracking except the existing heading tokens. Keep
  tracking consistent. Source: PROJECT, DESIGN.md, "Typography"; DFD PDF p.
  31.
- Do not use Lorem Ipsum. Realistic copy exposes hierarchy, wrapping,
  localization, and content problems. Source: DUI pp. 437-438; DFD PDF p. 33.

## Color palette and theming

### Use semantic tokens

- Web UI must use CSS-first tokens from apps/web/app/globals.css. Never add raw
  hex values in components and never create tailwind.config.js. Source:
  PROJECT, AGENTS.md, "Design tokens" and "Never"; PROJECT,
  apps/web/app/globals.css, "@theme".
- Canvas and surface roles are bg, surface, surface-2, and surface-3. Text roles
  are foreground, body, and muted. The primary action uses primary and
  on-primary. Feedback uses notice, error, warning, and success. Source:
  PROJECT, apps/web/app/globals.css, "@theme"; PROJECT, DESIGN.md, "Colors".
- Muted is for genuinely secondary content. Essential instructions, values,
  labels, and states must not be muted merely to look soft. Source: DUI pp.
  135-146; DFD PDF pp. 128-141.

### Monochrome hierarchy

- Make the screen understandable in monochrome before semantic hues are
  applied. The primary action is a full-contrast inversion, not a decorative
  brand color. Source: PROJECT, DESIGN.md, "The Monochrome First Rule";
  DUCK pp. 7-14; DUI pp. 121-159.
- Reserve semantic hue for status or feedback. Pair it with copy, icon, shape,
  position, or weight so color is never the only cue. Source: PROJECT,
  AGENTS.md, "Copy never scolds"; DUI pp. 135-146; DFD PDF pp. 22, 128-141.
- Avoid multiple bright colors, high-saturation inactive states, color-only
  categories, and decorative gradients behind core work. Source: DUCK pp.
  7-14; STYLE pp. 99-106, 127-173; PROJECT, DESIGN.md, "Do's and Don'ts".

### Contrast

- Meet WCAG AA for essential text and controls in every theme and state.
  Normal text requires at least 4.5:1 and control boundaries/state indicators
  require at least 3:1 where WCAG applies. Source: DUI p. 135; DFD PDF p. 22;
  PROJECT, apps/web/app/globals.css, contrast-test comments.
- Verify default, hover, focus, active, selected, disabled, placeholder, error,
  and primary-action contrast separately. Source: DFD PDF pp. 40-113; PROJECT,
  DESIGN.md, "Components".
- Decorative objects may have lower contrast only when removing them would
  leave the task fully understandable and operable. Source: DUI p. 135.

### Dark mode

- Dark mode is a separate hierarchy, not a color inversion. The visually
  closer layer must be lighter than the canvas. Source: TIPS p. 74; STYLE pp.
  57-78.
- Use near-black and softened near-white tokens, not hard-coded pure black and
  pure white. This reduces glare and black-smearing risk while preserving
  tested contrast. Source: STYLE pp. 57-78; DUCK pp. 9-10; PROJECT,
  apps/web/app/globals.css, "@theme".
- Do not use dark shadows for elevation. Use ordered surface lightness and a
  scrim for modal depth. Source: STYLE pp. 57-78; PROJECT, DESIGN.md,
  "Elevation".
- Reduce or retune large saturated areas in dark mode so backgrounds do not
  compete with forms, cards, or messages. Source: STYLE pp. 57-78.
- Follow the system theme by default, preserve an explicit user preference,
  and avoid a flash of the wrong theme. Source: PROJECT,
  apps/web/app/globals.css, base theme rules; PROJECT,
  apps/web/app/layout.tsx.

### Visual effects

- FISH may use subtle tonal surfaces and calm nonessential illustrations.
  Core controls must remain solid, familiar, and readable. Source: PROJECT,
  DESIGN.md, "Elevation"; STYLE pp. 5-16.
- Never use neumorphism for buttons or inputs; it depends on low-contrast
  shadows and weak affordances. Source: STYLE pp. 79-88.
- Never use glassmorphism for buttons, text fields, checkboxes, or core text.
  Avoid it entirely unless a rare nonessential surface is demonstrably
  readable in every underlying state. Source: STYLE pp. 89-98.
- Do not place aurora blur, claymorphism, neubrutalist clash, deep glass, or
  spatial effects behind core coaching work. These styles increase visual
  complexity and often reduce contrast or predictability. Source: STYLE pp.
  99-185; PROJECT, PRODUCT.md, "Anti-references".

## Components and interaction patterns

### Shared component system

- Reuse and extend the shared components in apps/web/components/ui/ before
  creating a route-specific control. Current primitives include Button, Input,
  PasswordInput, Card, Progress, Alert, EmptyState, IconButton, ActionMenu,
  SegmentedControl, Switch, and related shared patterns. Source: PROJECT,
  AGENTS.md, "Code conventions"; PROJECT, apps/web/components/ui/.
- Every interactive component must define default, hover where applicable,
  focus-visible, active or pressed, disabled, loading or busy, and error states.
  Selected, empty, warning, success, and notice states are required when the
  component can enter them. Source: DFD PDF pp. 40-113; PROJECT, DESIGN.md,
  "Components".
- State changes must preserve geometry. Focus, loading, validation, selection,
  and disabled treatments must not shift nearby content. Source: PROJECT,
  DESIGN.md, "The Layout Stability Rule"; DUI pp. 230-257.
- Borders and dividers must express a real boundary. Use a semantic control
  border for affordance and a quiet divider between dense groups; do not box
  every region or add a divider below the final item. Source: DFD PDF pp.
  45, 49; PROJECT, apps/web/app/globals.css, border and divider comments.
- Component behavior must remain independent of where it is placed. Parents
  own layout; components own their appearance and interaction states. Source:
  SELECTOR pp. 2-6; CSS5 p. 3; BEM pp. 2-9.

### Buttons and links

- A button must look like a rectangular or gently rounded rectangular button.
  Do not use polygons, ambiguous text blocks, or other novel shapes for core
  actions. Source: DUI pp. 226-229; TIPS p. 24; NB p. 175.
- Use the primary variant once per view for the action that advances the main
  task. Use secondary, ghost, or a link for alternatives. Source: PROJECT,
  AGENTS.md, "One primary action per screen"; DUI pp. 240-245; TIPS pp. 7,
  68.
- Primary actions use the 56px primary-control token when prominence supports
  focus. Default touch-first and frequently used controls use at least the 44px
  target token. Source: PROJECT, AGENTS.md, "Accessible targets"; PROJECT,
  apps/web/app/globals.css, "Interaction targets"; NB p. 176.
- Provide enough horizontal padding that the label has visible breathing room.
  Do not allow adjacent button safe areas to overlap. Source: TIPS pp. 10, 27;
  DUI pp. 230-234.
- Use a direct, outcome-specific verb phrase. Prefer "Send message", "Create
  account", or "Clear history" over "OK", "Next", "Submit", or "Continue".
  Source: DUI pp. 248-252, 360, 369, 431-438; TIPS p. 6; FORM p. 13.
- Preserve button dimensions while loading, prevent duplicate activation, set
  an accessible busy state, and retain enough label context to identify the
  operation. Source: FORM p. 13; DFD PDF pp. 72-74; PROJECT, DESIGN.md,
  "Buttons".
- Do not make a product button so large that it reads as an advertising
  banner. Use the established size tokens and hierarchy instead. Source: TIPS
  p. 38; PROJECT, DESIGN.md, "Buttons".
- A directional icon may reinforce an already clear navigation action, but it
  must not compensate for a vague label and must be tested with the target
  audience. Source: TIPS pp. 39-40.
- Do not disable a submit button merely because a form is incomplete when
  clear validation on activation would teach the user what is needed. Disable
  it after submission begins. Source: FORM p. 13.
- Buttons perform actions. Links navigate. Do not make a div or span act like
  a button. Source: FORM pp. 2, 13; SEMUSE p. 7.
- Links must be distinguishable from static text by underline, weight, shape,
  or another non-color cue. Never underline text that is not interactive.
  Source: TIPS p. 25; DUI pp. 242, 398-399; HTML7 p. 8.

### Cards and containers

- A card contains one subject. Keep its content concise and remove filler
  metadata. Source: DUI pp. 258-294; DFD PDF pp. 95-98.
- Prefer one explicit card action. If the entire card is the only action, make
  the whole card interactive and expose a clear accessible name and state.
  Source: DUI pp. 259-267; DFD PDF pp. 95-98.
- Keep card padding and alignment consistent across a repeated set. Test the
  longest realistic title, metadata, and action label; align actions
  consistently even when content lengths differ. Source: DUI pp. 290-294.
- Images must not dominate a card unless the image is the content. Do not use
  a decorative card merely to fill space. Source: DUI pp. 258-294; PROJECT,
  PRODUCT.md, "Anti-references".

### Icons, icon buttons, badges, and avatars

- Use Tabler Icons for web UI and one consistent style in a given context.
  Stroke, corner treatment, size, and visual weight must match. Source:
  PROJECT, DESIGN.md, "Navigation"; DUCK pp. 21-24; DUI pp. 206-218.
- Filled and outline icons may differ to communicate an active state, but must
  not be mixed for equal-status items. Source: DUCK pp. 21-22; TIPS p. 9; DFD
  PDF pp. 106-110.
- Use a visible label for unfamiliar icons. Every icon-only button still needs
  an accessible name and an adequate target. Tooltips are supplemental, not
  the name. Source: TIPS p. 21; DUI pp. 209, 245, 318; DFD PDF pp. 106-110.
- Keep icons simple enough for their rendered size. Use SVG or icon
  components, not raster images, for interface icons. Source: DFD PDF pp.
  106-110; IMG pp. 2-4.
- Badges communicate short status or count information. Keep them concise,
  provide a non-color cue, and prevent wide counts from shifting surrounding
  layout. Source: DFD PDF pp. 75-77; PROJECT,
  apps/web/app/globals.css, "nav badge slot".
- Use the same avatar image, initials, or placeholder for the same person
  throughout the product. Do not infer gender in placeholder imagery. Source:
  DFD PDF pp. 111-113.
- Avatars should remain rounded, appropriately sized for their context, and
  offer initials when no image is available. Preserve readable contrast
  between initials and background. Source: DFD PDF pp. 111-113.

### Progress

- Use visual progress or named milestones for a long flow. Use meaningful step
  names such as "Basic info", "Location", and "Password", not "Step 1".
  Source: TIPS p. 57; DUI pp. 361, 407; NB pp. 50, 177.
- Progress must be truthful. Do not fake a nearly complete value to manipulate
  completion, and never present a percentage as a judgement of the learner.
  Source: PROJECT, AGENTS.md, "Progress is visual"; NB p. 177.
- Allow users to review completed prior steps when doing so is safe. Preserve
  entered data. Source: TIPS p. 57; NB p. 143.
- Use the shared Progress component and expose programmatic values and labels
  to assistive technology. Source: PROJECT, AGENTS.md, "Code conventions";
  DUI p. 407.

### Tables, lists, and charts

- Use a table only when row-and-column comparison is the task. Client coaching
  surfaces should usually use simpler lists; coach/admin surfaces may need
  dense tables. Source: DUI pp. 295-310; DFD PDF pp. 84-91.
- Left-align text and right-align numeric values. Do not center an entire data
  table. Source: DUI pp. 300-304; TIPS pp. 46-48.
- Keep headers and row context visible while scrolling. Use pagination for
  large serious data sets; do not rely on infinite scroll for work that
  requires position or comparison. Source: TIPS p. 45; DUI pp. 295-310.
- Provide sorting and filtering only when they reduce scan time. Labels such
  as "Lowest first" and "Highest first" are clearer than abstract terms or
  unexplained icons. Source: TIPS p. 62; DUI p. 299.
- Sort semantic numbers, dates, floors, and named sequences in their natural
  domain order rather than alphabetically. Source: TIPS p. 71.
- Keep data visually dominant. Begin in monochrome, use whitespace and subtle
  separators, and add status color only when it contributes meaning. Source:
  DUI pp. 296-309; DFD PDF pp. 84-91.
- On narrow screens, transform tables with six or fewer columns into labeled
  stacked rows when practical. For truly wide professional data, allow
  horizontal scrolling while keeping labels and context visible. Source: TIPS
  pp. 44-45; DUI p. 306.
- Charts must use honest, clearly labeled scales. Make data marks readable,
  tooltips spacious, and series distinguishable by labels, patterns, or shapes
  as well as color. Source: DUI pp. 295-310; TIPS pp. 53-55.
- Use semantic lists for sequences and collections. Use numbered lists when
  order or priority matters, bullets when it does not, and indentation for
  true child items. Source: DFD PDF pp. 89-91; HTMLR pp. 2-3.

### Dialogs, sheets, popovers, tooltips, and accordions

- Use an overlay only when interruption or temporary context is necessary.
  Prefer inline disclosure for routine help and simple edits. Source: DUI pp.
  363-381; DFD PDF pp. 92-102.
- Open dialogs and popups only in response to a user action. Never use
  automatic entry or exit popups in the product. Source: DUI p. 369.
- Give dialogs a clear title, minimal copy, one primary action, and visibly
  subordinate alternatives. Source: DUI pp. 365-369; TIPS p. 7.
- Provide a clearly labeled close control with at least a 44px touch target.
  Escape and outside click may close a non-destructive dialog when doing so
  cannot lose work. Source: TIPS pp. 51-52; DUI pp. 364-368.
- Action sheets should follow touch-platform expectations and visually enter
  from the bottom. Include a safe cancel route. Source: DUI pp. 364, 375-376.
- Tooltips contain nonessential, short help. They must work on focus as well as
  hover and must not contain core instructions, rich workflows, or required
  validation. Prefer inline help on touch screens. Source: DUI pp. 378-379;
  TIPS pp. 59-60; DFD PDF pp. 92-94.
- Transient toasts may confirm a noncritical completed action or system update.
  They must not carry form validation, marketing, or permanent information;
  provide a close route and enough time to read or pause the message. Source:
  DFD PDF pp. 78-80.
- Accordions are for optional chunks. Keep the entire header interactive, use
  a familiar caret, preserve clear expanded state, and allow multiple sections
  open when comparison is useful. Do not hide content users need at once or
  hide an invalid field in a collapsed section. Source: TIPS p. 56; DFD PDF
  pp. 99-102.
- Tabs represent parallel peer views. Keep labels, do not nest tab sets, and do
  not stack tabs as a substitute for a list or accordion. Source: DFD PDF pp.
  102-105.

## Forms and input behavior

### Structure

- Use a real form element for every coherent submission unit. If a page has
  independent submissions, use separate forms. Source: FORM pp. 2-3; HTMLR
  p. 5.
- Use a single-column form by default on every viewport. Multi-column forms
  slow scanning and create ambiguous reading order. Source: TIPS pp. 12, 43;
  DUI pp. 311-361.
- Keep the form narrow and group related fields with a clearly larger gap
  between groups. Source: DUI pp. 317, 323-335; DFD PDF pp. 50-74; TIPS p.
  13.
- Remove nonessential fields. Split a truly long form into cohesive, named
  steps with honest progress. Source: DUI pp. 331, 358-361; NB pp. 49-51,
  174, 179-180.
- Use one full-name field unless the product has a concrete need for separate
  parts or titles. Source: FORM p. 11; TIPS p. 12.

### Labels, hints, and values

- Every control must have a visible, associated label. Put labels above fields
  and left-align them. Source: FORM p. 4; DUI p. 323; NB p. 145.
- A placeholder never replaces a label. Use it only for optional format
  examples that remain available elsewhere after typing. Source: DUI pp.
  319-323; NB p. 145; TIPS pp. 26, 59.
- The entered value has the strongest field text hierarchy, followed by the
  label, then placeholder or helper text. Source: TIPS p. 36; DUI pp. 316-323.
- Put required instructions directly below the relevant field and connect them
  with aria-describedby. Do not hide essential guidance in a tooltip. Source:
  FORM p. 16; TIPS pp. 33, 59-60.
- Field width may hint at expected input length, but it must remain usable with
  zoom, localization, and autofill. Source: DUI p. 326; TIPS p. 30.
- Use a textarea for genuinely long-form input. Keep its visible label,
  choose a task-appropriate initial size, state any character limit, and expose
  a stable character counter when a limit exists. Do not use a full desktop
  width textarea for short input. Source: DFD PDF pp. 61-64.

### Input selection and attributes

- Use the correct type, autocomplete, inputmode, enterkeyhint, min, max, and
  pattern when they reduce effort or prevent invalid input. Source: FORM pp.
  5, 7-10, 12, 14-15.
- Do not use type=number for phone, card, postal, or account identifiers. Use
  tel or inputmode=numeric as appropriate. Source: FORM p. 8.
- Use autocomplete tokens for identity, address, account, and payment fields.
  Do not force users to re-enter data the browser can safely provide. Source:
  FORM pp. 11-12, 14.
- Select the mobile keyboard and enter-key label that match the field's task.
  Source: FORM pp. 5, 9-10, 15; DUI p. 362.
- Use rectangular fields with a visible surface or control boundary. Keep one
  field style across the product; do not mix underline-only and rectangular
  controls. Source: TIPS pp. 14, 18; DUI pp. 319-323.

### Required and optional fields

- Use native required semantics for mandatory data, but mark the smaller set of
  optional fields in visible text. Do not create a forest of red asterisks.
  Source: FORM p. 6; TIPS p. 11; DUI p. 358.
- Explain required state in text that assistive technology can access. Visual
  styling is not a substitute for semantics. Source: FORM pp. 6, 16.
- Ask for consent with a checkbox and plain affirmative language. Do not use a
  toggle for terms acceptance or a choice that still requires submission.
  Source: TIPS pp. 31-32; DUI pp. 351-355.

### Validation and recovery

- Validate near the relevant field and in time to help. Do not wait until a
  final submission to reveal password rules that could have been shown while
  typing. Source: TIPS pp. 33, 56; DUI pp. 313-316.
- Keep error text directly below the field, reserve message space where layout
  stability matters, and connect it with aria-describedby. Source: DUI pp.
  313-317; FORM p. 16; PROJECT, DESIGN.md, "Inputs / Fields".
- Add field icons only when they perform or communicate a consistent,
  necessary function, such as password reveal. Do not decorate some fields
  with unexplained icons while leaving equivalent fields plain. Source: DFD
  PDF pp. 51-54; DUI pp. 316-318.
- Error copy must explain what happened and how to continue. Do not expose raw
  codes or only say "invalid". Source: TIPS p. 15; NB p. 146; DUI pp. 431-438.
- When submission fails, keep entered values unless security requires
  otherwise. Move focus or announce the error so keyboard and screen-reader
  users can find it. Source: NB pp. 143, 146; FORM p. 16.
- Never hide an invalid field inside a collapsed accordion. Source: TIPS p. 56.

### Passwords

- Provide a show/hide password control with an accessible name and adequate
  target. Source: DUI p. 316; TIPS pp. 35-36.
- Show password requirements before and during entry, and update them without
  relying only on color. Source: TIPS p. 37; FORM p. 16.
- Support password managers and autocomplete. Do not block paste. Source:
  FORM p. 14; NB p. 185.

### Choice controls

- Use checkboxes for independent selections submitted with a form. The label
  is part of the target; top-align the box to the first line of long text.
  Source: DUI pp. 351-355; TIPS pp. 32, 34, 72.
- Use radio buttons or a segmented control for one choice from a small visible
  set. Do not use checkboxes when choices are mutually exclusive. Source: DUI
  pp. 354-355; TIPS pp. 28-29.
- Use a dropdown for a larger list, generally more than five options. Add
  filtering or typeahead for long lists. Source: DUI pp. 340-350; TIPS pp.
  28-29, 41.
- Keep option ordering predictable. A "common choices" group may precede an
  alphabetical list only when research shows it saves effort and all choices
  remain searchable. Source: TIPS pp. 57, 61; NB pp. 143-145.
- Use a switch only for an immediate on/off setting. The state must change as
  the switch changes and must not require a separate submit action. Source:
  DUI pp. 352-353; TIPS pp. 31-32; DFD PDF pp. 65-67.
- A range slider must show its current value, visually distinguish the selected
  range, and offer an exact input when precision matters. Source: TIPS pp.
  63-66; DUI p. 356.

### Focus and autofocus

- Focused fields must be visually distinguishable without changing geometry.
  Source: TIPS p. 58; PROJECT, DESIGN.md, "Inputs / Fields".
- Do not autofocus by default. Use it only on a deliberately focused,
  single-input task where skipping preceding context and opening a mobile
  keyboard will not surprise the user. This resolves FORM p. 16 against
  cognitive and mobile usability needs. Source: FORM p. 16; NB pp. 143-145.

## Accessibility requirements

Accessibility is a design input and release criterion, not a final audit.
Source: DUI p. 135; DFD PDF pp. 40, 99; PROJECT, PRODUCT.md, "Accessibility &
Inclusion".

### Semantics and structure

- Use one unique main landmark per page and use header, nav, section, article,
  aside, and footer according to their meaning. Source: SEMUSE pp. 2-6;
  SEMREAL pp. 2-5; HTMLR pp. 2-3.
- Use a logical heading outline. Do not choose heading levels for appearance;
  style them through the type system. Source: HTMLR pp. 2-3; DFD PDF pp.
  33-39.
- Use button for actions and anchor or Link for navigation. Use strong and em
  for semantic emphasis rather than b and i as styling shortcuts. Source:
  SEMUSE p. 7; HTML7 pp. 4-5.
- Use figure and figcaption only when media and caption form a self-contained
  unit. Source: SEMUSE pp. 8-9; HTML7 p. 3.

### Keyboard and focus

- Every interactive control and complete task must work with a keyboard alone.
  Tab order must follow the visual and reading order. Source: FORM p. 16;
  HTML7 p. 7.
- Focus must always be visibly perceivable on every surface and for every
  control type. Do not simply remove the outline without an equally clear
  replacement. Source: HTML7 p. 7; PROJECT, AGENTS.md, "Accessibility floor".
- Opening an overlay must move focus into it, trap focus while modal, and
  restore focus to the trigger on close. Route and validation changes must
  place or announce focus deliberately. Source: DUI pp. 363-381; NB pp.
  142-147.
- Keyboard users must be able to close safe overlays with Escape, operate
  menus and tabs predictably, and use visible skip or landmark navigation where
  repeated chrome warrants it. Source: DUI pp. 363-400; SEMUSE pp. 2-7.

### Targets and input

- Touch-first and frequently used controls must provide at least a 44 by 44px
  interaction area. The visible glyph may be smaller when surrounding
  clickable padding preserves the target. Source: PROJECT, AGENTS.md,
  "Accessible targets"; NB p. 176; DUI pp. 232, 353, 367.
- Keep enough space between targets that one finger cannot activate two
  choices. Desktop controls may be more compact when precision and frequency
  justify it, but should remain easy to acquire. Source: NB pp. 176, 184; DUI
  pp. 231-232.
- Labels for checkboxes, radio buttons, switches, and fields must activate or
  focus their controls. Source: FORM p. 4; DUI pp. 351-355.
- Do not make an essential interaction hover-only, drag-only, swipe-only, or
  dependent on a precision gesture. Source: DUI pp. 377-379; NB pp. 176, 184.

### Names, descriptions, and announcements

- Every control must have an accessible name that describes its action or
  destination. Icon-only controls require an explicit name. Source: FORM pp.
  4, 16; DUI pp. 206-218.
- Associate help and errors through aria-describedby and expose current,
  selected, expanded, checked, pressed, busy, and invalid states with native
  semantics or appropriate ARIA. Source: FORM p. 16; DFD PDF pp. 40-113.
- Announce asynchronous errors, completion, message sending, and loading when
  visual updates would otherwise be silent. Avoid announcing every decorative
  or rapidly changing value. Source: NB p. 142, "Visibility of system status";
  DUI pp. 401-410.

### Perception

- Meet WCAG AA contrast in light and dark themes and never communicate meaning
  by color alone. Source: DUI pp. 135-146; DFD PDF pp. 22, 128-141.
- Preserve legibility at browser zoom and text enlargement. Content must
  reflow rather than clip, overlap, or require two-dimensional scrolling for
  ordinary pages. Source: DUI pp. 58-103, 177-205; PROJECT, PRODUCT.md,
  "Accessibility & Inclusion".
- Respect reduced-motion preferences and provide an explicit reduced-motion
  preference where the product supports it. Source: PROJECT,
  apps/web/app/globals.css, reduced-motion rules; PROJECT,
  apps/web/app/layout.tsx.
- Use semantic HTML reading order rather than CSS-only visual rearrangement
  that makes keyboard or screen-reader order confusing. Source: SEMREAL pp.
  2-5; HTML7 p. 4.

### Media

- Give meaningful images concise alt text describing their purpose in context.
  Use empty alt text for decorative images. Source: IMG pp. 2-8; HTMLR p. 4.
- Do not put essential text only inside an image. If text overlays media, its
  contrast must remain sufficient for every image state. Source: DUI pp.
  413-424; IMG p. 2.
- Captions, transcripts, or equivalent alternatives are required when audio or
  video carries information needed for the task. Source: PROJECT, PRODUCT.md,
  "Accessibility & Inclusion"; SEMUSE pp. 8-9.

### Cognitive accessibility

- Reduce choices, keep language literal, preserve visible labels, group one
  task at a time, and keep state changes predictable. These are accessibility
  requirements for FISH's audience, not optional simplification. Source:
  PROJECT, PRODUCT.md, "Accessibility & Inclusion"; NB pp. 174-180.
- Never use time pressure, punitive progress, disappearing instructions, or
  avoidable interruptions in a client flow. Source: PROJECT, AGENTS.md,
  "Gamification is reward-only" and "Copy never scolds"; NB pp. 186-197.

## Responsive design guidelines

### General

- Responsive behavior is structural. Reflow columns, navigation, tables,
  overlays, and controls at meaningful breakpoints; do not rely on fluid
  product typography to hide layout problems. Source: DUI pp. 58-103; PROJECT,
  apps/web/app/globals.css, product type comments.
- Design for content and tasks, not a single device frame. Test long names,
  translated text, browser zoom, software keyboards, safe areas, and large
  system text. Source: DUI pp. 58-66, 290-294; NB pp. 220-222.
- Avoid horizontal scrolling for ordinary content. It is allowed only when the
  content itself is intrinsically wide, such as a professional data table, and
  context remains visible. Source: TIPS pp. 44-45; DUI pp. 295-310.

### Mobile

- Use one column by default. Two columns are rare and must not create a
  zig-zag scan path. Source: DUI p. 76; TIPS pp. 12, 43.
- Use the page spacing token at screen edges and keep component internals one
  spatial step tighter. Let users scroll rather than shrinking type or targets.
  Source: PROJECT, apps/web/app/globals.css, "spacing-page"; DUCK pp. 26-29.
- A focused primary action may be full-width and 56px tall. Persistent controls
  and mobile navigation must respect safe areas and the onscreen keyboard.
  Source: PROJECT, DESIGN.md, "Buttons"; DUI pp. 383-388.
- Use platform-appropriate pickers and keyboards. Do not force a desktop-style
  dropdown onto a touch screen. Source: DUI pp. 350, 362; FORM pp. 5, 9-10,
  15.
- Convert small tables to labeled stacked rows and keep critical row context
  visible. Source: TIPS pp. 44-45; DUI p. 306.
- Prefer inline help over tooltips. Ensure all hover behavior has a touch and
  keyboard equivalent. Source: DUI pp. 378-379.

### Tablet

- Keep linear tasks single-column. Use two columns only for paired content,
  comparison, or a stable navigation-plus-content relationship. Source: DUI
  pp. 78-79.
- Increase outer whitespace rather than stretching phone content across the
  screen. Do not merely double a phone column or stretch a desktop layout.
  Source: DUI pp. 78-79.

### Desktop

- Constrain forms and prose even when the viewport is wide. Empty side space
  is valid and often improves focus. Source: DUI pp. 72-73, 323-324.
- Coach/admin tools may use denser tables, filters, side navigation, and
  multi-pane layouts when comparison or management requires them. Client
  screens remain sparse. Source: PROJECT, PRODUCT.md, "Users"; DUI pp.
  295-310, 382-400.
- Keep desktop targets comfortably clickable. A precise pointer is not a reason
  to use tiny frequently accessed controls. Source: TIPS p. 17; NB p. 176.

### Responsive media

- Use the image element or framework image component for content media and CSS
  backgrounds only for decoration. Source: IMG p. 2.
- Use SVG for simple icons and logos; use efficient raster formats for photos.
  Provide responsive sizes and modern formats with appropriate fallback.
  Source: IMG pp. 3-6.
- Lazy-load offscreen images when appropriate, but never delay content needed
  for the initial task or cause avoidable layout shift. Source: IMG pp. 7-8.

## Animations and microinteractions

- Motion must explain state, continuity, progress, or feedback. Do not animate
  decoration merely to attract attention. Source: DUI pp. 401-412; PROJECT,
  DESIGN.md, "Motion".
- Use short product transitions, generally 150-250ms. FISH currently uses
  200ms fades and message entrances, 180ms reactions, and 500ms progress.
  Source: PROJECT, apps/web/app/globals.css, "Focus and motion"; DUI pp.
  401-410.
- Animate opacity and transforms. Do not animate layout properties that cause
  reflow or geometry changes. Source: PROJECT, DESIGN.md, "Motion"; DUI pp.
  401-412.
- Use calm ease-out timing. Never use bounce, elastic, or large overshoot in
  product UI. Source: PROJECT, DESIGN.md, "Motion"; DUI pp. 404-406.
- Respect prefers-reduced-motion and the explicit FISH reduced-motion setting.
  Clamp both duration and iteration count so looping indicators stop rather
  than flicker. Source: PROJECT, apps/web/app/globals.css, reduced-motion
  rules.
- New chat messages may use a 200ms opacity and 6px vertical settle. Reactions
  may use a brief 180ms scale confirmation. Neither may become a score,
  streak, or attention loop. Source: PROJECT, DESIGN.md, "Chat Feedback";
  PROJECT, apps/web/app/globals.css, chat keyframes.
- Typing indicators and skeletons may pulse quietly. Do not use aggressive
  shimmer sweeps or infinite decorative motion. Source: PROJECT, DESIGN.md,
  "Chat Feedback"; NB p. 178.
- Progress animation must move forward truthfully and expose its final state.
  Interrupted, failure, and success states must be defined. Source: DUI p. 407.
- Action sheets may slide from the bottom because the motion teaches their
  dismiss direction. Dialogs and notices should otherwise favor a simple fade.
  Source: DUI pp. 369, 376; PROJECT, apps/web/app/globals.css, "fade-in".
- Avoid parallax and orchestrated page-load sequences in the product. If a
  public marketing page uses motion, it must remain nonessential and stop under
  reduced motion. Source: DUI p. 412; PROJECT, PRODUCT.md,
  "Anti-references".

## Error, empty, and loading states

### Errors and notices

- State what happened, why if known, and what the user can do next. Keep the
  message specific, calm, and short. Source: TIPS p. 15; NB p. 146; DUI pp.
  431-438.
- Place field errors beside the field. Use a page or floating notice for a
  submission-level result, not as a replacement for field validation. Source:
  DUI pp. 313-317; PROJECT, DESIGN.md, "Alerts".
- Use FISH semantic tokens and pair hue with an icon, text, and placement.
  Never rely on alarming red alone and never prefix a message with "Error".
  Source: PROJECT, AGENTS.md, "Copy never scolds"; PROJECT, DESIGN.md,
  "Alerts"; DUI p. 146.
- Preserve data, keep recovery available, and provide retry only when retry can
  succeed. Do not expose stack traces, provider messages, or opaque codes.
  Source: NB pp. 143, 146; TIPS p. 15.
- Destructive actions require explicit labels and appropriate confirmation or
  undo. The destructive option must not visually overpower the safe path by
  default. Source: DUI pp. 243-245, 434; TIPS p. 7.

### Empty states

- An empty state must explain what the absence means and present at most one
  useful next action when the user can resolve it. Source: TIPS p. 49; DFD PDF
  pp. 95-98.
- Do not fill a client empty state with a gallery of popular actions, plans, or
  lessons. If the coach has assigned a next step, show that single assignment;
  otherwise explain that the coach has not assigned one yet. Source: PROJECT,
  AGENTS.md, "Assigned, never chosen"; TIPS pp. 49-50.
- Use an illustration only when it reassures or clarifies without becoming the
  focal task. Decorative media must be silent to assistive technology. Source:
  DUI pp. 425-430; PROJECT, PRODUCT.md, "Anti-references".
- Distinguish first-use empty, filtered-empty, permission-empty, offline, and
  completed states. Their explanations and next actions are not interchangeable.
  Source: NB pp. 142-147; DUI pp. 425-430.

### Loading and busy states

- Never show a blank screen with no status. Give immediate, layout-stable
  evidence that the request is in progress. Source: NB pp. 142, 178; TIPS p.
  42.
- Use skeletons when the content structure is predictable, progress when
  completion is measurable, and a stable spinner only for small indeterminate
  actions. Source: TIPS p. 42; NB p. 178.
- Match skeleton geometry to the eventual content closely enough to prevent
  layout shift. Keep the animation calm and stop it under reduced motion.
  Source: PROJECT, DESIGN.md, "Chat Feedback"; TIPS p. 42.
- A busy action must prevent duplicate submission, preserve the button's size,
  and expose aria-busy or equivalent status. Source: FORM p. 13; PROJECT,
  DESIGN.md, "Buttons".
- Long-running operations must provide progress, cancellation when feasible,
  and a recovery path after interruption. Source: DUI p. 407; NB p. 178.

### Success and return

- Confirm success close to the action, then keep the user oriented to what
  happens next. Do not interrupt a routine success with a modal. Source: DUI
  pp. 401-410; NB p. 142.
- Keep success calm. Do not use confetti, scores, streak resets, or judgemental
  percentages. Source: PROJECT, AGENTS.md, "Progress is visual" and
  "Gamification is reward-only".
- When a user returns after a gap, acknowledge continuity and show the next
  assigned step. Never call attention to the absence as failure. Source:
  PROJECT, PRODUCT.md, "Product Purpose"; PROJECT, AGENTS.md,
  "Gamification is reward-only".

## Content and UX writing guidelines

- Use sentence case throughout the product. Source: PROJECT, AGENTS.md, "Copy
  never scolds"; PROJECT, DESIGN.md, "The Sentence Case Rule".
- Use plain, common words and direct verbs. FISH is used by English learners,
  so literal language is more inclusive than idiom, jargon, cleverness, or
  metaphor inside task UI. Source: PROJECT, PRODUCT.md, "Users"; NB pp.
  143-147; DUI pp. 431-438.
- Button labels must name the outcome. Avoid "OK", "Next", "Submit",
  "Continue", "Yes", and "No" when a specific action fits. Source: TIPS p. 6;
  DUI pp. 369, 431-438; FORM p. 13.
- Keep vocabulary consistent. The same object and action must have the same
  name in navigation, headings, controls, errors, notifications, and help.
  Source: DUI p. 435; DFD PDF pp. 152-158.
- Do not use double negatives, confirmshaming, fake urgency, scarcity,
  countdown pressure, or language that hides the user's preferred action.
  Source: TIPS p. 33; NB pp. 186-197.
- Errors must be non-scolding and constructive. Prefer "That did not send. Try
  again in a moment" over "You failed to send the message". Source: PROJECT,
  AGENTS.md, "Copy never scolds"; NB p. 146.
- Put essential instructions where they are needed. Do not hide them in a
  tooltip, help icon, or separate documentation page. Source: TIPS pp. 59-60;
  NB pp. 145-147.
- Keep dialog copy to the minimum needed to decide, usually a clear title and
  no more than two short explanatory sentences. Source: DUI p. 369.
- Write real content before polishing visual design on copy-heavy screens.
  Typeframing may be used to agree on copy and hierarchy before decoration.
  Source: NB pp. 169-171; DUI pp. 431-438.
- Use descriptive links that make sense out of context. Never use "click here"
  or several identical "learn more" links without accessible clarification.
  Source: HTML7 p. 8; DUI pp. 398-399.
- Keep help procedural: short steps, examples, and visuals when they clarify a
  complex action. Make large help collections searchable and categorized.
  Source: NB p. 147.
- Test copy with realistic long names, coach messages, validation details, and
  future translations. Do not truncate information needed to act. Source: DUI
  pp. 290-294, 431-438.

## Platform-specific considerations

### FISH web implementation

- FISH web uses Next.js App Router, React, TypeScript, Tailwind CSS v4, and
  CSS-first configuration. Do not create tailwind.config.js and keep
  tailwindcss and @tailwindcss/postcss on the same version. Source: PROJECT,
  AGENTS.md, "Stack" and "Never".
- Use pnpm and the repository scripts. Do not introduce npm lockfiles. Source:
  PROJECT, AGENTS.md, "Stack" and "Commands".
- Keep product tokens in apps/web/app/globals.css and use token-backed
  utilities. If a visual value is truly missing, add a semantic token with a
  stated purpose before using it. Source: PROJECT, AGENTS.md, "Design tokens"
  and "Spacing discipline".
- Reuse Button, Input, Card, Progress, Alert, and the other shared primitives.
  Use cn() for conditional classes and forwardRef for focusable controls.
  Source: PROJECT, AGENTS.md, "Code conventions".
- Every React component implementation must live in its own same-named folder
  with an index.ts entry point. Route-private components use the required
  _components structure. Source: PROJECT, AGENTS.md, "Component folder
  structure".
- Complete public barrels should use export * unless an intentional boundary,
  collision, rename, or compatibility surface requires a subset. Source:
  PROJECT, AGENTS.md, "Exports and barrels".

### Semantic HTML and CSS

- Prefer semantic landmarks and native controls over ARIA replicas. Real-world
  pages should use header, nav, main, article, section, aside, form, list, time,
  details, and summary where their meanings fit. Source: SEMREAL pp. 2-5;
  SEMUSE pp. 2-9; HTMLR pp. 2-5.
- Do not use inline presentation styles or invalid inline/block nesting. Use
  CSS and correct semantic structure. Source: HTML7 pp. 4, 6.
- Custom CSS selectors must express intent, remain reusable, and avoid parent
  location dependence. Keep selectors short and specificity low. Source:
  SELECTOR pp. 2-6; CSS5 pp. 3-4; CSSBP pp. 11-14.
- Avoid magic values, qualified selectors, !important, vague class names, and
  absolute line heights. Source: CSS5 pp. 2, 4-6; CSSBP pp. 7, 11-14.
- When custom CSS is necessary, keep names lowercase and purpose-based, group
  declarations in a consistent order, use shorthand only when every value is
  intentionally set, omit units from zero, and let the repository formatter
  normalize syntax. Source: CSSBP pp. 2-12.
- Comments must explain non-obvious purpose, constraints, or relationships.
  Do not narrate a selector whose name already states the same thing. Source:
  CSSBP p. 10.
- Keep component styling separate from page layout. Organize custom CSS by
  system concern and keep media queries near the rule they affect. Source:
  CSSORG pp. 2-9; CSSBP p. 15.
- BEM concepts may inform custom CSS naming, but Tailwind utilities and React
  component boundaries remain the repository default. The relevant principle
  is a clear block, element, state, and reusable intent. Source: BEM pp. 2-9;
  PROJECT, AGENTS.md, "Code conventions".

### Browser and device behavior

- Use native form features, browser autofill, input types, keyboard hints, and
  constraint attributes when they help. Source: FORM pp. 3-16; HTMLR pp. 5-7.
- Preserve browser zoom, text scaling, keyboard navigation, history, and
  expected link behavior. Do not intercept standard behavior for visual flair.
  Source: NB pp. 143-145, 175; HTMLR pp. 4, 7.
- Verify light and dark themes, reduced motion, touch and mouse input, narrow
  and wide viewports, and at least the major target browser engines. Source:
  PROJECT, PRODUCT.md, "Accessibility & Inclusion"; NB pp. 220-222.

### Native mobile if introduced later

- Follow iOS and Android conventions for pickers, safe areas, navigation,
  gestures, keyboards, and accessibility. Do not transplant desktop controls
  unchanged. Source: DUI pp. 58-66, 197, 350, 362.
- Platform-native fonts are an option for a future native app, but they do not
  replace Lexend and Fraunces in the current web product without a documented
  design-system change. Source: DUCK p. 17; DUI p. 197; PROJECT, DESIGN.md,
  "Typography".
- Every gesture must have an accessible alternative, and native target-size
  guidance must be treated as a floor. Source: DUI pp. 353, 367, 377-379; NB
  p. 176.

## Do's and Don'ts

These are the shortest release-level summary. Detailed rules and rationale
remain authoritative in the sections above.

### Do

- Do reduce each client screen to one assigned task and one obvious primary
  action. Source: PROJECT, AGENTS.md, "One primary action per screen" and
  "Assigned, never chosen"; NB p. 174.
- Do validate learning behavior with a coach and real client before coding it.
  Source: PROJECT, AGENTS.md, "Coach-first, code-second".
- Do use familiar controls, visible labels, direct verbs, and consistent
  vocabulary. Source: NB pp. 143-145, 175; DUI pp. 431-438.
- Do use hierarchy, proximity, and token-based whitespace to communicate
  groups. Source: DUI pp. 219-225; DUCK pp. 25-34; PROJECT, AGENTS.md,
  "Spacing discipline".
- Do use only semantic color, type, radius, spacing, size, motion, and width
  tokens from the design system. Source: PROJECT, AGENTS.md, "Design tokens";
  PROJECT, apps/web/app/globals.css, "@theme".
- Do reuse shared components and define all relevant interaction and data
  states. Source: PROJECT, AGENTS.md, "Code conventions"; DFD PDF pp. 40-113.
- Do keep frequently used touch targets at least 44 by 44px and use the 56px
  primary-action token where its prominence supports focus. Source: PROJECT,
  AGENTS.md, "Accessible targets"; NB p. 176.
- Do maintain visible keyboard focus, semantic HTML, associated labels,
  descriptive links, and correct control roles. Source: FORM pp. 3-16;
  SEMUSE pp. 2-9; HTML7 pp. 7-8.
- Do test contrast, keyboard, touch, reduced motion, zoom, long content,
  loading, empty, error, and recovery states. Source: DUI pp. 475-495;
  PROJECT, PRODUCT.md, "Accessibility & Inclusion".
- Do keep errors specific, calm, non-scolding, and actionable. Source: PROJECT,
  AGENTS.md, "Copy never scolds"; NB p. 146.
- Do make progress visual, truthful, and supportive. Source: PROJECT,
  AGENTS.md, "Progress is visual"; NB p. 177.
- Do test high-risk flows with realistic mid/high-fidelity behavior and real
  target users. Source: NB pp. 120-125, 217-226.

### Don't

- Don't add plan galleries, template menus, learning-path pickers, or multiple
  competing primary actions for clients. Source: PROJECT, AGENTS.md, "Assigned,
  never chosen"; NB pp. 174, 179-180.
- Don't build unvalidated exercises, community mechanics, gamification, or
  punitive streaks. Source: PROJECT, AGENTS.md, "Coach-first, code-second" and
  "Gamification is reward-only".
- Don't use raw hex colors, arbitrary visual values, one-off spacing, npm, or a
  Tailwind configuration file. Source: PROJECT, AGENTS.md, "Stack", "Design
  tokens", "Spacing discipline", and "Never".
- Don't use shadows, glows, glass, neumorphism, aurora blur, nested cards, loud
  outlines, or decoration behind core work. Source: PROJECT, DESIGN.md,
  "Elevation" and "Do's and Don'ts"; STYLE pp. 79-185.
- Don't use placeholders as labels, hide essential guidance in tooltips, or
  hide invalid fields in collapsed content. Source: NB p. 145; TIPS pp. 56,
  59-60.
- Don't use vague actions, double negatives, technical errors, fake urgency,
  or shame. Source: DUI pp. 431-438; NB pp. 186-197.
- Don't communicate state with color alone or use muted text for essential
  content. Source: DUI pp. 135-146; DFD PDF pp. 128-141.
- Don't remove focus indication, make interactions mouse-only, or shrink
  frequent controls to fit more content. Source: HTML7 p. 7; NB pp. 176, 184.
- Don't use decorative motion, bounce, layout-property animation, or endless
  motion that ignores reduced-motion preferences. Source: DUI pp. 401-412;
  PROJECT, apps/web/app/globals.css, reduced-motion rules.
- Don't show a blank loading screen, an unexplained empty screen, or a
  disappearing failure. Source: NB pp. 142, 178; TIPS pp. 42, 49.
- Don't disguise ads, obstruct cancellation, preselect paid extras, fake
  scarcity, or optimize a metric through deception. Source: NB pp. 186-197.
- Don't assume the first design is correct. Measure, test, refine, and repeat.
  Source: NB pp. 216-226.

## Inconsistencies and resolved conflicts

This section records disagreements in the corpus and the binding FISH decision.

| Topic | Source guidance in conflict | FISH decision |
| --- | --- | --- |
| Number of primary actions | DUI pp. 240-245 and TIPS p. 7 establish hierarchy; DUCK p. 14 allows rare equal buttons | FISH is stricter: at most one primary button per view. Equal actions must use distinct non-primary treatments or be separated into steps. Source: PROJECT, AGENTS.md, "One primary action per screen". |
| Touch targets | NB p. 176 suggests 44px mobile and 24-32px desktop; DUI pp. 232, 353, 367 varies by context; DFD PDF p. 107 shows 48px around a 24px icon | Use at least 44 by 44px for touch-first and frequently used controls on every device. Primary actions may be 56px. Compact desktop and inline links may be smaller only when context and spacing preserve usability. Source: PROJECT, AGENTS.md, "Accessible targets". |
| Required markers | FORM p. 6 recommends required asterisks; TIPS p. 11 and DUI p. 358 recommend marking optional fields | Keep native required semantics, but visibly mark optional fields when they are the minority. Do not use red required asterisks as the default. |
| Error color | NB p. 146 and several generic examples use red; FISH requires calm feedback and the token system includes desaturated semantic hues | Use the error token only as one cue alongside icon, copy, and placement. Informational notices remain monochrome. Copy never scolds. Source: PROJECT, AGENTS.md, "Copy never scolds"; PROJECT, apps/web/app/globals.css, feedback tokens. |
| Button capitalization | TIPS p. 26 recommends title case for multiword buttons; DFD PDF p. 30 allows capitalization for emphasis | FISH uses sentence case for every product action, label, notice, and destination. Source: PROJECT, DESIGN.md, "The Sentence Case Rule". |
| Pure black and white | DUCK p. 8 presents black and white as safe backgrounds; DUI pp. 158, 190 and STYLE pp. 57-78 warn about harsh contrast and smearing | Use near-black and near-white OKLCH tokens. Never hard-code #000 or #fff in web components. Source: PROJECT, apps/web/app/globals.css, "@theme". |
| Shadows and elevation | DUI pp. 114-118, 266 and DFD PDF pp. 45-46, 95-98 recommend subtle shadows; STYLE pp. 57-78 discourages dark-mode shadows | FISH uses no box or text shadows in either theme. Use surface steps, spacing, borders, dividers, and scrims. Source: PROJECT, DESIGN.md, "Elevation". |
| Grid system | DUI pp. 84-99 discusses 8- and 10-point grids; DUCK pp. 28-29 recommends an 8-point grid | Use the named FISH spacing tokens. Their values are informed by a compact 8-point rhythm but intentionally include 2, 4, 6, 10, 12, 14, and 20px roles. Never substitute an abstract grid rule for the implemented semantic scale. Source: PROJECT, AGENTS.md, "Spacing discipline". |
| Body type size | DUCK pp. 18-19 allows 12-14px app text; DUI pp. 197-198 favors about 18px; TIPS p. 20 warns below 16px mobile input text | FISH body is 17px; mobile field text is at least 16px; 13px is the smallest normal metadata role. Source: PROJECT, DESIGN.md, "Typography". |
| Native fonts | DUCK p. 17 and DUI p. 197 recommend SF Pro or Roboto for native apps | Current web UI uses Lexend and Fraunces. Reconsider native fonts only if a native app is introduced. Source: PROJECT, apps/web/app/layout.tsx. |
| Progress percentages | NB p. 177 describes artificially accelerated progress; DUI p. 361 recommends percentage or step progress | FISH progress must be truthful and never a grade. Prefer a bar plus named milestones. Programmatic numeric values may support accessibility without presenting judgemental percentages. Source: PROJECT, AGENTS.md, "Progress is visual". |
| Empty-state suggestions | TIPS p. 50 recommends popular choices; FISH prohibits client browsing of learning options | Empty states may present one assigned or contextually necessary action, not a gallery. Source: PROJECT, AGENTS.md, "Assigned, never chosen". |
| Dropdown threshold | TIPS pp. 28-29 says avoid dropdowns for 3-5 options; DUI p. 340 says five or fewer should use visible controls | Use visible radio or segmented controls for five or fewer choices when the choice itself is valid. First ask whether a client should be making the choice at all. |
| Autofocus | FORM p. 16 recommends autofocus on the first input | Do not autofocus by default. Allow it only for an intentionally focused single-input task that will not skip context or unexpectedly open a mobile keyboard. |
| Popup dismissal | DUI pp. 364-368 promotes X, outside click, and a closing action | Use multiple dismissal routes for safe informational overlays. Do not allow outside click or Escape to discard destructive decisions or unsaved work without protection. |
| Action placement | TIPS pp. 22-23 favors the primary action on the right and at the bottom for left-to-right scanning; DFD PDF p. 73 favors bottom-left form actions | Put actions where the task's reading order ends, keep the primary action last in logical order, and use one stable placement within a flow. Mobile primary actions may be full-width. Do not hard-code left or right as a universal rule before localization and RTL decisions. |
| Toast duration | DFD PDF p. 79 recommends automatic dismissal after five seconds; important timed content can be inaccessible | Auto-dismiss only noncritical, recoverable status after enough reading time. Important errors, required decisions, and recovery instructions remain until resolved or explicitly dismissed. |
| Chart scale | TIPS p. 54 recommends shrinking a Y-axis to fit data; data-visualization ethics require honest interpretation | Select a domain appropriate to the analytical question, label it clearly, and never truncate a scale to exaggerate change. Source: DUI pp. 295-310; NB pp. 186-197. |
| "Popular choices" ordering | TIPS p. 61 recommends placing popular countries first; predictable ordering also supports scanning and recall | A researched common-choice group is allowed only above a complete, searchable, predictably sorted list. Never hide or demote less common identities. |
| Prototyping | NB pp. 123-125 and 226 recommends mid/high fidelity for usability; NB p. 222 says clickable prototypes are often wasteful | Prototype only the uncertainty. Use coded HTML when interaction fidelity matters, a visual prototype when hierarchy is being tested, and no prototype when a familiar pattern is already clear. |
| Mobile-first | DUI pp. 76-88 favors small-screen constraints in parts; DUCK p. 45 questions reflexive mobile-first design | Start with the highest-risk task and constraints, then verify all target viewports. Do not let a workflow slogan replace responsive testing. |
| Tinted neutrals | TIPS p. 75 and parts of STYLE recommend tinting grays toward a primary hue; FISH's implemented structural tokens intentionally use zero chroma | Keep structural neutrals monochrome until the design system is deliberately revised. Semantic status hues remain the only current exception. Source: PROJECT, apps/web/app/globals.css, "@theme". |
| BEM versus Tailwind | BEM pp. 2-9 recommends BEM class structures; the repository uses Tailwind v4 and component folders | Apply BEM's intent and independence principles to React components and any custom CSS, but do not replace the repository's Tailwind architecture. |

## Missing areas requiring design decisions

The PDFs do not resolve the following FISH-specific areas. Until each is
decided and documented, use the temporary default stated here.

| Priority | Gap | Temporary default / decision needed |
| --- | --- | --- |
| High | Focus indicator specification | The current global focus-visible treatment primarily changes opacity and removes outlines. Run a dedicated keyboard and contrast audit to decide whether every control remains clearly perceivable; if not, add a tokenized non-shadow indicator. This is required by HTML7 p. 7 and PROJECT, AGENTS.md, "Accessibility floor". |
| High | Coach and client navigation maps | Document the exact destination set, ordering, mobile behavior, and permissions for each role before adding more shell navigation. Default to the smallest existing set. |
| High | Realtime, offline, and reconnect states | Define message queueing, failed sends, reconnect status, duplicate prevention, and recovery announcements. Default to preserving drafts, showing calm inline status, and offering retry only when connected. |
| High | Notification interruption policy | Decide what may interrupt a user, what stays in a notification center, quiet hours, and accessible announcement behavior. Default to no unsolicited modal or sound. |
| High | Destructive action policy | Define when to use confirmation, undo, reauthentication, and data-retention copy. Default to undo for reversible actions and explicit confirmation for irreversible ones. |
| High | Neurodivergent usability validation | Establish a recurring test panel and success criteria with real clients and coaches. Generic accessibility compliance cannot validate attention, memory, language, or return-after-gap behavior. Source: PROJECT, "Coach-first, code-second"; NB pp. 120-125. |
| Medium | Breakpoint behavior matrix | Tokens define widths but the corpus does not define FISH's component-by-component breakpoints. Document navigation, chat panes, tables, dialogs, and forms at each supported range. |
| Medium | Live-region and focus-management policy | Standardize polite versus assertive announcements, route-change focus, validation summaries, chat updates, and loading completion. Default to the least interruptive announcement that still exposes the state. |
| Medium | High contrast and forced colors | Add a forced-colors test strategy and decide whether any token or icon needs an explicit system-color fallback. Default to native controls and semantic boundaries wherever possible. |
| Medium | Localization, RTL, and text expansion | Decide supported languages, font subsets, grammatical tone, name/address models, RTL mirroring, and a text-expansion budget. Default to flexible layouts, full-name fields, and no directional assumptions in component logic. |
| Medium | Content reading-level standard | Define target vocabulary, sentence length, terminology list, and review ownership for English learners. Default to plain literal English and one idea per sentence. |
| Medium | Data visualization system | If coach analytics expands, define chart types, scales, non-color series cues, accessible summaries, and mobile behavior before adding one-off charts. |
| Medium | Media accessibility in chat | Define alt text editing, captions, transcripts, attachment naming, autoplay, and sensitive-media handling. Default to no autoplay and require an accessible name for every attachment. |
| Medium | Privacy and consent UX | Define data-use explanations, consent granularity, withdrawal, deletion, and coach/client visibility in plain language. Default to minimum collection and no preselected optional consent. |
| Low | Native app design system | No native app is currently in scope. If that changes, create platform-specific typography, navigation, picker, gesture, and accessibility rules instead of copying web UI. |

## UI review checklist

This checklist introduces no new guidance; it operationalizes the cited rules
above.

### Product and scope

- [ ] Is the user's role and single task explicit?
- [ ] Is there exactly one primary action?
- [ ] Is client work assigned rather than browsed?
- [ ] Has any learning behavior been coach-validated?
- [ ] Can any field, option, card, or decoration be removed?

### Information architecture and navigation

- [ ] Does the flow group one logical category per step?
- [ ] Are context, system response, error, and recovery states mapped?
- [ ] Is primary navigation visible, stable, and role-appropriate?
- [ ] Are active, back, cancel, and close states clear?
- [ ] Are labels consistent across navigation, headings, actions, and help?

### Hierarchy, layout, and typography

- [ ] Is the context, clarification, action sequence obvious?
- [ ] Are related items close and unrelated groups clearly separated?
- [ ] Does every space use a named token?
- [ ] Are prose and forms constrained to readable widths?
- [ ] Does the screen use a small, fixed type ladder with readable weights?
- [ ] Is all product copy sentence case and free of filler text?

### Color and theme

- [ ] Does the screen work through hierarchy before hue?
- [ ] Are all values semantic tokens with no raw hex?
- [ ] Does every state pass contrast in light and dark themes?
- [ ] Is meaning communicated by more than color?
- [ ] Does dark-mode depth use lighter near surfaces and no shadow?

### Components and forms

- [ ] Are shared components reused?
- [ ] Are default, hover, focus, active, selected, disabled, loading, and error
  states defined where relevant?
- [ ] Do state changes preserve geometry?
- [ ] Do buttons look actionable and use outcome-specific labels?
- [ ] Does every field have a visible associated label?
- [ ] Are fields single-column, minimal, and grouped by task?
- [ ] Are input type, autocomplete, inputmode, and enterkeyhint correct?
- [ ] Are errors inline, calm, specific, and recoverable?
- [ ] Are choice controls semantically correct and genuinely necessary?

### Accessibility

- [ ] Can the complete task be performed with a keyboard?
- [ ] Is focus clearly visible on every interactive element?
- [ ] Are frequent touch targets at least 44 by 44px?
- [ ] Are names, descriptions, states, and asynchronous updates programmatic?
- [ ] Does content reflow under zoom and text enlargement?
- [ ] Does reduced motion stop transitions and looping indicators?
- [ ] Do images and media have the correct text alternatives?
- [ ] Is reading order logical in both visual and semantic structure?

### Responsive, motion, and states

- [ ] Does mobile remain single-column unless the task demands otherwise?
- [ ] Do navigation, tables, dialogs, and forms change structure deliberately?
- [ ] Are software keyboards, safe areas, long text, and real devices tested?
- [ ] Does motion explain state, use calm timing, and avoid layout animation?
- [ ] Are loading, partial, empty, offline, error, retry, and success states
  complete and layout-stable?
- [ ] Does returning after a gap feel continuous rather than punitive?

### Implementation

- [ ] Are Tailwind v4, pnpm, tokens, cn(), and component-folder conventions
  followed?
- [ ] Are semantic HTML and native controls used before ARIA replicas?
- [ ] Are custom selectors reusable, short, and location-independent?
- [ ] Are responsive images, formats, alt behavior, and lazy loading correct?
- [ ] Do module-boundary tests report zero loose components and zero component
  folders without index.ts?
- [ ] Do lint, typecheck, tests, and the production build pass in proportion to
  the change?
