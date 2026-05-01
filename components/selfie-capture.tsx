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

const OFFICE_ZONES = [
  { lat: 12.935472, lng: 77.608333, radius: 150 },
  { lat: 13.0363, lng: 77.5111, radius: 150 },
];

function isWithinAnyZone(lat: number, lng: number): boolean {
  return OFFICE_ZONES.some(zone => haversineDistance(lat, lng, zone.lat, zone.lng) <= zone.radius);
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

type LivenessStep = 'blink' | 'challenge' | 'done';
type Challenge = 'smile';

export default function SelfieCapture({ open, onClose, onCapture }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<LivenessStep>('blink');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Mediapipe state
  const faceLandmarkerRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const stepRef = useRef<LivenessStep>('blink');
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasCapturedRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (open) {
      hasCapturedRef.current = false;
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
      setError("Geolocation is not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setError(`Location error: ${err.message}`);
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
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      setError("Camera access denied.");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
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
      setError("AI model failed to load.");
    }
  };

  const predict = () => {
    // 🔥 NEVER run detection after capture
    if (hasCapturedRef.current) return;

    if (
      !videoRef.current ||
      !faceLandmarkerRef.current ||
      videoRef.current.readyState < 2
    ) {
      animationRef.current = requestAnimationFrame(predict);
      return;
    }

    const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
    const hasFace = results?.faceLandmarks?.length > 0;
    setFaceDetected(hasFace);

    if (hasFace && results.faceBlendshapes?.[0]?.categories) {
      const bs = results.faceBlendshapes[0].categories;
      const eyeBlinkLeft  = bs.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score  || 0;
      const eyeBlinkRight = bs.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score || 0;
      const smileL = bs.find((c: any) => c.categoryName === 'mouthSmileLeft')?.score  || 0;
      const smileR = bs.find((c: any) => c.categoryName === 'mouthSmileRight')?.score || 0;

      setStep(prev => {
        const next =
          prev === 'blink'     && (eyeBlinkLeft > 0.4 || eyeBlinkRight > 0.4) ? 'challenge' :
          prev === 'challenge' && (smileL > 0.5 || smileR > 0.5)               ? 'done' :
          prev;

        // 🔥 FIRE CAPTURE INLINE — synchronous ref gate, no state race
        if (next === 'done' && !hasCapturedRef.current) {
          hasCapturedRef.current = true;
          setCapturing(true);

          // Stop loop FIRST
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }

          // Defer capture by one frame so the canvas is ready
          requestAnimationFrame(() => {
            try {
              handleCapture();
            } catch (err) {
              console.error('Capture failed:', err);
              hasCapturedRef.current = false;
              setCapturing(false);
            }
          });
        }

        return next;
      });
    }

    // Only schedule next frame if we haven't captured yet
    if (!hasCapturedRef.current) {
      animationRef.current = requestAnimationFrame(predict);
    }
  };

  const handleCapture = () => {
    const currentLocation = locationRef.current;
    if (!videoRef.current || !canvasRef.current || !currentLocation) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Overlay
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
    ctx.fillText('VERIFIED LIVE', canvas.width - 145, canvas.height - 35);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

    // Stop camera tracks — loop already stopped by predict()
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // 🔥 FIRE CALLBACK IMMEDIATELY
    onCapture(dataUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Verification</DialogTitle>
          <DialogDescription>Liveness check</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[3/4] bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-20">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
              <p className="text-sm font-medium">Starting Camera...</p>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'}`} />
          
          <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent z-20">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full">
                  {faceDetected ? 'Face Detected' : 'No Face Detected'}
                </span>
              </div>

              {step === 'blink' && (
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 animate-pulse">
                  <p className="text-white text-lg font-bold">Please Blink Your Eyes 👁️</p>
                </div>
              )}
              {step === 'challenge' && (
                <div className="bg-orange-500/20 backdrop-blur-md px-6 py-3 rounded-full border border-orange-500/50 animate-pulse">
                  <p className="text-white text-lg font-bold">Please Smile! 😊</p>
                </div>
              )}
              {step === 'done' && (
                <div className="bg-emerald-500/20 backdrop-blur-md px-6 py-3 rounded-full border border-emerald-500/50">
                  <p className="text-emerald-400 text-lg font-bold">Verified! Capturing...</p>
                </div>
              )}
              
              {!loading && location && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isWithinAnyZone(location.lat, location.lng) ? 'bg-green-500' : 'bg-orange-500'}`} />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
                    {isWithinAnyZone(location.lat, location.lng) ? 'Within Office Range' : 'Outside Office Boundary'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white z-30"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="p-4 bg-red-50 text-red-600 text-sm text-center">{error}</div>}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
