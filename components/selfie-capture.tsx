'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SelfieCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (image: string, faceFingerprint?: string) => void;
  officeZone?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    name: string;
  } | null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type LivenessStep = 'blink' | 'left' | 'right' | 'challenge' | 'done';
type Challenge = 'smile' | 'mouthOpen';

export default function SelfieCapture({ open, onClose, onCapture, officeZone }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<LivenessStep>('blink');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<Challenge>('smile');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Mediapipe state
  const faceLandmarkerRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const stepRef = useRef<LivenessStep>('blink');
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Sync refs with state for AI loop
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (open) {
      startCamera();
      loadMediapipe();
      fetchLocation();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Location Error:', err);
        setError(`Location error: ${err.message}. Please enable location access.`);
        if (process.env.NODE_ENV === 'development') {
          setLocation({ lat: 0, lng: 0 });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async () => {
    setLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      setError("Camera access denied. Please enable camera permissions.");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setStream(null);
    setReady(false);
    setStep('blink');
  };

  const loadMediapipe = async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      
      faceLandmarkerRef.current = faceLandmarker;
      setReady(true);
      requestAnimationFrame(predict);
    } catch (err) {
      console.error(err);
      setError("Failed to load AI models. Please check your internet connection.");
    }
  };

  const predict = async () => {
    if (!videoRef.current || !faceLandmarkerRef.current || videoRef.current.readyState < 2) {
      animationRef.current = requestAnimationFrame(predict);
      return;
    }

    const startTimeMs = performance.now();
    const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
    setFaceDetected(hasFace);

    if (hasFace) {
      const blendshapes = results.faceBlendshapes[0].categories;
      
      const eyeBlinkLeft = blendshapes.find((c: any) => c.categoryName === "eyeBlinkLeft")?.score || 0;
      const eyeBlinkRight = blendshapes.find((c: any) => c.categoryName === "eyeBlinkRight")?.score || 0;
      
      const jawOpen = blendshapes.find((c: any) => c.categoryName === "jawOpen")?.score || 0;
      const smileL = blendshapes.find((c: any) => c.categoryName === "mouthSmileLeft")?.score || 0;
      const smileR = blendshapes.find((c: any) => c.categoryName === "mouthSmileRight")?.score || 0;

      const landmarks = results.faceLandmarks[0];
      const nose = landmarks[1];
      const leftEye = landmarks[33]; 
      const rightEye = landmarks[263];
      
      const distL = Math.abs(nose.x - leftEye.x);
      const distR = Math.abs(nose.x - rightEye.x);
      const ratio = distL / distR;

      let isInside = true;
      if (officeZone && location) {
        const dist = haversineDistance(location.lat, location.lng, officeZone.latitude, officeZone.longitude);
        isInside = dist <= officeZone.radiusMeters;
      }

      setStep(prev => {
        if (prev === 'blink' && (eyeBlinkLeft > 0.3 || eyeBlinkRight > 0.3)) return 'left';
        if (prev === 'left' && ratio > 1.25) return 'right'; 
        if (prev === 'right' && ratio < 0.8) return 'challenge';
        if (prev === 'challenge') {
          if (challenge === 'smile' && (smileL > 0.5 || smileR > 0.5)) return 'done';
          if (challenge === 'mouthOpen' && jawOpen > 0.4) return 'done';
        }
        if (prev === 'done') {
          if (!isInside) {
             setError("You are outside the office boundary ❌. Attendance only allowed inside.");
             return 'right'; 
          }
          if (countdown === null && !capturing) startAutoCapture();
          return 'done';
        }
        return prev;
      });
    }

    animationRef.current = requestAnimationFrame(predict);
  };

  const startAutoCapture = () => {
    setChallenge(Math.random() > 0.5 ? 'smile' : 'mouthOpen');
    setCountdown(2);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          setCapturing(true);
          setTimeout(() => handleCapture(), 800);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleCapture = (retryCount = 0) => {
    const currentLocation = locationRef.current;
    
    if (!videoRef.current || !canvasRef.current) {
       if (retryCount < 5) setTimeout(() => handleCapture(retryCount + 1), 300);
       return;
    }
    
    if (!currentLocation) {
       if (retryCount < 10) {
         setTimeout(() => handleCapture(retryCount + 1), 500);
         return;
       }
       setError("Waiting for location... please ensure GPS is on.");
       return;
    }

    let fingerprint = '';
    if (faceLandmarkerRef.current) {
      const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (results.faceLandmarks && results.faceLandmarks[0]) {
        const landmarks = results.faceLandmarks[0];
        const keyIndices = [1, 33, 263, 61, 291, 199]; 
        const points = keyIndices.map(i => ({ 
          x: landmarks[i].x, 
          y: landmarks[i].y, 
          z: landmarks[i].z 
        }));
        const dx = points[1].x - points[2].x;
        const dy = points[1].y - points[2].y;
        const eyeDist = Math.sqrt(dx*dx + dy*dy) || 1;
        const normalized = points.map(p => ({
          x: (p.x - points[0].x) / eyeDist,
          y: (p.y - points[0].y) / eyeDist
        }));
        fingerprint = JSON.stringify(normalized);
      }
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Inter, sans-serif';
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    ctx.fillText(`🕒 ${now} IST`, 20, canvas.height - 50);
    ctx.fillText(`📍 ${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`, 20, canvas.height - 25);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(canvas.width - 160, canvas.height - 60, 140, 40, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('VERIFIED LIVE', canvas.width - 145, canvas.height - 35);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    onCapture(dataUrl, fingerprint);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Selfie Attendance Verification</DialogTitle>
          <DialogDescription>Please complete the liveness check to proceed.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[3/4] bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-20">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
              <p className="text-sm font-medium">Initializing Secure Camera...</p>
            </div>
          )}
          
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
          />

          {!loading && faceDetected && !capturing && (
            <div className="absolute top-4 right-4 z-30 animate-in fade-in zoom-in duration-300">
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Face Detected
              </div>
            </div>
          )}

          {!loading && (
            <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
              {!location ? (
                <div className="bg-orange-500/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-orange-400/50">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  🛰️ Fetching GPS...
                </div>
              ) : officeZone ? (
                haversineDistance(location.lat, location.lng, officeZone.latitude, officeZone.longitude) <= officeZone.radiusMeters ? (
                  <div className="bg-emerald-500/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-emerald-400/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Inside Office Boundary ✅
                  </div>
                ) : (
                  <div className="bg-red-500/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-red-400/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Outside Office ❌
                  </div>
                )
              ) : (
                <div className="bg-blue-500/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-blue-400/50">
                  <CheckCircle2 className="w-3 h-3" />
                  Location Secured
                </div>
              )}
            </div>
          )}

          {!loading && step !== 'done' && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent top-0 animate-[scan_2s_linear_infinite]" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-20">
            <div className="flex flex-col items-center text-center gap-4">
              {step === 'blink' && (
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 animate-pulse">
                  <p className="text-white text-sm font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    Please Blink Your Eyes 👁️
                  </p>
                </div>
              )}
              {step === 'left' && (
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 animate-bounce">
                  <p className="text-white text-sm font-bold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    Turn Your Head Left ⬅️
                  </p>
                </div>
              )}
              {step === 'right' && (
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 animate-bounce">
                  <p className="text-white text-sm font-bold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    Turn Your Head Right ➡️
                  </p>
                </div>
              )}
              {step === 'challenge' && (
                <div className="bg-orange-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-orange-500/50 animate-pulse">
                  <p className="text-white text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-orange-400" />
                    {challenge === 'smile' ? 'Please Smile! 😊' : 'Open Your Mouth! 😮'}
                  </p>
                </div>
              )}
              {step === 'done' && !capturing && (
                <div className="bg-emerald-500/20 backdrop-blur-md px-6 py-2 rounded-full border border-emerald-500/50 animate-bounce">
                  <p className="text-emerald-400 text-sm font-bold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Hold still... {countdown}s
                  </p>
                </div>
              )}
              {capturing && (
                <div className="bg-emerald-500 px-8 py-3 rounded-full shadow-xl shadow-emerald-900/40 animate-in zoom-in duration-300">
                  <p className="text-white text-lg font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    Captured ✅
                  </p>
                </div>
              )}
            </div>
          </div>

          {!capturing && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 z-30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs font-medium border-t border-red-100 text-center">
            {error}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </Dialog>
  );
}
