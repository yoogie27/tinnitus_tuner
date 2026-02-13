import React from 'react';
import { X } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-bold mb-4 text-white">How to use</h2>
        
        <div className="space-y-4 text-slate-300">
          <div>
            <h3 className="text-cyan-400 font-medium mb-1">1. Choose your Sound</h3>
            <p className="text-sm">
              Select a <strong>Tone</strong> (Sine, Square, etc.) for pure frequency matching. <br/>
              Select a <strong>Noise</strong> (White, Pink, Brown) for masking. When Noise is selected, the frequency slider tunes the "center pitch" of the noise.
            </p>
          </div>

          <div>
            <h3 className="text-cyan-400 font-medium mb-1">2. Match the Frequency</h3>
            <p className="text-sm">
              Use the slider for coarse adjustments and the +/- buttons for fine-tuning until the sound matches your tinnitus pitch.
            </p>
          </div>
          
          <div>
            <h3 className="text-cyan-400 font-medium mb-1">3. Lock & Phase</h3>
            <p className="text-sm">
              <strong>Lock Frequency:</strong> Prevents accidental changes. This setting is saved automatically.<br/>
              <strong>Phase Shift (180°):</strong> Inverts the waveform. Try this to see if it provides better relief or "cancellation" sensation.
            </p>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg text-xs border border-slate-700 mt-6">
            <strong>Pro Tip:</strong> If pure tones (Sine) don't help, try <strong>Pink Noise</strong> or <strong>Brown Noise</strong> and tune the frequency. Broad-spectrum noise is often more effective for masking.
          </div>
        </div>
      </div>
    </div>
  );
};