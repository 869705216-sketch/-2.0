import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Experience } from './components/Experience';
import { GeminiLiveService } from './services/geminiLiveService';
import { HandData, HandState } from './types';

// Luxury Fonts
const TITLE_FONT = "font-family: 'Playfair Display', serif;";
const UI_FONT = "font-family: 'Cinzel', serif;";

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handData, setHandData] = useState<HandData>({ state: HandState.CLOSED, x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const geminiService = useRef(new GeminiLiveService());

  useEffect(() => {
    // Setup Service Callback
    geminiService.current.setOnHandData((data) => {
      // Simple smoothing could go here, but we'll do raw state update for responsiveness
      // and smooth in the 3D component.
      setHandData(data);
    });

    return () => {
      geminiService.current.stop();
    };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get Webcam
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: true // Live API prefers audio context, though we focus on video
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 2. Connect to Gemini Live
      await geminiService.current.connect();
      
      // 3. Start Streaming Frames
      if (videoRef.current) {
        geminiService.current.startVideoStreaming(videoRef.current);
      }

      setStarted(true);
    } catch (err: any) {
        console.error(err);
        setError("Failed to initialize. Ensure Camera/Mic permissions are granted and API Key is valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Radial gradient background for a "Spotlight" luxury feel, avoiding flat black
    <div className="relative w-full h-screen overflow-hidden bg-[radial-gradient(circle_at_center,_#0a2e1d_0%,_#000502_90%)] text-white">
      {/* Hidden Video Element for Analysis */}
      <video 
        ref={videoRef} 
        className="absolute top-0 left-0 opacity-0 pointer-events-none" 
        playsInline 
        muted 
      />

      {/* 3D Background / Experience */}
      <div className="absolute inset-0 z-0">
        <Experience handData={handData} />
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header */}
        <div className="flex justify-between items-start">
            <div className="border-l-4 border-[#FFD700] pl-4">
                <h1 className="text-4xl md:text-6xl text-[#FFD700] uppercase tracking-widest drop-shadow-lg" style={{ fontFamily: 'Playfair Display' }}>
                    Grand Luxury
                </h1>
                <h2 className="text-xl md:text-2xl text-emerald-400 tracking-[0.3em] mt-2" style={{ fontFamily: 'Cinzel' }}>
                    Interactive Christmas
                </h2>
            </div>
            
            {started && (
                <div className="bg-black/40 backdrop-blur-md border border-[#FFD700]/30 p-4 rounded-lg text-right">
                    <p className="text-[#FFD700] text-xs uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center justify-end gap-2">
                        <div className={`w-3 h-3 rounded-full ${handData.state === HandState.OPEN ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-emerald-500 shadow-[0_0_10px_emerald]'}`}></div>
                        <span className="font-mono text-sm">{handData.state === HandState.OPEN ? 'UNLEASHED' : 'SECURE'}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-2">
                        X: {handData.x.toFixed(2)} | Y: {handData.y.toFixed(2)}
                    </p>
                </div>
            )}
        </div>

        {/* Footer/Controls */}
        <div className="flex justify-center pb-10 pointer-events-auto">
            {!started && (
                <button 
                    onClick={handleStart}
                    disabled={loading}
                    className={`
                        group relative px-12 py-4 bg-gradient-to-r from-[#004225] to-[#012918] 
                        border-2 border-[#FFD700] text-[#FFD700] uppercase tracking-[0.2em] font-bold text-lg
                        transition-all duration-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)]
                        ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                    style={{ fontFamily: 'Cinzel' }}
                >
                    <span className="relative z-10">{loading ? 'Initialising Luxury...' : 'Enter Experience'}</span>
                    <div className="absolute inset-0 bg-[#FFD700] opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                </button>
            )}
            
            {error && (
                <div className="absolute bottom-32 bg-red-900/80 border border-red-500 text-white p-4 rounded max-w-md text-center">
                    {error}
                </div>
            )}
            
            {started && (
                <div className="text-center opacity-70">
                    <p className="text-[#FFD700] text-sm uppercase tracking-widest mb-2" style={{ fontFamily: 'Cinzel' }}>Instructions</p>
                    <div className="flex gap-8 text-xs text-emerald-100">
                        <div className="flex flex-col items-center">
                            <span className="block text-2xl mb-1">✋</span>
                            <span>Open Hand to Unleash</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="block text-2xl mb-1">👋</span>
                            <span>Move Hand to Pan Camera</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="block text-2xl mb-1">✊</span>
                            <span>Close Hand to Restore</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;