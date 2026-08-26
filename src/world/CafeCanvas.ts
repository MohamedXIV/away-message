// src/world/CafeCanvas.ts

import { MayaExpression, Particle } from './types';

export interface CafeCanvasOptions {
  canvas: HTMLCanvasElement;
  expression: MayaExpression;
}

export class CafeCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  public expression: MayaExpression = 'smile';
  private steamParticles: Particle[] = [];
  private lastTime = 0;

  constructor(options: CafeCanvasOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not acquire 2D canvas context');
    this.ctx = context;
    this.expression = options.expression;

    this.initParticles();
    this.startLoop();
  }

  public setExpression(expression: MayaExpression) {
    this.expression = expression;
  }

  private initParticles() {
    this.steamParticles = [];
    for (let i = 0; i < 20; i++) {
      this.steamParticles.push({
        x: (i % 2 === 0 ? 0.38 : 0.62) + (Math.random() - 0.5) * 0.03,
        y: 0.72 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.01,
        vy: -0.03 - Math.random() * 0.03,
        size: 2 + Math.random() * 4,
        alpha: 0,
        maxAlpha: 0.4 + Math.random() * 0.2,
        life: Math.random() * 2,
        maxLife: 1.8 + Math.random() * 0.8,
      });
    }
  }

  private startLoop() {
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (this.isDestroyed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt);
      this.render();

      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  private update(dt: number) {
    for (const p of this.steamParticles) {
      p.life = (p.life ?? 0) + dt;
      if (p.life > (p.maxLife ?? 2)) {
        p.life = 0;
        p.x = (Math.random() > 0.5 ? 0.38 : 0.62) + (Math.random() - 0.5) * 0.02;
        p.y = 0.72 + Math.random() * 0.02;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const progress = (p.life ?? 0) / (p.maxLife ?? 2);
      p.alpha = Math.sin(progress * Math.PI) * p.maxAlpha;
      p.size = 2 + progress * 6;
    }
  }

  private render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Café Background & Plate Glass Window
    this.drawCafeBackground(w, h);

    // 2. Maya Character Portrait (Seated across the table)
    this.drawMayaPortrait(w, h);

    // 3. Foreground Booth Table, Coffee Mugs & Steam
    this.drawTableAndMugs(w, h);

    // 4. Warm Hanging Pendant Lamp Glow
    this.drawAtmosphericLighting(w, h);

    ctx.restore();
  }

  private drawCafeBackground(w: number, h: number) {
    const ctx = this.ctx;

    // Dark brick wall
    ctx.fillStyle = '#221511';
    ctx.fillRect(0, 0, w, h);

    // Large background plate glass window (Left & Center)
    const winX = w * 0.08;
    const winY = h * 0.08;
    const winW = w * 0.84;
    const winH = h * 0.54;

    // Exterior city view through cafe window
    const extGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
    extGrad.addColorStop(0, '#3e2723');
    extGrad.addColorStop(0.5, '#5d4037');
    extGrad.addColorStop(1, '#8d6e63');
    ctx.fillStyle = extGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Distant street lanterns & warm bokeh circles outside
    ctx.fillStyle = 'rgba(255, 200, 100, 0.25)';
    ctx.beginPath();
    ctx.arc(winX + winW * 0.2, winY + winH * 0.35, 18, 0, Math.PI * 2);
    ctx.arc(winX + winW * 0.8, winY + winH * 0.25, 24, 0, Math.PI * 2);
    ctx.arc(winX + winW * 0.5, winY + winH * 0.45, 14, 0, Math.PI * 2);
    ctx.fill();

    // Wood window frames & mullions
    ctx.strokeStyle = '#1b0f0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(winX + winW * 0.33, winY);
    ctx.lineTo(winX + winW * 0.33, winY + winH);
    ctx.moveTo(winX + winW * 0.66, winY);
    ctx.lineTo(winX + winW * 0.66, winY + winH);
    ctx.stroke();

    // Leather booth seat backrest behind Maya
    const boothY = h * 0.32;
    ctx.fillStyle = '#4a151b'; // burgundy leather
    ctx.fillRect(w * 0.22, boothY, w * 0.56, h * 0.38);
    // Tufted leather stitching
    ctx.strokeStyle = '#2b0c10';
    ctx.lineWidth = 2;
    for (let x = w * 0.26; x < w * 0.76; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, boothY);
      ctx.lineTo(x, boothY + h * 0.38);
      ctx.stroke();
    }
  }

  private drawMayaPortrait(w: number, h: number) {
    const ctx = this.ctx;
    const centerX = w * 0.5;
    const centerY = h * 0.44;

    ctx.save();

    // 1. Shoulders & Winter Jacket
    ctx.fillStyle = '#1e293b'; // slate navy winter coat
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 110, 85, 55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Knitted Scarf (warm amber/mustard yellow)
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(centerX - 42, centerY + 65, 84, 30, 10);
    ctx.fill();
    // Scarf knit texture
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    for (let sx = centerX - 36; sx < centerX + 36; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, centerY + 67);
      ctx.lineTo(sx, centerY + 93);
      ctx.stroke();
    }

    // 2. Dark Long Hair (Behind shoulders & around face)
    ctx.fillStyle = '#171412';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 20, 52, 65, 0, 0, Math.PI * 2);
    ctx.fill();
    // Left & right hair strands
    ctx.fillRect(centerX - 50, centerY + 20, 24, 70);
    ctx.fillRect(centerX + 26, centerY + 20, 24, 70);

    // 3. Face & Neck
    ctx.fillStyle = '#fbe8d3'; // warm skin tone
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 25, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Front Bangs & Hairline
    ctx.fillStyle = '#171412';
    ctx.beginPath();
    ctx.moveTo(centerX - 35, centerY + 5);
    ctx.quadraticCurveTo(centerX, centerY + 16, centerX + 35, centerY + 5);
    ctx.quadraticCurveTo(centerX + 20, centerY - 25, centerX, centerY - 28);
    ctx.quadraticCurveTo(centerX - 20, centerY - 25, centerX - 35, centerY + 5);
    ctx.fill();

    // 5. Eyebrows
    ctx.strokeStyle = '#2b1b17';
    ctx.lineWidth = 2;
    if (this.expression === 'surprised') {
      // Raised arched eyebrows
      ctx.beginPath();
      ctx.arc(centerX - 14, centerY + 14, 8, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.arc(centerX + 14, centerY + 14, 8, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();
    } else if (this.expression === 'thoughtful') {
      // Slightly furrowed / contemplative eyebrows
      ctx.beginPath();
      ctx.moveTo(centerX - 22, centerY + 18);
      ctx.lineTo(centerX - 6, centerY + 19);
      ctx.moveTo(centerX + 6, centerY + 19);
      ctx.lineTo(centerX + 22, centerY + 18);
      ctx.stroke();
    } else {
      // Natural gentle eyebrows
      ctx.beginPath();
      ctx.arc(centerX - 14, centerY + 18, 9, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.arc(centerX + 14, centerY + 18, 9, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();
    }

    // 6. Eyes
    const eyeLeftX = centerX - 14;
    const eyeRightX = centerX + 14;
    const eyeY = centerY + 26;

    if (this.expression === 'smile' || this.expression === 'shy') {
      // Happy curving eye arcs
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(eyeLeftX, eyeY + 2, 6, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.arc(eyeRightX, eyeY + 2, 6, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();
    } else if (this.expression === 'thoughtful') {
      // Looking slightly down at coffee
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.ellipse(eyeLeftX, eyeY + 3, 4, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeRightX, eyeY + 3, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Attentive wide/neutral eyes
      ctx.fillStyle = '#3e2723'; // dark warm brown iris
      ctx.beginPath();
      ctx.arc(eyeLeftX, eyeY, this.expression === 'surprised' ? 5 : 4, 0, Math.PI * 2);
      ctx.arc(eyeRightX, eyeY, this.expression === 'surprised' ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Eye catchlights (sparkle)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeLeftX + 1.5, eyeY - 1.5, 1.5, 0, Math.PI * 2);
      ctx.arc(eyeRightX + 1.5, eyeY - 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Blush on Cheeks (Prominent in 'shy' and 'smile')
    if (this.expression === 'shy' || this.expression === 'smile') {
      const blushAlpha = this.expression === 'shy' ? 0.45 : 0.25;
      ctx.fillStyle = `rgba(244, 63, 94, ${blushAlpha})`;
      ctx.beginPath();
      ctx.ellipse(centerX - 20, centerY + 36, 7, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(centerX + 20, centerY + 36, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Nose
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 30);
    ctx.lineTo(centerX + 2, centerY + 38);
    ctx.lineTo(centerX - 1, centerY + 39);
    ctx.stroke();

    // 9. Mouth
    ctx.strokeStyle = '#9f1239'; // berry lip tone
    ctx.lineWidth = 2;
    if (this.expression === 'smile') {
      ctx.beginPath();
      ctx.arc(centerX, centerY + 44, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.stroke();
    } else if (this.expression === 'surprised') {
      ctx.fillStyle = '#9f1239';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 47, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.expression === 'shy') {
      ctx.beginPath();
      ctx.arc(centerX + 2, centerY + 46, 6, 0.2 * Math.PI, 0.8 * Math.PI, false);
      ctx.stroke();
    } else if (this.expression === 'thoughtful') {
      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY + 47);
      ctx.lineTo(centerX + 6, centerY + 46);
      ctx.stroke();
    } else {
      // Neutral slight gentle smile
      ctx.beginPath();
      ctx.arc(centerX, centerY + 46, 6, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawTableAndMugs(w: number, h: number) {
    const ctx = this.ctx;

    // Dark Cherry Wood Table (Foreground)
    const tableY = h * 0.68;
    const tableGrad = ctx.createLinearGradient(0, tableY, 0, h);
    tableGrad.addColorStop(0, '#3e2723');
    tableGrad.addColorStop(0.1, '#4e342e');
    tableGrad.addColorStop(1, '#271916');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, tableY, w, h - tableY);

    // Polished table edge highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, tableY, w, 3);

    // Center Napkin Holder & Sugar Dispenser
    const napkinX = w * 0.5 - 12;
    const napkinY = tableY + 8;
    ctx.fillStyle = '#cbd5e1'; // chrome napkin holder
    ctx.fillRect(napkinX, napkinY, 24, 28);
    ctx.fillStyle = '#f8fafc'; // white napkins
    ctx.fillRect(napkinX + 4, napkinY - 6, 16, 8);

    // Maya's Ceramic Latte Mug (Left center table)
    const mug1X = w * 0.38;
    const mug1Y = tableY + 14;
    ctx.fillStyle = '#0284c7'; // turquoise ceramic
    ctx.beginPath();
    ctx.roundRect(mug1X - 14, mug1Y, 28, 30, 4);
    ctx.fill();
    // Saucer plate
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.ellipse(mug1X, mug1Y + 30, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player's Ceramic Coffee Mug (Right center table)
    const mug2X = w * 0.62;
    const mug2Y = tableY + 14;
    ctx.fillStyle = '#ea580c'; // terracotta ceramic
    ctx.beginPath();
    ctx.roundRect(mug2X - 14, mug2Y, 28, 30, 4);
    ctx.fill();
    // Saucer plate
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.ellipse(mug2X, mug2Y + 30, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coffee Steam Vapor Particles
    ctx.fillStyle = '#ffffff';
    for (const p of this.steamParticles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  private drawAtmosphericLighting(w: number, h: number) {
    const ctx = this.ctx;

    // Hanging Pendant Lamp Wire & Shade at Top Center
    const lampX = w * 0.5;
    ctx.strokeStyle = '#1e1b18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lampX, 0);
    ctx.lineTo(lampX, 36);
    ctx.stroke();

    // Brass Shade
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(lampX - 22, 54);
    ctx.lineTo(lampX + 22, 54);
    ctx.lineTo(lampX + 12, 36);
    ctx.lineTo(lampX - 12, 36);
    ctx.closePath();
    ctx.fill();

    // Warm Conical Light Glow from Pendant Lamp
    const lampGlow = ctx.createRadialGradient(lampX, 54, 10, lampX, h * 0.55, w * 0.45);
    lampGlow.addColorStop(0, 'rgba(255, 220, 140, 0.28)');
    lampGlow.addColorStop(0.5, 'rgba(255, 190, 90, 0.12)');
    lampGlow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(lampX, h * 0.45, w * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
