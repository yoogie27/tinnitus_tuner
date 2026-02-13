import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  isPhaseInverted: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying, isPhaseInverted }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match display size for sharpness
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      if (!analyser || !isPlaying) {
        // Draw flat line when idle
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.beginPath();
        ctx.moveTo(0, rect.height / 2);
        ctx.lineTo(rect.width, rect.height / 2);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Grid effect
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();

      // Waveform
      ctx.lineWidth = 3;
      // If phase is inverted, we visually flip the color or style to indicate it, 
      // although the analyser node sees the final output which might physically be inverted by the gain node.
      // However, analyser data is usually unsigned byte 0-255 centered at 128.
      // Inverting 128-based data: value -> 255 - value.
      
      ctx.strokeStyle = isPhaseInverted ? '#f472b6' : '#22d3ee'; // Pink for inverted, Cyan for normal
      ctx.shadowBlur = 15;
      ctx.shadowColor = isPhaseInverted ? '#f472b6' : '#22d3ee';

      ctx.beginPath();
      const sliceWidth = rect.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * rect.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, rect.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isPlaying, isPhaseInverted]);

  return (
    <div className="w-full h-48 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner relative">
       <canvas 
        ref={canvasRef} 
        className="w-full h-full"
      />
      <div className="absolute top-3 left-4 text-xs font-mono text-slate-500 uppercase tracking-wider">
        Oscilloscope // {isPhaseInverted ? 'Phase: 180°' : 'Phase: 0°'}
      </div>
    </div>
  );
};