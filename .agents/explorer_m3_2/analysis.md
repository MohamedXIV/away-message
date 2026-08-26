# Architecture & Blueprint: Pulse Messenger (Milestone 3)

**Author:** explorer_m3_2  
**Target Subsystem:** `src/apps/pulse/`  
**Milestone:** M3 (Fake Internet, Browser & Desktop Applications Ecosystem)  
**Date:** 2026-08-22  

---

## 1. Executive Summary & System Architecture

Pulse Messenger is the central social interface and narrative engine communication conduit of *Away Message*. Modeled after period-authentic mid-2000s instant messengers (AOL Instant Messenger 5.x, MSN Messenger 6.x/7.x, ICQ, Yahoo! Messenger), Pulse provides a living social world where four key characters (Maya, Ryan, Nora, Mr. Henderson) live on 14-day deterministic schedules, experience status changes, and participate in authored branching conversations.

### Architectural Principles
1. **Authoritative Simulation Separation**: All domain state (presence, schedules, relationship dimensions, conversation records) is owned by `SocialEngine` within `SimulationEngine`. UI components never store authoritative game state.
2. **Authentic Period UX**: 
   - **Pulse 5.2 on Orion 4.8**: Classic Windows 98/2000 beveled chrome (`#c0c0c0`), sharp corners, dense typography, classic emoticon palette, text-only buddy listings.
   - **Pulse 6.0 on Orion 6.0**: Windows XP Royale/Luna sand & blue styling, 96×96 buddy display pictures (avatars), rich animated emoticons, "Nudge" window shake, custom font styling.
3. **Simulated Typing Cadence**: Realistic character-by-character typing indicators, word-per-minute calculations with jitter, multi-line burst pauses, and authored reply choice menus.
4. **Web Audio Integration**: Procedurally synthesized retro chimes (`door_open` on sign-in, `door_slam` on sign-off, `im_recv` on message arrival, `im_send` on message sent).
5. **Background Desktop Toasts**: Period-authentic slide-up popup toasts when messages arrive while Pulse is minimized or out of focus, with click-to-focus routing.

```
+-----------------------------------------------------------------------------------+
|                                 DESKTOP SHELL                                     |
|                                                                                   |
|  +---------------------------+   +---------------------------------------------+  |
|  | Pulse Messenger (Buddy)   |   | Pulse Messenger (Chat Window / Tabs)        |  |
|  | +-----------------------+ |   | +-----------------------------------------+ |  |
|  | | User Profile & Status | |   | | Tabs: [Maya (1)] [Ryan] [Nora]          | |  |
|  | +-----------------------+ |   | +-----------------------------------------+ |  |
|  | | [Online (2/4)]        | |   | | Buddy Info Header & Avatar              | |  |
|  | |  🟢 Maya ~ listening..| |   | +-----------------------------------------+ |  |
|  | |  🟢 Ryan ~ chilling   | |   | | Message History Log (Timestamps, HTML)  | |  |
|  | | [Away (1/4)]          | |   | |  <starlight_maya>: hey did you settle in?| |
|  | |  🟡 Nora ~ indexing.. | |   | |  [Maya is typing a message...]          | |  |
|  | | [Offline (1/4)]       | |   | +-----------------------------------------+ |  |
|  | |  ⚪ Henderson         | |   | | Authored Response Choices Menu (1..4)   | |  |
|  | +-----------------------+ |   | +-----------------------------------------+ |  |
|  | | Away Msg Editor Modal | |   | | Formatting Toolbar & Emoticon Picker    | |  |
|  | +-----------------------+ |   | +-----------------------------------------+ |  |
|  +---------------------------+   +---------------------------------------------+  |
|                                                                                   |
|                                                     +--------------------------+  |
|                                                     | Desktop Toast (Bottom-R) |  |
|                                                     | 💬 IM from starlight_maya|  |
|                                                     +--------------------------+  |
|  [Start] [Taskbar: Pulse (Blinking)]                       [Systray: 18:42 PM]    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure & Module Breakdown

All files are located in `src/apps/pulse/`:

```
src/apps/pulse/
├── PulseMessengerApp.tsx       # Root application container / window entry point
├── types.ts                    # Component types, UI models, formatting interfaces
├── components/
│   ├── BuddyListWindow.tsx     # Main contact list view with collapsible groups
│   ├── BuddyGroup.tsx          # Status group accordion (Online, Away, Busy, Offline)
│   ├── BuddyItem.tsx           # Contact item row with presence icon, status msg, avatar
│   ├── UserProfileHeader.tsx   # Player screen name, status dropdown selector, avatar
│   ├── AwayMessageEditor.tsx   # Custom away message creator with presets & activation
│   ├── ChatWindow.tsx          # Multi-tab conversation container
│   ├── ChatTabHeader.tsx       # Tab bar for active buddy chats with unread badges
│   ├── MessageHistoryView.tsx  # Message history log with timestamps and styling
│   ├── MessageInputBar.tsx     # Text input, formatting toolbar, Send button
│   ├── AuthoredResponseMenu.tsx# Dialogue choice overlay (semantic social branches)
│   ├── TypingCadenceOverlay.tsx# Character typing indicator and letter streaming
│   ├── EmoticonPalette.tsx     # Emoticon picker popup (Orion 4.8 vs 6.0 palettes)
│   └── PulseNotificationToast.tsx # Desktop slide-up notification toast
├── hooks/
│   ├── usePulseAudio.ts        # Event-driven sound chimes with transition suppression
│   ├── useSimulatedTyping.ts   # Cadence simulation, WPM timers, multi-line bursts
│   └── usePulseNotifications.ts# Unread message detector and toast dispatcher
├── data/
│   ├── dialogueTrees.ts        # 14-day authored dialogue scripts, beats, and branch tags
│   ├── awayMessagePresets.ts   # Period-authentic presets (quotes, ascii, lyrics)
│   └── avatars.ts              # 96x96 pixel art / webcam avatars for Orion 6.0
└── utils/
    ├── emoticonParser.tsx      # Text-to-emoticon parser
    └── timeFormat.ts           # 12-hour timestamp helper
```

---

## 3. Data Models & TypeScript Types (`types.ts`)

```ts
import { BuddyPresenceStatus, MessageRecord, RelationshipDimensions } from '../../engine/types';

export interface PulseFontFormatting {
  fontFamily: 'Tahoma' | 'Arial' | 'Comic Sans MS' | 'Times New Roman' | 'Courier New';
  fontSize: '11px' | '12px' | '14px';
  color: string; // Hex color code (e.g., '#000080', '#c00000', '#006600', '#ff00ff')
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

export interface EmoticonDefinition {
  code: string; // e.g. ':-)', ':D', '<3'
  altCodes?: string[];
  label: string;
  glyph: string; // Fallback unicode or icon
  orion60IconUrl?: string;
  isOrion60Only?: boolean;
}

export interface DialogueChoiceOption {
  id: string;
  text: string;
  socialAction: 'empathy' | 'remembered_detail' | 'tease_playful' | 'dismissive' | 'vulnerable_share' | 'work_camaraderie' | 'intellectual_curiosity';
  requiredFamiliarity?: number;
  requiredTrust?: number;
  conditionFlag?: string;
  nextScriptId?: string;
}

export interface NpcDialogueScript {
  id: string;
  buddyId: string;
  triggerMinuteMin?: number;
  triggerMinuteMax?: number;
  requiredDay?: number;
  requiredBeatId?: string;
  messages: Array<{
    text: string;
    delaySeconds?: number;
    tags?: string[];
  }>;
  playerChoices?: DialogueChoiceOption[];
}

export interface PulseNotification {
  id: string;
  buddyId: string;
  buddyName: string;
  buddyHandle: string;
  avatarUrl?: string;
  textSnippet: string;
  timestamp: string;
  createdAt: number;
}
```

---

## 4. Main Buddy List Window Blueprint

### Component Hierarchy
- `BuddyListWindow.tsx`
  - `UserProfileHeader.tsx`: Shows user handle (`wanderer06`), current status (`Online`, `Away`, `Busy`, `Appear Offline`), custom away message subtitle, and Orion 6.0 avatar box.
  - `AwayMessageEditor.tsx`: Modal dialog for composing and setting custom away messages.
  - Search / Filter bar for contacts.
  - `BuddyGroup.tsx` (`Online`):
    - `BuddyItem.tsx` (Maya)
    - `BuddyItem.tsx` (Ryan)
  - `BuddyGroup.tsx` (`Away`):
    - `BuddyItem.tsx` (Nora)
  - `BuddyGroup.tsx` (`Offline`):
    - `BuddyItem.tsx` (Mr. Henderson)
  - Bottom action bar: "Add Contact", "Chat", "Away Message", "Preferences".

### State Gating & Presence Mapping
`SocialEngine` provides the authoritative presence map.
- Grouping logic partitions `Object.entries(buddies)` by `presence[buddyId].status`:
  1. `online`: Status icon is solid green circle / glowing dot.
  2. `away`: Status icon is amber clock / sleeping face.
  3. `busy`: Status icon is red slash / do-not-disturb icon.
  4. `offline`: Status icon is faded gray circle / closed door.

### Custom Status Messages
Displayed directly underneath the buddy handle in subtle italicized text:
- Maya: *"listening to the rain ~ myplace/mayablue"*
- Ryan: *"afk grabbin tacos"*
- Nora: *"the night is quiet"*
- Henderson: *"motel front desk open"*

Double-clicking any buddy row invokes `openChatTab(buddyId)`, switching focus to the active conversation tab in `ChatWindow`.

---

## 5. Custom Away Message Editor Blueprint

### Functional Requirements
1. **Rich Away Message Composer**: Allows entering multi-line formatted text up to 500 characters.
2. **Period-Authentic Presets**:
   - `Away from keyboard`: *"Stepped away for a moment. Leave a message!"*
   - `RetroAmp Playing`: *"♫ Listening to: Track 03 - Midnight Rain ♫"*
   - `Food Cart Shift`: *"Working at the taco cart. Back at 10 PM. Don't let the city burn down."*
   - `Rainy Window`: *"Watching the neon signs flicker through the motel blinds..."*
   - `ASCII Art Banner`: `"[~*~ AFK - In Search of Lost Time ~*~]"`
3. **Automatic State Activation**:
   - Clicking **"Set as Away"** automatically sets the player's presence in `SocialEngine` to `away` and stores the `customAwayMessage`.
   - When the player sends a new chat message or changes status dropdown back to `Online`, the away mode is automatically cleared with a retro toast *"Welcome back! Away message deactivated."*
4. **Auto-Responder Simulation**:
   - When player is in `Away` status and an incoming message arrives, the chat log displays an auto-response entry:
     `<Auto-Response from player>: I am away from my desk: "[Custom Message]"`

---

## 6. Chat Window & Multi-Tab Messaging Interface Blueprint

### Layout Architecture
The chat interface can operate as an integrated tabbed pane or docked side-by-side view.

```
+--------------------------------------------------------------------+
|  [✕] Maya (1)  |  Ryan  |  Nora  |  [+] New Chat                   |
+--------------------------------------------------------------------+
|  [Avatar] starlight_maya (Online)                                  |
|  Status: listening to the rain ~ myplace/mayablue      [Nudge / 📳] |
+--------------------------------------------------------------------+
|                                                                    |
|  --- Conversation started with starlight_maya on Day 2 ---         |
|  (18:31:02) starlight_maya: hey! did you manage to get that        |
|             old sound card working?                                |
|  (18:32:15) wanderer06: yeah, found an old driver on DownloadHub.  |
|  (18:33:04) starlight_maya: nice :D you should get RetroAmp too!  |
|  --- starlight_maya is typing a message... ---                     |
|                                                                    |
+--------------------------------------------------------------------+
|  [Authored Choices Overlay: 1) "Downloading it now" 2) "Maybe"]    |
+--------------------------------------------------------------------+
|  [B] [I] [U] | [Font: Tahoma ▼] [Size: 11px ▼] [🎨 Navy] [😊 ▼]    |
|  Type message here...                                     [Send]   |
+--------------------------------------------------------------------+
```

### Components
1. **`ChatTabHeader.tsx`**:
   - Renders horizontal tabs for all open conversations.
   - Highlights unread conversations with a glowing pulse / unread count badge `(1)`.
   - Close button (`✕`) per tab.
2. **`MessageHistoryView.tsx`**:
   - Auto-scrolls to the newest message upon receipt.
   - Formats timestamps `(HH:MM:SS)`.
   - Renders sender handles in authentic AIM/MSN bold colored syntax:
     - Player: `<span style="color:#000080;font-weight:bold;">wanderer06:</span>`
     - Maya: `<span style="color:#800080;font-weight:bold;">starlight_maya:</span>`
     - Ryan: `<span style="color:#006600;font-weight:bold;">ryan_foodcart:</span>`
     - Nora: `<span style="color:#003366;font-weight:bold;">NightOwl87:</span>`
   - Emoticon replacement via `emoticonParser.tsx`.
   - System announcements (buddy sign-in, status changes, away notices, nudges).
3. **`MessageInputBar.tsx`**:
   - Multi-line / single-line input field.
   - Font style controls (Font Family, Font Size, Color Picker palette, Bold, Italic, Underline).
   - Emoticon Picker trigger button.
   - "Send" button and Enter key submit handler.

---

## 7. Simulated Typing UX & Cadence Engine Blueprint

### Mechanical Requirements from Specs (`docs/04-INTERNET-SOCIAL-AND-NARRATIVE.md`)
> "Messenger conversation UX: compact log, timestamps, typing indicator, authored choices. Optional player 'typing animation' after choosing a line. The player selects meaning, then the selected message can appear to be typed before sending."

### The Cadence Algorithm (`useSimulatedTyping.ts`)
Each character has an authored `typingSpeedWpm` in `SocialEngine`:
- **Ryan**: 80 WPM (fast, short messages, minor typos)
- **Maya**: 60 WPM (thoughtful, conversational, punctuation, emoticons)
- **Nora**: 90 WPM (rapid burst typist, nocturnal logs)
- **Henderson**: 40 WPM (slow, measured, short sentences)

#### Mathematical Timing Model:
$$\text{CPS (Characters Per Second)} = \frac{\text{WPM} \times 5}{60}$$
$$\text{Base Delay (ms)} = \frac{\text{Message Length}}{\text{CPS}} \times 1000$$
$$\text{Jitter (ms)} = \text{random}(-200, 400)$$
$$\text{Total Duration (ms)} = \max(800, \text{Base Delay} + \text{Jitter})$$

#### Multi-Message Burst Sequence:
When an NPC dialogue beat contains multiple messages (e.g. `["hey", "are you free tonight?", "thought we could grab coffee"]`):
1. **Step 1**: Set status to `'typing'` for Message 1 (`"hey"` -> 800ms).
2. **Step 2**: Emit Message 1 to chat history -> trigger `soundManager.play('im_recv')`.
3. **Step 3**: Reading pause (1.2s - 2.0s).
4. **Step 4**: Set status to `'typing'` for Message 2 (`"are you free tonight?"` -> 2.2s).
5. **Step 5**: Emit Message 2 -> trigger `im_recv`.
6. **Step 6**: Repeat until sequence completes, then populate `AuthoredResponseMenu`.

### Authored Response Selection Menu (`AuthoredResponseMenu.tsx`)
- Displays 2 to 4 contextual choices gated by relationship dimensions and narrative flags:
  - **Choice 1 (Empathy)**: *"[Empathetic] That sounds exhausting, you should get some rest."* (Applies `empathy` action -> `+familiarity`, `+trust`, `+comfort`).
  - **Choice 2 (Playful Tease)**: *"[Tease] You're just looking for an excuse to drink more coffee :P"* (Applies `tease_playful` action -> `+familiarity`, `+comfort`).
  - **Choice 3 (Work Focus)**: *"[Work] Did the cart get that new shipment in?"* (Applies `work_camaraderie` action).
  - **Choice 4 (Dismissive)**: *"[Dismissive] Gotta go, busy right now."* (Applies `dismissive` action -> `-trust`, `+annoyance`).

### Player Typing Streaming Animation:
When the player clicks a choice:
1. The text streams character-by-character into the input bar over 600ms–1200ms with a blinking cursor.
2. The message is automatically committed to `SocialEngine` upon completion.
3. `soundManager.play('im_send')` plays.
4. The semantic social action is dispatched to update relationship dimensions.

---

## 8. Web Audio Sound Effects Integration Blueprint

### Audio Event Matrix (`usePulseAudio.ts`)

| Event Trigger | Sound Effect | Procedural Synthesis Signature in `SynthAudio` |
|---|---|---|
| **Buddy Transitions Offline/Away -> Online** | `door_open` | Low-frequency creak saw wave rising from 140Hz to 260Hz over 200ms |
| **Buddy Transitions Online/Away -> Offline** | `door_slam` | Resonant heavy sine thud dropping from 85Hz to 25Hz over 180ms with 0.3 gain |
| **Incoming Message Received** | `im_recv` | Classic ascending dual-sine chime: G5 (784Hz) for 350ms followed by C6 (1046Hz) for 550ms |
| **Player Message Sent** | `im_send` | Crisp high sine pulse: E5 (659Hz) ramped to G5 (784Hz) over 150ms |
| **Nudge / Buzz Received** | `error` / custom buzz | Fast oscillating saw modulation (80Hz rumble) with screen shake effect |
| **UI Click / Tab Switch** | `click` | 15ms triangle click pulse dropping from 1800Hz to 200Hz |

### Transition Sound Guard:
To prevent sound cacophony:
- Mute all door open/slam chimes during in-game time jumps (e.g. sleeping 480 minutes or working a 4-hour shift).
- Suppress audio triggers on initial game startup when restoring saved presence state.
- Obey master/SFX volume and mute state in `useAudioStore`.

---

## 9. Background Desktop Notification Toasts Blueprint

### Trigger Condition Logic (`usePulseNotifications.ts`)
A notification toast is dispatched when an incoming message is received and:
1. `windows['pulse']?.isOpen === false`, OR
2. `windows['pulse']?.isMinimized === true`, OR
3. `activeWindowId !== 'pulse'`, OR
4. The user is in Pulse Messenger, but viewing a different chat tab than the sender.

### Toast Component (`PulseNotificationToast.tsx`)
- Fixed at `bottom: 38px, right: 14px` (directly above the taskbar in the bottom-right corner).
- Auto-dismisses after 6000ms with smooth slide-up and fade-out animation.
- Visual styling adapts to current OS:
  - **Orion 4.8**: AIM yellow/gray beveled card with running man icon, bold handle header, preview snippet, and time.
  - **Orion 6.0**: MSN blue/sand translucent rounded card with 32×32 avatar image and glossy header.
- **Click Handler**:
  - Restores/unminimizes Pulse window: `restoreWindow('pulse')`.
  - Brings Pulse to front: `focusWindow('pulse')`.
  - Sets active conversation tab to the sender buddy.
  - Marks message as read: `social.markAsRead(buddyId)`.
  - Dismisses the toast immediately.

---

## 10. Orion 4.8 vs Orion 6.0 Generational Features

### Feature Specification Comparison

| Subsystem Feature | Orion 4.8 / Pulse 5.2 | Orion 6.0 / Pulse 6.0 |
|---|---|---|
| **Window Frame & Colors** | `#c0c0c0` Classic 3D Bevel, Sharp corners, Blue/White titlebar gradient | Sand `#ece9d8` face, Rounded corners, XP Royal Blue titlebar, Soft drop shadows |
| **Buddy Avatars (Display Pictures)** | Not supported. Text-only display with status dot | Supported: 96×96 pixel-art / webcam photos in buddy list, chat header, and profile editor |
| **Emoticon Set** | 10 classic text/static smileys (`:)`, `:D`, `:P`, `;)` etc.) | Rich 24+ animated / colored emoticons with categorized popup picker |
| **Nudge / Buzz Feature** | Disabled | "Send Nudge" button with screen shake CSS animation and alert chime |
| **Status Formatting** | Plain text status line | Formatted status with clickable URLs (e.g. `myplace.local/mayablue`) |
| **Chat Font Customization** | Basic font family & 8 standard colors | Full typography palette (16 colors, font sizes, bold/italic/underline) |

### Emoticon Palette Definition (`EmoticonPalette.tsx`)
1. Classic Smileys (Available in both 4.8 and 6.0):
   - `:)` / `:-)` -> 😊 Happy
   - `:(` / `:-(` -> 🙁 Sad
   - `:D` / `:-D` -> 😄 Big Grin
   - `;)` / `;-P` -> 😉 Wink
   - `:P` / `:-p` -> 😛 Tongue Out
   - `:O` / `:-o` -> 😮 Surprised
   - `<3` -> ❤️ Heart
   - `(Y)` -> 👍 Thumbs Up
   - `(N)` -> 👎 Thumbs Down
   - `:S` / `:-/` -> 😕 Confused
2. Rich Emoticons (Orion 6.0 Exclusive):
   - `(H)` -> 😎 Cool Sunglasses
   - `:@` -> 😡 Angry / Fuming
   - `:$` -> 😳 Blushing / Embarrassed
   - `(A)` -> 😇 Angel
   - `(6)` -> 😈 Devil
   - `(M)` -> 🎵 Music Note
   - `(C)` -> ☕ Coffee Cup
   - `(K)` -> 💋 Kiss
   - `(E)` -> ✉️ Envelope / Letter
   - `(F)` -> 🌹 Rose
   - `(B)` -> 🍺 Beer / Beverage
   - `(Z)` -> 💤 Sleeping / Zzz

---

## 11. Dialogue Scripting & Narrative Beat Adapter (`data/dialogueTrees.ts`)

### Key 14-Day Narrative Arcs
1. **Maya (`starlight_maya`)**:
   - **Day 1 (Introduction & Setup)**: Checks if player settled into the motel; mentions the rain and late coffee.
   - **Day 2 (Music & Software)**: Recommends RetroAmp and shares link to `myplace.local/mayablue`.
   - **Day 4 (Work Frustration)**: Discusses tedious data entry job; player empathy unlocks trust.
   - **Day 6 (Late Night Vulnerability)**: Shares childhood memory of city lights; vulnerable share choice.
   - **Day 8 (Café Invitation)**: Invites player to meet in person at the local café on Day 10 at 15:00.
   - **Day 11 (Post-Meeting Reflection)**: Changes tone to warm, intimate, referencing the physical meeting.
2. **Ryan (`ryan_foodcart`)**:
   - **Day 1 (Settling In)**: Asks how the motel is, warns about the squeaky floorboards.
   - **Day 3 (PC Upgrades & BidBay)**: Advises player on finding cheap RAM on BidBay to run newer software.
   - **Day 5 (Taco Cart Rush)**: Hilarious rant about food cart boss and lunch rush chaos.
   - **Day 7 (Rent Day Reminder)**: Reminds player that Henderson is collecting rent today.
   - **Day 12 (Future Plans)**: Talks about saving up to buy a used car and start a computer repair shop.
3. **Nora (`NightOwl87`)**:
   - **Day 2 (Nocturnal Greeting)**: Cryptic welcome to the late-night net; mentions NightBoard logs.
   - **Day 5 (Rabbit Hole A Guide)**: Hints at an old archived thread about forgotten software utilities.
   - **Day 9 (Rabbit Hole B - Identity)**: Cryptic remarks about the motel's history and previous residents.
4. **Mr. Henderson (`motel_office`)**:
   - **Day 1 (Check-in Confirmation)**: Formal notice of motel rules and internet DSL login.
   - **Day 5 (Internet Bill Notice)**: Reminder that DSL connection fee ($25.00) is due.
   - **Day 7 (Rent Due Notice)**: Official demand for weekly motel rent ($140.00).
   - **Day 14 (Final Week Rent)**: Final evaluation rent collection notice.

---

## 12. Complete Source Code Blueprints

### 12.1. `src/apps/pulse/types.ts`
```ts
import { BuddyPresenceStatus, MessageRecord, RelationshipDimensions } from '../../engine/types';

export interface PulseFontFormatting {
  fontFamily: 'Tahoma' | 'Arial' | 'Comic Sans MS' | 'Times New Roman' | 'Courier New';
  fontSize: '11px' | '12px' | '14px';
  color: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

export interface EmoticonDefinition {
  code: string;
  altCodes?: string[];
  label: string;
  glyph: string;
  isOrion60Only?: boolean;
}

export interface DialogueChoiceOption {
  id: string;
  text: string;
  socialAction: 'empathy' | 'remembered_detail' | 'tease_playful' | 'dismissive' | 'vulnerable_share' | 'work_camaraderie' | 'intellectual_curiosity';
  requiredFamiliarity?: number;
  requiredTrust?: number;
  conditionFlag?: string;
  nextScriptId?: string;
}

export interface NpcDialogueScript {
  id: string;
  buddyId: string;
  day?: number;
  triggerMinuteMin?: number;
  triggerMinuteMax?: number;
  requiredBeatId?: string;
  messages: Array<{
    text: string;
    delaySeconds?: number;
    tags?: string[];
  }>;
  playerChoices?: DialogueChoiceOption[];
}

export interface PulseNotification {
  id: string;
  buddyId: string;
  buddyName: string;
  buddyHandle: string;
  avatarUrl?: string;
  textSnippet: string;
  timestamp: string;
  createdAt: number;
}
```

---

### 12.2. `src/apps/pulse/utils/emoticonParser.tsx`
```tsx
import React from 'react';
import { EmoticonDefinition } from '../types';

export const EMOTICON_LIST: EmoticonDefinition[] = [
  { code: ':-)', altCodes: [':)'], label: 'Smile', glyph: '😊' },
  { code: ':-D', altCodes: [':D', ':d'], label: 'Grin', glyph: '😄' },
  { code: ';-)', altCodes: [';)'], label: 'Wink', glyph: '😉' },
  { code: ':-P', altCodes: [':P', ':-p', ':p'], label: 'Tongue', glyph: '😛' },
  { code: ':-(', altCodes: [':('], label: 'Sad', glyph: '🙁' },
  { code: ':-O', altCodes: [':O', ':-o', ':o'], label: 'Surprised', glyph: '😮' },
  { code: '<3', label: 'Heart', glyph: '❤️' },
  { code: '(Y)', altCodes: ['(y)'], label: 'Thumbs Up', glyph: '👍' },
  { code: '(N)', altCodes: ['(n)'], label: 'Thumbs Down', glyph: '👎' },
  { code: ':-/', altCodes: [':/', ':-S', ':S'], label: 'Confused', glyph: '😕' },
  { code: ":'-(", altCodes: [":'("], label: 'Crying', glyph: '😢' },
  { code: '8-)', altCodes: ['8)'], label: 'Cool', glyph: '😎' },
  // Orion 6.0 Exclusives
  { code: ':@', label: 'Angry', glyph: '😡', isOrion60Only: true },
  { code: ':$', label: 'Blushing', glyph: '😳', isOrion60Only: true },
  { code: '(A)', altCodes: ['(a)'], label: 'Angel', glyph: '😇', isOrion60Only: true },
  { code: '(6)', label: 'Devil', glyph: '😈', isOrion60Only: true },
  { code: '(M)', altCodes: ['(m)'], label: 'Music', glyph: '🎵', isOrion60Only: true },
  { code: '(C)', altCodes: ['(c)'], label: 'Coffee', glyph: '☕', isOrion60Only: true },
  { code: '(Z)', altCodes: ['(z)'], label: 'Sleep', glyph: '💤', isOrion60Only: true },
];

export function parseEmoticons(text: string, isOrion60: boolean): React.ReactNode[] {
  const availableEmoticons = EMOTICON_LIST.filter(e => !e.isOrion60Only || isOrion60);
  
  // Build tokenization regex
  const patterns: string[] = [];
  availableEmoticons.forEach(e => {
    patterns.push(escapeRegex(e.code));
    e.altCodes?.forEach(alt => patterns.push(escapeRegex(alt)));
  });

  if (patterns.length === 0) return [text];

  const regex = new RegExp(`(${patterns.join('|')})`, 'g');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const matched = availableEmoticons.find(
      e => e.code === part || e.altCodes?.includes(part)
    );
    if (matched) {
      return (
        <span
          key={index}
          className="inline-block mx-0.5 align-middle select-none transform hover:scale-125 transition-transform"
          title={`${matched.label} (${matched.code})`}
        >
          {matched.glyph}
        </span>
      );
    }
    return part;
  });
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

---

### 12.3. `src/apps/pulse/hooks/usePulseAudio.ts`
```ts
import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { soundManager } from '../../../audio/SoundManager';
import { BuddyPresenceStatus } from '../../../engine/types';

export function usePulseAudio() {
  const presence = useSimulationStore((s) => s.state.social.presence);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const prevPresenceRef = useRef<Record<string, BuddyPresenceStatus>>({});
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      // Seed initial map without sound
      for (const [id, p] of Object.entries(presence)) {
        prevPresenceRef.current[id] = p.status;
      }
      isInitialMount.current = false;
      return;
    }

    if (isPaused) return;

    for (const [id, p] of Object.entries(presence)) {
      const prev = prevPresenceRef.current[id];
      const curr = p.status;

      if (prev && prev !== curr) {
        // Sign-on transition: offline -> online/away
        if (prev === 'offline' && (curr === 'online' || curr === 'away')) {
          soundManager.play('door_open');
        }
        // Sign-off transition: online/away -> offline
        else if (prev !== 'offline' && curr === 'offline') {
          soundManager.play('door_slam');
        }
      }

      prevPresenceRef.current[id] = curr;
    }
  }, [presence, isPaused]);
}
```

---

### 12.4. `src/apps/pulse/hooks/useSimulatedTyping.ts`
```ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { soundManager } from '../../../audio/SoundManager';
import { NpcDialogueScript, DialogueChoiceOption } from '../types';
import { DIALOGUE_SCRIPTS } from '../data/dialogueTrees';

export interface TypingState {
  isTyping: boolean;
  activeBuddyId: string | null;
  typingIndicatorText: string;
  availableChoices: DialogueChoiceOption[];
  currentScriptId: string | null;
}

export function useSimulatedTyping(activeConversationBuddyId: string | null) {
  const engine = useSimulationStore((s) => s.engine);
  const time = useSimulationStore((s) => s.state.time);
  const social = useSimulationStore((s) => s.state.social);
  const relationships = useSimulationStore((s) => s.state.social.relationships);

  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    activeBuddyId: null,
    typingIndicatorText: '',
    availableChoices: [],
    currentScriptId: null,
  });

  const [playerTypingText, setPlayerTypingText] = useState('');
  const [isPlayerTyping, setIsPlayerTyping] = useState(false);

  const activeTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimeouts = () => {
    activeTimeoutRef.current.forEach(t => clearTimeout(t));
    activeTimeoutRef.current = [];
  };

  // Trigger NPC dialogue script
  const triggerNpcScript = useCallback((script: NpcDialogueScript) => {
    clearTimeouts();
    const buddy = engine.getBuddy(script.buddyId);
    const wpm = buddy?.typingSpeedWpm ?? 60;
    const cps = (wpm * 5) / 60;

    let accumulatedDelay = 600; // Initial delay before typing starts

    script.messages.forEach((msg, idx) => {
      const typingDuration = Math.max(1000, Math.min(5000, (msg.text.length / cps) * 1000));

      // Start typing indicator
      const t1 = setTimeout(() => {
        setTypingState(prev => ({
          ...prev,
          isTyping: true,
          activeBuddyId: script.buddyId,
          typingIndicatorText: `${buddy?.displayName || script.buddyId} is typing a message...`,
          currentScriptId: script.id,
        }));
      }, accumulatedDelay);

      // Finish typing and emit message
      const t2 = setTimeout(() => {
        engine.social.sendMessage(
          script.buddyId,
          script.buddyId,
          'player',
          msg.text,
          engine.clock.getTotalMinutes(),
          false,
          msg.tags
        );
        engine.notifySubscribers();
        soundManager.play('im_recv');

        const isLastMessage = idx === script.messages.length - 1;
        if (isLastMessage) {
          setTypingState(prev => ({
            ...prev,
            isTyping: false,
            activeBuddyId: null,
            typingIndicatorText: '',
            availableChoices: script.playerChoices || [],
          }));
        }
      }, accumulatedDelay + typingDuration);

      activeTimeoutRef.current.push(t1, t2);
      accumulatedDelay += typingDuration + 1400; // Pause between messages
    });
  }, [engine]);

  // Handle player choice selection
  const selectPlayerChoice = useCallback((choice: DialogueChoiceOption, buddyId: string) => {
    setIsPlayerTyping(true);
    setPlayerTypingText('');
    setTypingState(prev => ({ ...prev, availableChoices: [] }));

    // Stream text into input box
    let charIndex = 0;
    const fullText = choice.text;
    const typeInterval = setInterval(() => {
      charIndex++;
      setPlayerTypingText(fullText.substring(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(typeInterval);
        setTimeout(() => {
          // Send message
          engine.dispatchAction({
            type: 'SOCIAL_SEND_MESSAGE',
            buddyId,
            text: fullText,
            tags: [choice.socialAction],
          });
          engine.dispatchAction({
            type: 'SOCIAL_APPLY_ACTION',
            buddyId,
            socialAction: choice.socialAction,
          });
          soundManager.play('im_send');
          setIsPlayerTyping(false);
          setPlayerTypingText('');

          // Trigger next branch if available
          if (choice.nextScriptId) {
            const nextScript = DIALOGUE_SCRIPTS.find(s => s.id === choice.nextScriptId);
            if (nextScript) {
              setTimeout(() => triggerNpcScript(nextScript), 1200);
            }
          }
        }, 300);
      }
    }, 25);
  }, [engine, triggerNpcScript]);

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  return {
    typingState,
    playerTypingText,
    isPlayerTyping,
    triggerNpcScript,
    selectPlayerChoice,
  };
}
```

---

### 12.5. `src/apps/pulse/hooks/usePulseNotifications.ts`
```ts
import { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { PulseNotification } from '../types';

export function usePulseNotifications(activeTabBuddyId: string | null) {
  const conversations = useSimulationStore((s) => s.state.social.conversations);
  const buddies = useSimulationStore((s) => s.engine.getBuddy);
  const windows = useWindowStore((s) => s.windows);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  const [activeToasts, setActiveToasts] = useState<PulseNotification[]>([]);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      // Collect initial message IDs
      Object.values(conversations).forEach(msgs => {
        msgs.forEach(m => seenMessageIds.current.add(m.id));
      });
      isInitialMount.current = false;
      return;
    }

    const pulseWin = windows['pulse'];
    const isPulseInactive = !pulseWin || !pulseWin.isOpen || pulseWin.isMinimized || activeWindowId !== 'pulse';

    Object.entries(conversations).forEach(([buddyId, msgs]) => {
      msgs.forEach(msg => {
        if (!seenMessageIds.current.has(msg.id)) {
          seenMessageIds.current.add(msg.id);

          // If message is from NPC and Pulse is unfocused or viewing another tab
          if (msg.senderId !== 'player' && (isPulseInactive || activeTabBuddyId !== buddyId)) {
            const buddy = buddies(buddyId);
            const newToast: PulseNotification = {
              id: `toast_${msg.id}`,
              buddyId,
              buddyName: buddy?.displayName || buddyId,
              buddyHandle: buddy?.handle || buddyId,
              avatarUrl: buddy?.avatarUrl,
              textSnippet: msg.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: Date.now(),
            };

            setActiveToasts(prev => [...prev.slice(-2), newToast]); // Keep maximum 3 toasts

            // Auto-dismiss after 6s
            setTimeout(() => {
              setActiveToasts(prev => prev.filter(t => t.id !== newToast.id));
            }, 6000);
          }
        }
      });
    });
  }, [conversations, windows, activeWindowId, activeTabBuddyId, buddies]);

  const handleToastClick = (toast: PulseNotification, onSelectTab: (buddyId: string) => void) => {
    restoreWindow('pulse');
    focusWindow('pulse');
    onSelectTab(toast.buddyId);
    setActiveToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  const dismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    activeToasts,
    handleToastClick,
    dismissToast,
  };
}
```

---

### 12.6. `src/apps/pulse/components/PulseNotificationToast.tsx`
```tsx
import React from 'react';
import { PulseNotification } from '../types';
import { MessageSquare, X } from 'lucide-react';
import { useSimulationStore } from '../../../store/useSimulationStore';

interface Props {
  toasts: PulseNotification[];
  onToastClick: (toast: PulseNotification) => void;
  onDismiss: (id: string) => void;
}

export const PulseNotificationToast: React.FC<Props> = ({ toasts, onToastClick, onDismiss }) => {
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const isOrion60 = osVersion === 'Orion_6.0';

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-3 z-[9999] flex flex-col gap-2 pointer-events-auto select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => onToastClick(toast)}
          className={`w-72 cursor-pointer shadow-2xl transition-all duration-300 animate-slide-up ${
            isOrion60
              ? 'bg-gradient-to-b from-[#e3efff] to-[#bcd7ff] border border-[#316ac5] rounded-t-lg p-2.5 text-black'
              : 'orion-outset bg-[#c0c0c0] p-2 text-black border border-black'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-400/40 pb-1 mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#000080]">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Instant Message from {toast.buddyName}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="text-gray-500 hover:text-black p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Body */}
          <div className="flex items-start gap-2">
            {isOrion60 && toast.avatarUrl ? (
              <img
                src={toast.avatarUrl}
                alt={toast.buddyName}
                className="w-8 h-8 rounded border border-gray-400 object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-[#000080] text-white flex items-center justify-center font-bold text-xs rounded-xs flex-shrink-0">
                {toast.buddyName.charAt(0)}
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <div className="text-[10px] text-gray-600 font-semibold">{toast.buddyHandle} ({toast.timestamp})</div>
              <div className="text-[11px] truncate text-gray-900">{toast.textSnippet}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

### 12.7. `src/apps/pulse/components/UserProfileHeader.tsx`
```tsx
import React, { useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { BuddyPresenceStatus } from '../../../engine/types';
import { ChevronDown, Edit3, Circle } from 'lucide-react';

interface Props {
  onOpenAwayEditor: () => void;
  playerStatus: BuddyPresenceStatus;
  onStatusChange: (status: BuddyPresenceStatus) => void;
  customAwayMessage: string;
}

export const UserProfileHeader: React.FC<Props> = ({
  onOpenAwayEditor,
  playerStatus,
  onStatusChange,
  customAwayMessage,
}) => {
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const isOrion60 = osVersion === 'Orion_6.0';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getStatusColor = (status: BuddyPresenceStatus) => {
    switch (status) {
      case 'online':
        return 'text-green-600 fill-green-600';
      case 'away':
        return 'text-amber-500 fill-amber-500';
      case 'busy':
        return 'text-red-600 fill-red-600';
      case 'offline':
        return 'text-gray-400 fill-gray-400';
    }
  };

  const getStatusLabel = (status: BuddyPresenceStatus) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Appear Offline';
    }
  };

  return (
    <div
      className={`p-2 border-b select-none ${
        isOrion60
          ? 'bg-gradient-to-b from-[#f0f4fc] to-[#dbe7fb] border-[#7f9db9]'
          : 'bg-[#dfdfdf] border-[#808080]'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Avatar Pane (Orion 6.0) */}
        {isOrion60 && (
          <div className="relative group cursor-pointer flex-shrink-0">
            <div className="w-10 h-10 rounded border border-[#7f9db9] overflow-hidden bg-white shadow-xs">
              <img
                src="/avatars/player_default.png"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                alt="My Display Picture"
                className="w-full h-full object-cover"
              />
              <div className="w-full h-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                ME
              </div>
            </div>
          </div>
        )}

        {/* User Handle & Status Dropdown */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[12px] text-gray-900 truncate">wanderer06</span>
            <button
              onClick={onOpenAwayEditor}
              title="Edit Custom Away Message"
              className="text-gray-600 hover:text-black p-0.5 rounded"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>

          {/* Status Dropdown Trigger */}
          <div className="relative mt-0.5">
            <button
              onClick={() => setIsDropdownOpen((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-800 hover:bg-white/40 px-1 py-0.5 rounded w-full text-left"
            >
              <Circle className={`w-2.5 h-2.5 ${getStatusColor(playerStatus)}`} />
              <span className="truncate">{getStatusLabel(playerStatus)}</span>
              <ChevronDown className="w-3 h-3 ml-auto opacity-70" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 orion-outset bg-white shadow-lg py-1 min-w-[130px] text-black">
                {(['online', 'away', 'busy', 'offline'] as BuddyPresenceStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onStatusChange(st);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[11px] hover:bg-[#000080] hover:text-white flex items-center gap-1.5"
                  >
                    <Circle className={`w-2.5 h-2.5 ${getStatusColor(st)}`} />
                    <span>{getStatusLabel(st)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Away Message Subtitle */}
          {playerStatus === 'away' && customAwayMessage && (
            <div className="text-[10px] text-amber-800 italic truncate mt-0.5" title={customAwayMessage}>
              "{customAwayMessage}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### 12.8. `src/apps/pulse/components/AwayMessageEditor.tsx`
```tsx
import React, { useState } from 'react';
import { AWAY_MESSAGE_PRESETS } from '../data/awayMessagePresets';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMessage: string;
  onSaveAndActivate: (msg: string) => void;
}

export const AwayMessageEditor: React.FC<Props> = ({
  isOpen,
  onClose,
  currentMessage,
  onSaveAndActivate,
}) => {
  const [messageText, setMessageText] = useState(currentMessage || '');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  if (!isOpen) return null;

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = AWAY_MESSAGE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setMessageText(preset.text);
    }
  };

  const handleSave = () => {
    onSaveAndActivate(messageText.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="orion-outset bg-[#c0c0c0] w-[360px] text-black shadow-2xl p-1 flex flex-col gap-2 font-pixel">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 flex items-center justify-between font-bold text-[11px]">
          <span>Custom Away Message Editor</span>
          <button onClick={onClose} className="hover:bg-red-600 px-1">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <div className="p-2 flex flex-col gap-2">
          <label className="text-[11px] font-semibold">Choose from Presets:</label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleApplyPreset(e.target.value)}
            className="orion-input w-full text-[11px]"
          >
            <option value="">-- Select a Preset Away Message --</option>
            {AWAY_MESSAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <label className="text-[11px] font-semibold mt-1">Or Compose Custom Away Message:</label>
          <textarea
            rows={4}
            value={messageText}
            maxLength={400}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your status, quote, or lyrics here..."
            className="orion-input w-full resize-none text-[11px] font-mono leading-relaxed"
          />

          <div className="flex justify-between items-center text-[10px] text-gray-600">
            <span>{messageText.length} / 400 characters</span>
            <span>Automatically sets status to Away</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 p-2 border-t border-gray-400">
          <button
            onClick={onClose}
            className="orion-button px-3 py-1 text-[11px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="orion-button px-3 py-1 font-bold text-[11px] bg-[#000080] text-white flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Set Away</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### 12.9. `src/apps/pulse/components/BuddyListWindow.tsx`
```tsx
import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { BuddyPresenceStatus } from '../../../engine/types';
import { UserProfileHeader } from './UserProfileHeader';
import { BuddyGroup } from './BuddyGroup';
import { AwayMessageEditor } from './AwayMessageEditor';
import { Search } from 'lucide-react';

interface Props {
  onSelectBuddy: (buddyId: string) => void;
  activeBuddyId: string | null;
}

export const BuddyListWindow: React.FC<Props> = ({ onSelectBuddy, activeBuddyId }) => {
  const engine = useSimulationStore((s) => s.engine);
  const social = useSimulationStore((s) => s.state.social);
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const isOrion60 = osVersion === 'Orion_6.0';

  const [playerStatus, setPlayerStatus] = useState<BuddyPresenceStatus>('online');
  const [customAwayMsg, setCustomAwayMsg] = useState('');
  const [isAwayEditorOpen, setIsAwayEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const buddiesList = useMemo(() => {
    return ['ryan', 'maya', 'nora', 'henderson']
      .map((id) => engine.getBuddy(id))
      .filter((b): b is NonNullable<typeof b> => !!b);
  }, [engine]);

  // Group contacts by presence status
  const groupedBuddies = useMemo(() => {
    const groups: Record<BuddyPresenceStatus, typeof buddiesList> = {
      online: [],
      away: [],
      busy: [],
      offline: [],
    };

    buddiesList.forEach((b) => {
      if (
        searchQuery &&
        !b.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !b.handle.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return;
      }
      const pres = social.presence[b.id]?.status || 'offline';
      groups[pres].push(b);
    });

    return groups;
  }, [buddiesList, social.presence, searchQuery]);

  const handleStatusChange = (status: BuddyPresenceStatus) => {
    setPlayerStatus(status);
    if (status !== 'away') {
      setCustomAwayMsg('');
    }
  };

  const handleSaveAway = (msg: string) => {
    setCustomAwayMsg(msg);
    setPlayerStatus('away');
  };

  return (
    <div className="flex flex-col h-full bg-white font-pixel select-none">
      {/* 1. Player Profile Header */}
      <UserProfileHeader
        onOpenAwayEditor={() => setIsAwayEditorOpen(true)}
        playerStatus={playerStatus}
        onStatusChange={handleStatusChange}
        customAwayMessage={customAwayMsg}
      />

      {/* 2. Contact Search Bar */}
      <div className="p-1.5 bg-[#ece9d8] border-b border-[#aca899] flex items-center gap-1">
        <Search className="w-3.5 h-3.5 text-gray-500 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts..."
          className="orion-input w-full text-[11px] py-0.5"
        />
      </div>

      {/* 3. Collapsible Buddy Groups */}
      <div className="flex-1 overflow-y-auto orion-scrollbar p-1 flex flex-col gap-1">
        <BuddyGroup
          title="Online"
          status="online"
          buddies={groupedBuddies.online}
          onSelectBuddy={onSelectBuddy}
          activeBuddyId={activeBuddyId}
          isOrion60={isOrion60}
        />
        <BuddyGroup
          title="Away"
          status="away"
          buddies={groupedBuddies.away}
          onSelectBuddy={onSelectBuddy}
          activeBuddyId={activeBuddyId}
          isOrion60={isOrion60}
        />
        <BuddyGroup
          title="Busy"
          status="busy"
          buddies={groupedBuddies.busy}
          onSelectBuddy={onSelectBuddy}
          activeBuddyId={activeBuddyId}
          isOrion60={isOrion60}
        />
        <BuddyGroup
          title="Offline"
          status="offline"
          buddies={groupedBuddies.offline}
          onSelectBuddy={onSelectBuddy}
          activeBuddyId={activeBuddyId}
          isOrion60={isOrion60}
        />
      </div>

      {/* 4. Away Message Editor Modal */}
      <AwayMessageEditor
        isOpen={isAwayEditorOpen}
        onClose={() => setIsAwayEditorOpen(false)}
        currentMessage={customAwayMsg}
        onSaveAndActivate={handleSaveAway}
      />
    </div>
  );
};
```

---

### 12.10. `src/apps/pulse/components/ChatWindow.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { ChatTabHeader } from './ChatTabHeader';
import { MessageHistoryView } from './MessageHistoryView';
import { MessageInputBar } from './MessageInputBar';
import { AuthoredResponseMenu } from './AuthoredResponseMenu';
import { useSimulatedTyping } from '../hooks/useSimulatedTyping';
import { PulseFontFormatting } from '../types';
import { Bell } from 'lucide-react';
import { soundManager } from '../../../audio/SoundManager';

interface Props {
  activeBuddyId: string;
  openBuddyIds: string[];
  onSelectTab: (buddyId: string) => void;
  onCloseTab: (buddyId: string) => void;
}

export const ChatWindow: React.FC<Props> = ({
  activeBuddyId,
  openBuddyIds,
  onSelectTab,
  onCloseTab,
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const social = useSimulationStore((s) => s.state.social);
  const osVersion = useSimulationStore((s) => s.state.hardware.osVersion);
  const isOrion60 = osVersion === 'Orion_6.0';

  const buddy = engine.getBuddy(activeBuddyId);
  const presence = social.presence[activeBuddyId] || { status: 'offline', awayMessage: '' };
  const conversationMessages = social.conversations[activeBuddyId] || [];

  const { typingState, selectPlayerChoice } = useSimulatedTyping(activeBuddyId);

  const [formatting, setFormatting] = useState<PulseFontFormatting>({
    fontFamily: 'Tahoma',
    fontSize: '11px',
    color: '#000080',
    isBold: false,
    isItalic: false,
    isUnderline: false,
  });

  const [isNudging, setIsNudging] = useState(false);

  const handleSendNudge = () => {
    if (!isOrion60 || isNudging) return;
    setIsNudging(true);
    soundManager.play('error');
    engine.social.sendMessage(
      activeBuddyId,
      'player',
      activeBuddyId,
      '--- You sent a Nudge! ---',
      engine.clock.getTotalMinutes(),
      false,
      ['nudge']
    );
    engine.notifySubscribers();
    setTimeout(() => setIsNudging(false), 600);
  };

  const handleSendMessage = (text: string) => {
    engine.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId: activeBuddyId,
      text,
    });
    soundManager.play('im_send');
  };

  return (
    <div
      className={`flex flex-col h-full bg-white select-none transition-transform ${
        isNudging ? 'animate-shake' : ''
      }`}
    >
      {/* 1. Tab Bar */}
      <ChatTabHeader
        activeBuddyId={activeBuddyId}
        openBuddyIds={openBuddyIds}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />

      {/* 2. Buddy Header Banner */}
      <div className="p-2 bg-[#ece9d8] border-b border-[#aca899] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOrion60 && (
            <div className="w-8 h-8 rounded border border-gray-400 bg-white overflow-hidden">
              <img
                src={`/avatars/${activeBuddyId}.png`}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                alt={buddy?.displayName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[12px] text-black">{buddy?.displayName}</span>
              <span className="text-[10px] text-gray-600">({buddy?.handle})</span>
            </div>
            <div className="text-[10px] text-gray-700 truncate max-w-xs italic">
              {presence.awayMessage || presence.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Orion 6.0 Nudge Button */}
        {isOrion60 && (
          <button
            onClick={handleSendNudge}
            title="Send Nudge"
            className="orion-button text-[10px] px-2 py-1 flex items-center gap-1"
          >
            <Bell className="w-3 h-3 text-amber-600" />
            <span>Nudge</span>
          </button>
        )}
      </div>

      {/* 3. Message History Log */}
      <MessageHistoryView
        messages={conversationMessages}
        buddy={buddy}
        isOrion60={isOrion60}
        typingIndicatorText={
          typingState.isTyping && typingState.activeBuddyId === activeBuddyId
            ? typingState.typingIndicatorText
            : ''
        }
      />

      {/* 4. Authored Choice Overlay */}
      {typingState.availableChoices.length > 0 && (
        <AuthoredResponseMenu
          choices={typingState.availableChoices}
          onSelectChoice={(choice) => selectPlayerChoice(choice, activeBuddyId)}
        />
      )}

      {/* 5. Input Bar with Formatting Toolbar */}
      <MessageInputBar
        onSendMessage={handleSendMessage}
        formatting={formatting}
        onFormattingChange={setFormatting}
        isOrion60={isOrion60}
      />
    </div>
  );
};
```

---

### 12.11. `src/apps/pulse/PulseMessengerApp.tsx` (Root App Entry Point)
```tsx
import React, { useState } from 'react';
import { BuddyListWindow } from './components/BuddyListWindow';
import { ChatWindow } from './components/ChatWindow';
import { PulseNotificationToast } from './components/PulseNotificationToast';
import { usePulseAudio } from './hooks/usePulseAudio';
import { usePulseNotifications } from './hooks/usePulseNotifications';

export const PulseMessengerApp: React.FC = () => {
  const [openBuddyChatIds, setOpenBuddyChatIds] = useState<string[]>(['maya']);
  const [activeBuddyId, setActiveBuddyId] = useState<string | null>('maya');

  // Initialize background sound effects and desktop notifications
  usePulseAudio();
  const { activeToasts, handleToastClick, dismissToast } = usePulseNotifications(activeBuddyId);

  const handleSelectBuddy = (buddyId: string) => {
    if (!openBuddyChatIds.includes(buddyId)) {
      setOpenBuddyChatIds((prev) => [...prev, buddyId]);
    }
    setActiveBuddyId(buddyId);
  };

  const handleCloseTab = (buddyId: string) => {
    const remaining = openBuddyChatIds.filter((id) => id !== buddyId);
    setOpenBuddyChatIds(remaining);
    if (activeBuddyId === buddyId) {
      setActiveBuddyId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  };

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#ece9d8] select-none font-pixel">
      {/* 1. Left Pane: Buddy List (200px wide) */}
      <div className="w-52 border-r border-[#808080] flex-shrink-0 h-full flex flex-col">
        <BuddyListWindow onSelectBuddy={handleSelectBuddy} activeBuddyId={activeBuddyId} />
      </div>

      {/* 2. Right Pane: Active Chat Window or Empty State */}
      <div className="flex-1 h-full flex flex-col bg-white">
        {activeBuddyId ? (
          <ChatWindow
            activeBuddyId={activeBuddyId}
            openBuddyIds={openBuddyChatIds}
            onSelectTab={setActiveBuddyId}
            onCloseTab={handleCloseTab}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2 p-6 text-center">
            <div className="text-3xl">💬</div>
            <div className="font-bold text-gray-700">No active conversation</div>
            <div>Double-click any contact in your Buddy List to open a chat.</div>
          </div>
        )}
      </div>

      {/* 3. Desktop Background Notification Toasts */}
      <PulseNotificationToast
        toasts={activeToasts}
        onToastClick={(toast) => handleToastClick(toast, handleSelectBuddy)}
        onDismiss={dismissToast}
      />
    </div>
  );
};
```

---

## 13. Verification Strategy & Test Scenarios

### Automated Vitest Suite (`tests/unit/PulseMessenger.test.ts`)
1. **Buddy List Presence Grouping**:
   - Verify that when clock advances, buddies are partitioned correctly into Online, Away, Busy, and Offline.
   - Verify status messages match authored schedules (e.g. Maya coffee status at minute 1050).
2. **Away Message Activation**:
   - Verify that setting a custom away message automatically sets player presence to `away`.
   - Verify that sending a message clears player away status.
3. **Simulated Cadence Engine**:
   - Verify that `typingSpeedWpm` creates deterministic typing duration windows.
   - Verify that multi-message bursts dispatch `im_recv` events sequentially.
4. **Authored Choices & Semantic Actions**:
   - Verify selecting an authored choice emits `SOCIAL_APPLY_ACTION` and mutates the 5 relationship dimensions.
5. **Orion 4.8 vs 6.0 Feature Gating**:
   - Verify that avatar elements, rich emoticon palette, and Nudge button are gated by `osVersion === 'Orion_6.0'`.
6. **Sound Effects Triggering**:
   - Verify `door_open` triggers on offline -> online transitions.
   - Verify `door_slam` triggers on online -> offline transitions.

---

This blueprint is complete, exhaustive, and fully prepared for implementation.
