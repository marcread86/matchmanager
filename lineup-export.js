/* global FORMATIONS, SQUAD */
/* Export the current starting XI as a PNG image — for sharing the
 * match-day team to WhatsApp / Notes / etc.
 *
 * The image draws:
 *   • Header: team name(s), formation, kick-off time (or current clock)
 *   • Pitch with proper markings (halfway line, centre circle, goal areas)
 *   • Player chips positioned per the active formation, showing #, name, pos
 *   • Footer: "Match Manager" wordmark + date
 *
 * Output is portrait 1080×1350 (Instagram-friendly). Sharing uses the Web
 * Share API on supporting devices (iOS + Android Chrome) so the user gets
 * the native share sheet. Falls back to a download link otherwise.
 */
async function exportLineupImage(state) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const navy  = '#0b002b';
  const navy2 = '#14063f';
  const pink  = '#ff18bd';
  const text  = '#ffffff';
  const text2 = '#b8b0d6';
  const pitchColor = '#1a6b35';
  const pitchLine  = 'rgba(255,255,255,0.55)';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, navy2);
  bg.addColorStop(1, navy);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────
  const headerH = 200;
  // Brand row
  ctx.fillStyle = pink;
  ctx.font = "700 28px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText('MATCH MANAGER', 56, 76);

  // Score row
  const us   = (state.teamName?.us   || 'Home').toUpperCase();
  const them = (state.teamName?.them || 'Away').toUpperCase();
  const usScore = state.score?.us ?? 0;
  const themScore = state.score?.them ?? 0;
  const hasScore = state.phase !== 'pre';

  ctx.fillStyle = text;
  ctx.font = "800 56px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText(truncate(ctx, us, 460), 56, 156);
  if (hasScore) {
    ctx.textAlign = 'right';
    ctx.fillText(`${usScore}-${themScore}`, W - 56, 156);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = text2;
    ctx.font = "600 32px 'Manrope', system-ui, sans-serif";
    ctx.fillText('vs ' + truncate(ctx, them, 360), W - 56, 156);
  }

  // Formation chip + clock
  ctx.fillStyle = text2;
  ctx.font = "600 24px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = 'left';
  ctx.fillText(state.formation || '4-4-2', 56, 196);
  ctx.textAlign = 'right';
  const clockTxt = fmtSec(state.matchSec || 0);
  ctx.fillText(clockTxt, W - 56, 196);

  // ── Pitch ─────────────────────────────────────────────────
  const pitchX = 56;
  const pitchY = headerH + 24;
  const pitchW = W - 112;
  const pitchH = H - pitchY - 180;
  const pr = 24; // corner radius

  // Pitch base
  roundRect(ctx, pitchX, pitchY, pitchW, pitchH, pr);
  const pg = ctx.createRadialGradient(W/2, pitchY + pitchH * 0.3, 60, W/2, pitchY + pitchH * 0.5, pitchW * 0.7);
  pg.addColorStop(0, '#2a8d4a');
  pg.addColorStop(0.6, pitchColor);
  pg.addColorStop(1, '#0d4a23');
  ctx.fillStyle = pg;
  ctx.fill();

  // Subtle horizontal stripes
  ctx.save();
  roundRect(ctx, pitchX, pitchY, pitchW, pitchH, pr);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const stripeH = 110;
  for (let y = pitchY; y < pitchY + pitchH; y += stripeH * 2) {
    ctx.fillRect(pitchX, y, pitchW, stripeH);
  }
  ctx.restore();

  // Pitch markings
  ctx.strokeStyle = pitchLine;
  ctx.lineWidth = 3;
  // Border
  roundRect(ctx, pitchX + 16, pitchY + 16, pitchW - 32, pitchH - 32, pr - 6);
  ctx.stroke();
  // Halfway line
  ctx.beginPath();
  ctx.moveTo(pitchX + 16, pitchY + pitchH / 2);
  ctx.lineTo(pitchX + pitchW - 16, pitchY + pitchH / 2);
  ctx.stroke();
  // Centre circle
  ctx.beginPath();
  ctx.arc(W / 2, pitchY + pitchH / 2, 80, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, pitchY + pitchH / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = pitchLine;
  ctx.fill();
  // Goal areas top + bottom
  const gaW = pitchW * 0.46;
  const gaH = 90;
  ctx.beginPath();
  ctx.rect((W - gaW) / 2, pitchY + 16, gaW, gaH);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect((W - gaW) / 2, pitchY + pitchH - 16 - gaH, gaW, gaH);
  ctx.stroke();
  // Penalty arcs
  ctx.beginPath();
  ctx.arc((W / 2), pitchY + 16 + gaH, 36, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc((W / 2), pitchY + pitchH - 16 - gaH, 36, Math.PI, Math.PI * 2);
  ctx.stroke();

  // ── Players ───────────────────────────────────────────────
  // FORMATIONS rows go top→bottom in attacking direction. To display "our
  // half" at the BOTTOM (GK at the bottom of the image), we reverse the row
  // order — matching the in-app pitch.
  const formation = window.FORMATIONS[state.formation] || window.FORMATIONS['4-4-2'];
  const rows = [...formation.rows].reverse();   // attack (top) → defence (bottom)
  // Actually we want defence at bottom, so original order is correct for
  // top-down attack. The in-app pitch has ST at top, GK at bottom — so we
  // keep the natural order (which IS attack-on-top).
  // (rows already has attack first, so don't reverse.)
  const realRows = formation.rows;

  const innerX = pitchX + 32;
  const innerY = pitchY + 36;
  const innerW = pitchW - 64;
  const innerH = pitchH - 72;
  const rowGap = innerH / realRows.length;

  // Match slot order from buildSlots in data.js
  let slotIdx = 0;
  realRows.forEach((row, rowI) => {
    const rowY = innerY + rowGap * (rowI + 0.5);
    const colCount = row.length;
    row.forEach((cell, colI) => {
      const slot = state.slots[slotIdx];
      slotIdx++;
      const cellX = innerX + (innerW / (colCount + 0)) * (colI + 0.5);
      drawPlayerChip(ctx, cellX, rowY, slot, cell);
    });
  });

  // ── Footer ────────────────────────────────────────────────
  const footY = H - 100;
  ctx.fillStyle = text2;
  ctx.font = "500 22px 'Manrope', system-ui, sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText('Match Manager', 56, footY);
  ctx.textAlign = 'right';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  ctx.fillText(date, W - 56, footY);
  ctx.fillStyle = pink;
  ctx.fillRect(56, footY + 16, W - 112, 2);

  // ── Export ────────────────────────────────────────────────
  const blob = await new Promise(r => c.toBlob(r, 'image/png', 0.95));
  const filename = `lineup-${(state.teamName?.us || 'team').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-${new Date().toISOString().slice(0,10)}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  // Try Web Share API first (mobile native share sheet → WhatsApp etc.)
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: `${us} lineup`,
        text: `${us} · ${state.formation}`,
      });
      return { shared: true };
    } catch (e) {
      if (e.name === 'AbortError') return { shared: false, aborted: true };
      // fall through to download
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  return { downloaded: true };
}

function drawPlayerChip(ctx, cx, cy, slot, cell) {
  const chipW = 140;
  const chipH = 100;
  const x = cx - chipW / 2;
  const y = cy - chipH / 2;

  const player = slot?.playerId ? (window.SQUAD || []).find(p => p.id === slot.playerId) : null;

  // Chip background
  if (player) {
    ctx.save();
    roundRect(ctx, x, y, chipW, chipH, 14);
    ctx.fillStyle = 'rgba(11,0,43,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    roundRect(ctx, x, y, chipW, chipH, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Position label (top)
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = "700 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = 'center';
  ctx.fillText(cell.label, cx, y + 22);

  if (player) {
    // Number
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = "500 14px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText('#' + player.n, cx, y + 42);

    // Name (last name only if too long)
    ctx.fillStyle = '#ffffff';
    ctx.font = "700 19px 'Manrope', system-ui, sans-serif";
    const name = shortenName(player.name);
    const fitName = truncate(ctx, name, chipW - 16);
    ctx.fillText(fitName, cx, y + 74);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = "italic 500 16px 'Manrope', system-ui, sans-serif";
    ctx.fillText('Empty', cx, y + 62);
  }
}

function shortenName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0][0] + '. ' + parts.slice(1).join(' ');
}

function truncate(ctx, txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let lo = 0, hi = txt.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const t = txt.slice(0, mid) + '…';
    if (ctx.measureText(t).width <= maxW) lo = mid + 1;
    else hi = mid;
  }
  return txt.slice(0, Math.max(1, lo - 1)) + '…';
}

function fmtSec(sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

Object.assign(window, { exportLineupImage });
