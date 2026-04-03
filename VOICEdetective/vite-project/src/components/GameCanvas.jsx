
import { useEffect, useRef } from "react";
import {
  BOARD_W,
  BOARD_H,
  COLS,
  ROWS,
  CELL_W,
  CELL_H,
  SENSORS,
} from "../game/constants";
import { zoneCenter, pointToZone } from "../game/physics";

function roundedRect(ctx, x, y, w, h, r) {
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

export default function GameCanvas({
  currentEvent,
  estimated,
  scanned,
  scanPulse,
  revealTruth,
  showHintZone,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let start = performance.now();

    function draw(now) {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);

      const bg = ctx.createLinearGradient(0, 0, BOARD_W, BOARD_H);
      bg.addColorStop(0, "#07111f");
      bg.addColorStop(0.5, "#050b16");
      bg.addColorStop(1, "#02060c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);

      const glow = ctx.createRadialGradient(
        BOARD_W / 2,
        BOARD_H / 2,
        20,
        BOARD_W / 2,
        BOARD_H / 2,
        BOARD_W * 0.55
      );
      glow.addColorStop(0, "rgba(0,255,255,0.08)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);

      roundedRect(ctx, 8, 8, BOARD_W - 16, BOARD_H - 16, 24);
      ctx.strokeStyle = "rgba(0,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = 1; i < COLS; i++) {
        const x = i * CELL_W;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, BOARD_H);
        ctx.stroke();
      }

      for (let i = 1; i < ROWS; i++) {
        const y = i * CELL_H;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(BOARD_W, y);
        ctx.stroke();
      }

      for (let zone = 1; zone <= 12; zone++) {
        const c = zoneCenter(zone);
        const isHint = showHintZone === zone;
        const isEstimated = estimated && pointToZone(estimated) === zone;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(c.x - 24, c.y - 24, 48, 48, 12);

        if (isEstimated) {
          ctx.fillStyle = "rgba(255, 0, 200, 0.18)";
          ctx.strokeStyle = "rgba(255, 120, 255, 0.75)";
          ctx.shadowBlur = 24;
          ctx.shadowColor = "rgba(255, 0, 200, 0.45)";
        } else if (isHint) {
          ctx.fillStyle = "rgba(0, 255, 200, 0.12)";
          ctx.strokeStyle = "rgba(0, 255, 200, 0.45)";
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
        }

        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(230,245,255,0.85)";
        ctx.font = "bold 22px Inter, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(zone), c.x, c.y + 1);
        ctx.restore();
      }

      if (currentEvent && scanPulse > 0) {
        const radius = 40 + scanPulse * 520;
        ctx.save();
        ctx.globalAlpha = 1 - scanPulse;
        ctx.strokeStyle = "rgba(60, 240, 255, 0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(currentEvent.source.x, currentEvent.source.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 80, 220, 0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(currentEvent.source.x, currentEvent.source.y, radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const sensor of SENSORS) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + sensor.x * 0.01);
        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = "rgba(0,255,255,0.8)";
        ctx.fillStyle = "#7ef9ff";
        ctx.beginPath();
        ctx.arc(sensor.x, sensor.y, 9, 0, Math.PI * 2);
        ctx.fill();

        if (scanned) {
          ctx.globalAlpha = 0.20 + 0.25 * pulse;
          ctx.strokeStyle = "rgba(0,255,255,0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sensor.x, sensor.y, 18 + pulse * 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(220,250,255,0.9)";
        ctx.font = "bold 12px Inter, Arial";
        ctx.textAlign = "center";
        ctx.fillText(sensor.id, sensor.x, sensor.y + 24);
        ctx.restore();
      }

      if (revealTruth && currentEvent) {
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = "rgba(0,255,140,0.95)";
        ctx.fillStyle = "#41ff8f";
        ctx.beginPath();
        ctx.arc(currentEvent.source.x, currentEvent.source.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (estimated) {
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = "rgba(255,0,220,0.95)";
        ctx.fillStyle = "#ff63f5";
        ctx.beginPath();
        ctx.arc(estimated.x, estimated.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (currentEvent && revealTruth) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.setLineDash([6, 8]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(currentEvent.source.x, currentEvent.source.y);
          ctx.lineTo(estimated.x, estimated.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.fillStyle = "rgba(230,245,255,0.85)";
      ctx.font = "bold 14px Inter, Arial";
      ctx.textAlign = "left";
      ctx.fillText("Solid Plate Simulation", 24, 28);

      ctx.textAlign = "right";
      ctx.fillText("Sensors detect differential wave arrival times", BOARD_W - 24, 28);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentEvent, estimated, scanned, scanPulse, revealTruth, showHintZone]);

  return <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-canvas" />;
}