// src/world/RoomCanvas.ts

import {
  TimeOfDay,
  WeatherType,
  RoomHotspotId,
  Particle,
  RainDrop,
  WindowCondensationDrop,
} from './types';
import { ROOM_HOTSPOTS } from './data/roomInteractables';
import type { OsVersion } from '../engine/types';

export interface RoomCanvasOptions {
  canvas: HTMLCanvasElement;
  day: number;
  hour: number;
  minute: number;
  weather?: WeatherType;
  osVersion?: OsVersion;
  hasActiveDownloads?: boolean;
  onHotspotClick?: (id: RoomHotspotId) => void;
  onHotspotHover?: (id: RoomHotspotId | null) => void;
}

export function getTimeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 2) return 'night';
  return 'late_night';
}

export class RoomCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  // Simulation parameters
  public day = 1;
  public hour = 8;
  public minute = 0;
  public weather: WeatherType = 'clear';
  public osVersion: OsVersion = 'Orion_4.8';
  public hasActiveDownloads = false;

  // Interaction
  public hoveredHotspot: RoomHotspotId | null = null;
  private onHotspotClick?: (id: RoomHotspotId) => void;
  private onHotspotHover?: (id: RoomHotspotId | null) => void;

  // Particle systems
  private dustMotes: Particle[] = [];
  private kettleSteam: Particle[] = [];
  private rainDrops: RainDrop[] = [];
  private condensationDrops: WindowCondensationDrop[] = [];
  private lastTime = 0;
  private carPosition = -0.2; // 0..1 relative window street x

  constructor(options: RoomCanvasOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not acquire 2D canvas context');
    this.ctx = context;

    this.day = options.day;
    this.hour = options.hour;
    this.minute = options.minute;
    this.weather = options.weather || 'clear';
    this.osVersion = options.osVersion || 'Orion_4.8';
    this.hasActiveDownloads = !!options.hasActiveDownloads;
    this.onHotspotClick = options.onHotspotClick;
    this.onHotspotHover = options.onHotspotHover;

    this.initParticles();
    this.attachEventListeners();
    this.startLoop();
  }

  public updateState(params: {
    day: number;
    hour: number;
    minute: number;
    weather?: WeatherType;
    osVersion?: OsVersion;
    hasActiveDownloads?: boolean;
  }) {
    this.day = params.day;
    this.hour = params.hour;
    this.minute = params.minute;
    if (params.weather) this.weather = params.weather;
    if (params.osVersion) this.osVersion = params.osVersion;
    if (params.hasActiveDownloads !== undefined) this.hasActiveDownloads = params.hasActiveDownloads;
  }

  private initParticles() {
    // 25 Sunbeam dust motes
    this.dustMotes = [];
    for (let i = 0; i < 25; i++) {
      this.dustMotes.push({
        x: 0.25 + Math.random() * 0.45,
        y: 0.2 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.015,
        vy: (Math.random() - 0.5) * 0.015,
        size: 1.5 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.5,
        maxAlpha: 0.4 + Math.random() * 0.4,
      });
    }

    // 15 Kettle steam particles
    this.kettleSteam = [];
    for (let i = 0; i < 15; i++) {
      this.kettleSteam.push({
        x: 0.46 + (Math.random() - 0.5) * 0.02,
        y: 0.53 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.01,
        vy: -0.04 - Math.random() * 0.03,
        size: 2 + Math.random() * 4,
        alpha: 0,
        maxAlpha: 0.35 + Math.random() * 0.25,
        life: Math.random() * 1.5,
        maxLife: 1.5 + Math.random() * 1.0,
      });
    }

    // 60 Rain streaks
    this.rainDrops = [];
    for (let i = 0; i < 60; i++) {
      this.rainDrops.push({
        x: 0.39 + Math.random() * 0.24,
        y: 0.11 + Math.random() * 0.36,
        vy: 0.8 + Math.random() * 0.6,
        length: 8 + Math.random() * 10,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }

    // 10 Condensation droplets
    this.condensationDrops = [];
    for (let i = 0; i < 10; i++) {
      this.condensationDrops.push({
        x: 0.41 + Math.random() * 0.20,
        y: 0.13 + Math.random() * 0.30,
        vy: 0.005 + Math.random() * 0.015,
        size: 1.5 + Math.random() * 2,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
  }

  private attachEventListeners() {
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('click', this.handleClick);
  }

  private removeEventListeners() {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('click', this.handleClick);
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to virtual 0..1 coordinates
    const normX = clientX / rect.width;
    const normY = clientY / rect.height;

    // Check hit test
    const found = ROOM_HOTSPOTS.find(
      (h) =>
        normX >= h.x &&
        normX <= h.x + h.w &&
        normY >= h.y &&
        normY <= h.y + h.h
    );

    const newHover = found ? found.id : null;
    if (newHover !== this.hoveredHotspot) {
      this.hoveredHotspot = newHover;
      this.canvas.style.cursor = newHover ? 'pointer' : 'default';
      this.onHotspotHover?.(newHover);
    }
  };

  private handleMouseLeave = () => {
    this.hoveredHotspot = null;
    this.canvas.style.cursor = 'default';
    this.onHotspotHover?.(null);
  };

  private handleClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    const clicked = ROOM_HOTSPOTS.find(
      (h) =>
        normX >= h.x &&
        normX <= h.x + h.w &&
        normY >= h.y &&
        normY <= h.y + h.h
    );

    if (clicked) {
      this.onHotspotClick?.(clicked.id);
    }
  };

  private startLoop() {
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (this.isDestroyed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt, now / 1000);
      this.render(now / 1000);

      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  private update(dt: number, timeSec: number) {
    const timeOfDay = getTimeOfDayFromHour(this.hour);

    // Update car position
    this.carPosition += dt * 0.06;
    if (this.carPosition > 1.3) {
      this.carPosition = -0.3;
    }

    // Update Dust Motes
    if (timeOfDay === 'morning' || timeOfDay === 'day') {
      for (const p of this.dustMotes) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha = (Math.sin(timeSec * 2 + p.size * 10) * 0.5 + 0.5) * p.maxAlpha;

        if (p.x < 0.25) p.x = 0.70;
        if (p.x > 0.70) p.x = 0.25;
        if (p.y < 0.20) p.y = 0.80;
        if (p.y > 0.80) p.y = 0.20;
      }
    }

    // Update Kettle Steam
    for (const p of this.kettleSteam) {
      p.life = (p.life ?? 0) + dt;
      if (p.life > (p.maxLife ?? 2)) {
        p.life = 0;
        p.x = 0.46 + (Math.random() - 0.5) * 0.02;
        p.y = 0.53 + Math.random() * 0.02;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const progress = (p.life ?? 0) / (p.maxLife ?? 2);
      p.alpha = Math.sin(progress * Math.PI) * p.maxAlpha;
      p.size = (2 + progress * 8);
    }

    // Update Rain
    if (this.weather === 'rain') {
      for (const r of this.rainDrops) {
        r.y += r.vy * dt * 2.5;
        r.x += dt * 0.2; // slight wind
        if (r.y > 0.46) {
          r.y = 0.11;
          r.x = 0.39 + Math.random() * 0.24;
        }
      }
      for (const c of this.condensationDrops) {
        c.y += c.vy * dt;
        if (c.y > 0.45) {
          c.y = 0.13;
          c.x = 0.41 + Math.random() * 0.20;
        }
      }
    }
  }

  private render(timeSec: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, w, h);

    const timeOfDay = getTimeOfDayFromHour(this.hour);

    // Strict 8-Layer Rendering Pipeline
    this.drawLayer1Sky(w, h, timeOfDay, this.weather, timeSec);
    this.drawLayer2Street(w, h, timeOfDay, timeSec);
    this.drawLayer3Architecture(w, h, timeOfDay);
    this.drawLayer4Furniture(w, h);
    this.drawLayer5HotspotsAndClutter(w, h, timeSec);
    this.drawLayer6Particles(w, h, timeOfDay, timeSec);
    this.drawLayer7Lighting(w, h, timeOfDay);
    this.drawLayer8HotspotUI(w, h, timeSec);

    this.ctx.restore();
  }

  // ==========================================
  // LAYER 1: Sky & Far Exterior (Window View)
  // ==========================================
  private drawLayer1Sky(w: number, h: number, tod: TimeOfDay, weather: WeatherType, timeSec: number) {
    const ctx = this.ctx;
    const winX = w * 0.40;
    const winY = h * 0.12;
    const winW = w * 0.22;
    const winH = h * 0.34;

    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();

    // Sky Gradient
    const skyGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
    if (weather === 'rain') {
      skyGrad.addColorStop(0, '#3a4454');
      skyGrad.addColorStop(0.6, '#4e5d6c');
      skyGrad.addColorStop(1, '#627282');
    } else {
      switch (tod) {
        case 'morning':
          skyGrad.addColorStop(0, '#5a73b5');
          skyGrad.addColorStop(0.5, '#f79d65');
          skyGrad.addColorStop(1, '#fcd5ce');
          break;
        case 'day':
          skyGrad.addColorStop(0, '#4a90e2');
          skyGrad.addColorStop(0.7, '#87ceeb');
          skyGrad.addColorStop(1, '#d8eefc');
          break;
        case 'evening':
          skyGrad.addColorStop(0, '#2c1654');
          skyGrad.addColorStop(0.4, '#c33764');
          skyGrad.addColorStop(0.8, '#f7797d');
          skyGrad.addColorStop(1, '#fbd786');
          break;
        case 'night':
          skyGrad.addColorStop(0, '#060b1e');
          skyGrad.addColorStop(0.7, '#101c3d');
          skyGrad.addColorStop(1, '#1b2d5a');
          break;
        case 'late_night':
          skyGrad.addColorStop(0, '#02040a');
          skyGrad.addColorStop(0.8, '#080e1d');
          skyGrad.addColorStop(1, '#0e1628');
          break;
      }
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Distant city skyline silhouettes
    ctx.fillStyle = tod === 'day' ? '#5a6b7c' : '#0a101d';
    ctx.fillRect(winX + winW * 0.05, winY + winH * 0.45, winW * 0.15, winH * 0.55);
    ctx.fillRect(winX + winW * 0.22, winY + winH * 0.35, winW * 0.20, winH * 0.65);
    ctx.fillRect(winX + winW * 0.45, winY + winH * 0.50, winW * 0.18, winH * 0.50);
    ctx.fillRect(winX + winW * 0.65, winY + winH * 0.40, winW * 0.28, winH * 0.60);

    // Red blinking radio tower beacon
    const beaconAlpha = (Math.sin(timeSec * 3.5) * 0.5 + 0.5) > 0.4 ? 1.0 : 0.1;
    ctx.fillStyle = `rgba(255, 30, 30, ${beaconAlpha})`;
    ctx.beginPath();
    ctx.arc(winX + winW * 0.32, winY + winH * 0.33, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ==========================================
  // LAYER 2: Street Midground (Through Window)
  // ==========================================
  private drawLayer2Street(w: number, h: number, tod: TimeOfDay, timeSec: number) {
    const ctx = this.ctx;
    const winX = w * 0.40;
    const winY = h * 0.12;
    const winW = w * 0.22;
    const winH = h * 0.34;

    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();

    // Road asphalt
    ctx.fillStyle = '#1c2128';
    ctx.fillRect(winX, winY + winH * 0.70, winW, winH * 0.30);

    // Sidewalk curb
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(winX, winY + winH * 0.66, winW, winH * 0.04);

    // Sodium Streetlight (Left of window)
    const poleX = winX + winW * 0.18;
    const poleY = winY + winH * 0.52;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleX, winY + winH * 0.70);
    ctx.lineTo(poleX, poleY);
    ctx.lineTo(poleX + 8, poleY - 4);
    ctx.stroke();

    // Streetlight light cone (Active in evening, night, late_night)
    if (tod === 'evening' || tod === 'night' || tod === 'late_night') {
      const lampGlow = ctx.createRadialGradient(poleX + 8, poleY - 4, 1, poleX + 8, poleY + 30, 45);
      lampGlow.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
      lampGlow.addColorStop(0.4, 'rgba(255, 180, 70, 0.25)');
      lampGlow.addColorStop(1, 'rgba(255, 180, 70, 0)');
      ctx.fillStyle = lampGlow;
      ctx.beginPath();
      ctx.arc(poleX + 8, poleY + 15, 45, 0, Math.PI * 2);
      ctx.fill();
    }

    // 24H Diner / Motel Neon Sign (Right side of window view)
    const signX = winX + winW * 0.72;
    const signY = winY + winH * 0.52;
    const neonFlicker = Math.sin(timeSec * 7) > -0.9 ? 1.0 : 0.3;
    ctx.fillStyle = `rgba(255, 60, 140, ${neonFlicker * 0.85})`;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('24H DINER', signX, signY);
    ctx.fillStyle = `rgba(0, 220, 255, ${neonFlicker * 0.75})`;
    ctx.fillText('MOTEL', signX + 4, signY + 10);

    // Ambient Traffic Car (moving horizontally)
    const carX = winX + winW * this.carPosition;
    const carY = winY + winH * 0.74;
    ctx.fillStyle = '#8b2635'; // maroon body
    ctx.fillRect(carX, carY, 24, 7);
    ctx.fillStyle = '#111827'; // wheels
    ctx.beginPath();
    ctx.arc(carX + 4, carY + 7, 2, 0, Math.PI * 2);
    ctx.arc(carX + 20, carY + 7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Car Headlights / Taillights
    if (tod !== 'day') {
      // Headlights pointing right
      const lightBeam = ctx.createLinearGradient(carX + 24, carY + 3, carX + 50, carY + 3);
      lightBeam.addColorStop(0, 'rgba(255, 255, 220, 0.7)');
      lightBeam.addColorStop(1, 'rgba(255, 255, 220, 0)');
      ctx.fillStyle = lightBeam;
      ctx.beginPath();
      ctx.moveTo(carX + 24, carY + 2);
      ctx.lineTo(carX + 50, carY - 4);
      ctx.lineTo(carX + 50, carY + 10);
      ctx.lineTo(carX + 24, carY + 5);
      ctx.fill();

      // Taillight red glow
      ctx.fillStyle = 'rgba(255, 20, 20, 0.8)';
      ctx.fillRect(carX - 1, carY + 2, 2, 2);
    }

    ctx.restore();
  }

  // ==========================================
  // LAYER 3: Room Architecture & Structural Interior
  // ==========================================
  private drawLayer3Architecture(w: number, h: number, tod: TimeOfDay) {
    const ctx = this.ctx;

    // Motel Wall Base (Retro beige/olive)
    const wallColor = tod === 'night' || tod === 'late_night' ? '#262923' : '#4d5345';
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, w, h * 0.75);

    // Striped Wallpaper Subtle Lines
    ctx.strokeStyle = tod === 'night' || tod === 'late_night' ? '#20231d' : '#454a3d';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h * 0.75);
      ctx.stroke();
    }

    // Floor Carpet (vintage patterned brown/burgundy carpet)
    const carpetGrad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    carpetGrad.addColorStop(0, tod === 'night' || tod === 'late_night' ? '#181210' : '#33231e');
    carpetGrad.addColorStop(1, tod === 'night' || tod === 'late_night' ? '#0f0a09' : '#221612');
    ctx.fillStyle = carpetGrad;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);

    // Wood Baseboard
    ctx.fillStyle = '#2b1b14';
    ctx.fillRect(0, h * 0.74, w, h * 0.02);
    ctx.fillStyle = '#3d271d';
    ctx.fillRect(0, h * 0.74, w, 2);

    // Left Door (Hallway Door to Room 104)
    const doorX = w * 0.02;
    const doorY = h * 0.28;
    const doorW = w * 0.09;
    const doorH = h * 0.46;
    ctx.fillStyle = '#1e140f'; // door frame
    ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
    ctx.fillStyle = '#442d20'; // wood door
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Room 104 Brass Placard
    ctx.fillStyle = '#c5a059';
    ctx.fillRect(doorX + doorW * 0.25, doorY + doorH * 0.20, doorW * 0.5, 12);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('104', doorX + doorW * 0.5, doorY + doorH * 0.20 + 9);
    ctx.textAlign = 'left';

    // Brass Deadbolt / Doorknob
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(doorX + doorW * 0.82, doorY + doorH * 0.55, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Right Bathroom Doorway
    const bathX = w * 0.86;
    const bathY = h * 0.30;
    const bathW = w * 0.11;
    const bathH = h * 0.44;
    ctx.fillStyle = '#1e140f';
    ctx.fillRect(bathX - 2, bathY - 2, bathW + 4, bathH + 2);
    ctx.fillStyle = '#2a3b32'; // cool bathroom tile interior
    ctx.fillRect(bathX, bathY, bathW, bathH);

    // Towel rack visible in bathroom
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(bathX + bathW * 0.2, bathY + bathH * 0.35, bathW * 0.6, 2);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(bathX + bathW * 0.3, bathY + bathH * 0.36, bathW * 0.4, 22);

    // Center Window Frame
    const winX = w * 0.40;
    const winY = h * 0.12;
    const winW = w * 0.22;
    const winH = h * 0.34;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2b1b14';
    ctx.strokeRect(winX, winY, winW, winH);

    // Window Cross Bars
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.45);
    ctx.lineTo(winX + winW, winY + winH * 0.45);
    ctx.stroke();

    // Wood Window Sill
    ctx.fillStyle = '#3a2318';
    ctx.fillRect(winX - 6, winY + winH, winW + 12, 6);

    // Wall AC / Heating Unit Under Window
    const acX = winX + winW * 0.10;
    const acY = winY + winH + 12;
    const acW = winW * 0.80;
    const acH = h * 0.12;
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(acX, acY, acW, acH);
    ctx.fillStyle = '#4b5563';
    for (let l = 0; l < 6; l++) {
      ctx.fillRect(acX + 6, acY + 6 + l * 6, acW - 12, 2);
    }
  }

  // ==========================================
  // LAYER 4: Furniture Layout
  // ==========================================
  private drawLayer4Furniture(w: number, h: number) {
    const ctx = this.ctx;

    // --- Motel Bed (Right side) ---
    const bedX = w * 0.65;
    const bedY = h * 0.52;
    const bedW = w * 0.20;
    const bedH = h * 0.36;

    // Dark wood headboard
    ctx.fillStyle = '#2b1b14';
    ctx.fillRect(bedX, bedY - 24, bedW, 26);

    // Bed Mattress & Striped Spread
    ctx.fillStyle = '#4a2e2b'; // deep maroon quilt
    ctx.fillRect(bedX, bedY, bedW, bedH);
    // Quilt stripe patterns
    ctx.fillStyle = '#6b443f';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(bedX + 4, bedY + 8 + i * 18, bedW - 8, 8);
    }

    // White Pillow
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.roundRect(bedX + 8, bedY + 4, bedW - 16, 18, 4);
    ctx.fill();

    // --- Bedside Nightstand & LED Clock ---
    const standX = bedX - w * 0.055;
    const standY = h * 0.62;
    const standW = w * 0.05;
    const standH = h * 0.22;
    ctx.fillStyle = '#3a2318';
    ctx.fillRect(standX, standY, standW, standH);

    // Retro 7-Segment Red LED Alarm Clock
    const clockX = standX + 4;
    const clockY = standY - 14;
    ctx.fillStyle = '#111827';
    ctx.fillRect(clockX, clockY, standW - 8, 14);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px monospace';
    const timeStr = `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
    ctx.fillText(timeStr, clockX + 3, clockY + 10);

    // --- Kitchenette Counter (Center) ---
    const countX = w * 0.41;
    const countY = h * 0.56;
    const countW = w * 0.14;
    const countH = h * 0.28;
    ctx.fillStyle = '#2e383f'; // dark laminate countertop
    ctx.fillRect(countX, countY, countW, countH);
    ctx.fillStyle = '#d1d5db'; // metal edge strip
    ctx.fillRect(countX, countY, countW, 3);

    // Electric Kettle on counter
    const kettleX = countX + 18;
    const kettleY = countY - 22;
    ctx.fillStyle = '#4b5563'; // kettle base
    ctx.fillRect(kettleX - 2, kettleY + 20, 18, 3);
    ctx.fillStyle = '#e5e7eb'; // white/silver kettle body
    ctx.beginPath();
    ctx.ellipse(kettleX + 7, kettleY + 10, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Kettle handle & spout
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kettleX + 14, kettleY + 10, 5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Ceramic Mug beside kettle
    const mugX = kettleX + 26;
    const mugY = countY - 12;
    ctx.fillStyle = '#3b82f6'; // cobalt blue mug
    ctx.fillRect(mugX, mugY, 10, 12);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(mugX + 2, mugY + 2, 6, 2);

    // --- PC Desk (Left side) ---
    const deskX = w * 0.12;
    const deskY = h * 0.50;
    const deskW = w * 0.26;
    const deskH = h * 0.38;

    // Wood laminate desk surface
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(deskX, deskY, deskW, deskH);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(deskX, deskY, deskW, 4);

    // Keyboard tray
    ctx.fillStyle = '#212121';
    ctx.fillRect(deskX + 12, deskY + 18, deskW - 40, 6);

    // Office Swivel Chair (Backrest & cushion)
    const chairX = deskX + deskW * 0.35;
    const chairY = deskY + 24;
    ctx.fillStyle = '#1f2937'; // charcoal fabric
    ctx.beginPath();
    ctx.roundRect(chairX, chairY, 32, 48, 6);
    ctx.fill();
  }

  // ==========================================
  // LAYER 5: Interactive Hotspots & Clutter Progression
  // ==========================================
  private drawLayer5HotspotsAndClutter(w: number, h: number, timeSec: number) {
    const ctx = this.ctx;
    const deskX = w * 0.12;
    const deskY = h * 0.50;

    // --- CRT Monitor ---
    const monX = deskX + 22;
    const monY = deskY - 50;
    const monW = 54;
    const monH = 46;

    // Beige Monitor Casing
    ctx.fillStyle = '#d4cebe';
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 4);
    ctx.fill();
    ctx.strokeStyle = '#a8a29e';
    ctx.stroke();

    // Curved CRT Screen Face
    const screenX = monX + 4;
    const screenY = monY + 4;
    const screenW = monW - 8;
    const screenH = monH - 12;

    // Screen content color — heavy OS: each family has its own tint
    const isOrion70 = String(this.osVersion).includes('7.0');
    const isOrion6b = String(this.osVersion).includes('6.');
    const isOrion50 = String(this.osVersion).includes('5.');
    let screenColor = '#008080'; // 4.8 teal
    let taskbarColor = '#c0c0c0';
    if (isOrion70) { screenColor = '#0f1f4d'; taskbarColor = '#1a2a6a'; } // deep glossy navy
    else if (isOrion6b) { screenColor = '#1f48ab'; taskbarColor = '#1b5e20'; }
    else if (isOrion50) { screenColor = '#2a5a8a'; taskbarColor = '#3a6b35'; }
    ctx.fillStyle = screenColor;
    ctx.fillRect(screenX, screenY, screenW, screenH);

    // Miniature Taskbar on CRT
    ctx.fillStyle = taskbarColor;
    ctx.fillRect(screenX, screenY + screenH - 4, screenW, 4);

    // Glowing Power LED on monitor
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(monX + monW - 8, monY + monH - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // --- Tower PC on floor beside desk ---
    const towerX = deskX + 85;
    const towerY = deskY + 28;
    const towerW = 26;
    const towerH = 55;

    // Tower casing
    ctx.fillStyle = '#cfc9b8';
    ctx.fillRect(towerX, towerY, towerW, towerH);
    ctx.fillStyle = '#9e9885';
    ctx.fillRect(towerX + 4, towerY + 8, towerW - 8, 8); // 3.5" Floppy slot
    ctx.fillRect(towerX + 4, towerY + 20, towerW - 8, 10); // CD-ROM drive

    // Green Power LED
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(towerX + 6, towerY + 38, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Blinking Amber HDD LED (blinks rapidly when downloads active)
    let hddLit = false;
    if (this.hasActiveDownloads) {
      hddLit = Math.sin(timeSec * 16) > -0.2;
    } else {
      hddLit = Math.sin(timeSec * 2) > 0.8;
    }
    ctx.fillStyle = hddLit ? '#f59e0b' : '#78350f';
    ctx.beginPath();
    ctx.arc(towerX + 12, towerY + 38, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // --- 14-DAY PROGRESSIVE CLUTTER ON DESK ---
    // Level 1 (Days 1..3): Basic setup
    // Level 2 (Days 4..7): +Noodle cup, CD jewel cases, Sticky notes
    if (this.day >= 4) {
      // Stack of CD jewel cases
      const cdX = deskX + 115;
      const cdY = deskY + 6;
      ctx.fillStyle = '#38bdf8'; // translucent blue case
      ctx.fillRect(cdX, cdY, 18, 3);
      ctx.fillStyle = '#f43f5e'; // red case
      ctx.fillRect(cdX + 1, cdY - 3, 18, 3);
      ctx.fillStyle = '#a855f7'; // purple case
      ctx.fillRect(cdX - 1, cdY - 6, 18, 3);

      // Yellow Sticky Note on corkboard above desk
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(deskX + 30, deskY - 70, 14, 14);
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(deskX + 32, deskY - 66, 10, 1.5);
      ctx.fillRect(deskX + 32, deskY - 62, 7, 1.5);
    }

    // Level 3 (Days 8..10): +Stereo PC speakers, spare RAM blister pack
    if (this.day >= 8) {
      // Desktop Speakers (Left & Right of monitor)
      ctx.fillStyle = '#d4cebe';
      ctx.fillRect(monX - 10, monY + 12, 7, 20);
      ctx.fillRect(monX + monW + 3, monY + 12, 7, 20);
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(monX - 6.5, monY + 22, 2.5, 0, Math.PI * 2);
      ctx.arc(monX + monW + 6.5, monY + 22, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // RAM blister pack on desk edge
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(deskX + 80, deskY + 8, 14, 6);
      ctx.fillStyle = '#22c55e'; // green PCB
      ctx.fillRect(deskX + 82, deskY + 9, 10, 3);
    }

    // Level 4 (Days 11..14): +Starlight Café Souvenir Coaster / Napkin
    if (this.day >= 11) {
      const coasterX = deskX + 140;
      const coasterY = deskY + 8;
      ctx.fillStyle = '#fef3c7'; // cream cafe napkin
      ctx.fillRect(coasterX, coasterY, 12, 12);
      ctx.fillStyle = '#d97706'; // star logo
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('★', coasterX + 3, coasterY + 8);
    }
  }

  // ==========================================
  // LAYER 6: Dynamic Particles
  // ==========================================
  private drawLayer6Particles(w: number, h: number, tod: TimeOfDay, timeSec: number) {
    const ctx = this.ctx;

    // 1. Sunbeam Dust Motes
    if (tod === 'morning' || tod === 'day') {
      ctx.fillStyle = '#fffbeb';
      for (const p of this.dustMotes) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // 2. Kettle Steam Puffs
    ctx.fillStyle = '#f8fafc';
    for (const p of this.kettleSteam) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 3. Rain streaks on Window
    if (this.weather === 'rain') {
      ctx.save();
      const winX = w * 0.40;
      const winY = h * 0.12;
      const winW = w * 0.22;
      const winH = h * 0.34;
      ctx.beginPath();
      ctx.rect(winX, winY, winW, winH);
      ctx.clip();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      for (const r of this.rainDrops) {
        ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        ctx.moveTo(r.x * w, r.y * h);
        ctx.lineTo(r.x * w + 3, r.y * h + r.length);
        ctx.stroke();
      }

      // Condensation droplets
      ctx.fillStyle = '#94a3b8';
      for (const c of this.condensationDrops) {
        ctx.globalAlpha = c.alpha;
        ctx.beginPath();
        ctx.ellipse(c.x * w, c.y * h, c.size * 0.8, c.size * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    // 4. CRT Phosphor Screen Glow Pulse
    const deskX = w * 0.12;
    const deskY = h * 0.50;
    const crtPulse = Math.sin(timeSec * 4) * 0.05 + 0.15;
    const crtGlow = ctx.createRadialGradient(deskX + 50, deskY - 20, 10, deskX + 50, deskY + 20, 80);
    crtGlow.addColorStop(0, `rgba(100, 180, 255, ${crtPulse})`);
    crtGlow.addColorStop(1, 'rgba(100, 180, 255, 0)');
    ctx.fillStyle = crtGlow;
    ctx.beginPath();
    ctx.arc(deskX + 50, deskY, 80, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==========================================
  // LAYER 7: Time-of-Day Lighting & Color Grading Overlay
  // ==========================================
  private drawLayer7Lighting(w: number, h: number, tod: TimeOfDay) {
    const ctx = this.ctx;

    // Lighting Wash according to Time of Day
    switch (tod) {
      case 'morning': {
        // Warm peach sunlight
        ctx.fillStyle = 'rgba(255, 185, 110, 0.16)';
        ctx.fillRect(0, 0, w, h);

        // Diagonal Sunbeam Trapezoid through window
        const winX = w * 0.40;
        const winY = h * 0.12;
        const winW = w * 0.22;
        ctx.fillStyle = 'rgba(255, 235, 190, 0.14)';
        ctx.beginPath();
        ctx.moveTo(winX, winY);
        ctx.lineTo(winX + winW, winY);
        ctx.lineTo(w * 0.10, h);
        ctx.lineTo(0, h * 0.85);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'day': {
        if (this.weather === 'rain') {
          ctx.fillStyle = 'rgba(70, 90, 120, 0.22)';
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = 'rgba(230, 240, 255, 0.04)';
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }

      case 'evening': {
        // Sunset crimson / warm amber wash
        ctx.fillStyle = 'rgba(220, 85, 40, 0.24)';
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case 'night': {
        // Deep midnight navy wash
        ctx.fillStyle = 'rgba(12, 20, 50, 0.52)';
        ctx.fillRect(0, 0, w, h);

        // Bedside warm lamp pool
        const bedX = w * 0.65;
        const bedY = h * 0.62;
        const lampGlow = ctx.createRadialGradient(bedX - 20, bedY, 5, bedX - 20, bedY, 120);
        lampGlow.addColorStop(0, 'rgba(255, 210, 130, 0.25)');
        lampGlow.addColorStop(1, 'rgba(255, 210, 130, 0)');
        ctx.fillStyle = lampGlow;
        ctx.beginPath();
        ctx.arc(bedX - 20, bedY, 120, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'late_night': {
        // Dark slate heavy atmosphere
        ctx.fillStyle = 'rgba(4, 7, 20, 0.72)';
        ctx.fillRect(0, 0, w, h);

        // Isolated CRT monitor glow
        const deskX = w * 0.12;
        const deskY = h * 0.50;
        const monGlow = ctx.createRadialGradient(deskX + 45, deskY - 20, 10, deskX + 45, deskY, 140);
        monGlow.addColorStop(0, 'rgba(80, 160, 255, 0.30)');
        monGlow.addColorStop(1, 'rgba(80, 160, 255, 0)');
        ctx.fillStyle = monGlow;
        ctx.beginPath();
        ctx.arc(deskX + 45, deskY, 140, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  // ==========================================
  // LAYER 8: UI Hotspot Tooltips, Cursor & HUD Highlights
  // ==========================================
  private drawLayer8HotspotUI(w: number, h: number, timeSec: number) {
    const ctx = this.ctx;

    // Draw pulsing highlight bounding box for hovered hotspot
    if (this.hoveredHotspot) {
      const hotspot = ROOM_HOTSPOTS.find((hs) => hs.id === this.hoveredHotspot);
      if (hotspot) {
        const hx = hotspot.x * w;
        const hy = hotspot.y * h;
        const hw = hotspot.w * w;
        const hh = hotspot.h * h;

        const pulseAlpha = Math.sin(timeSec * 8) * 0.2 + 0.6;
        ctx.strokeStyle = `rgba(250, 204, 21, ${pulseAlpha})`; // amber highlight ring
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(hx - 3, hy - 3, hw + 6, hh + 6);
        ctx.setLineDash([]);

        // Hover Floating Tooltip Badge
        const tooltipX = Math.min(Math.max(hx + hw / 2, 120), w - 160);
        const tooltipY = Math.max(hy - 14, 25);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1;
        const badgeW = 200;
        const badgeH = 26;
        ctx.beginPath();
        ctx.roundRect(tooltipX - badgeW / 2, tooltipY - badgeH / 2, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${hotspot.icon} ${hotspot.label}`, tooltipX, tooltipY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.removeEventListeners();
  }
}
