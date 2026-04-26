'use client';
import { useEffect, useRef, useState } from 'react';
import {
  DeviceSettings,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import Alert from './Alert';
import { Button } from './ui/button';

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const { useCallEndedAt, useCallStartsAt } = useCallStateHooks();
  const callStartsAt = useCallStartsAt();
  const callEndedAt = useCallEndedAt();
  const callTimeNotArrived =
    callStartsAt && new Date(callStartsAt) > new Date();
  const callHasEnded = !!callEndedAt;

  const call = useCall();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  if (!call) {
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );
  }

  const [isMicCamToggled, setIsMicCamToggled] = useState(false);

  // Start camera preview manually
  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied', err);
    }
  };

  // ACTUALLY stop camera hardware - kills the light
  const stopPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop(); // ← This is what turns off the light
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start preview on mount
  useEffect(() => {
    startPreview();
    // Cleanup on unmount — CRITICAL
    return () => stopPreview();
  }, []);

  // Checkbox toggle
  const handleCheckbox = (checked: boolean) => {
    setIsMicCamToggled(checked);
    if (checked) {
      stopPreview(); // light off
    } else {
      startPreview(); // light on, preview back
    }
  };

  const handleJoin = async () => {
    // Stop preview stream before joining — SDK will manage its own tracks
    stopPreview();

    if (isMicCamToggled) {
      await call?.camera.disable();
      await call?.microphone.disable();
    } else {
      // Stream SDK takes over from here
    }

    await call?.join({ create: true });
    setIsSetupComplete(true);
  };

  if (callTimeNotArrived)
    return (
      <Alert
        title={`Your Meeting has not started yet. It is scheduled for ${callStartsAt.toLocaleString()}`}
      />
    );

  if (callHasEnded)
    return (
      <Alert
        title="The call has been ended by the host"
        iconUrl="/icons/call-ended.svg"
      />
    );

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 text-white">
      <h1 className="text-center text-2xl font-bold">Setup</h1>

      {/* Raw browser video element instead of SDK VideoPreview */}
      <div className="flex h-[270px] w-[480px] items-center justify-center rounded-2xl bg-gray-800 overflow-hidden">
        {isMicCamToggled ? (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-4xl">
              🎥
            </div>
            <p className="text-sm">Camera is off</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]" // mirror effect
          />
        )}
      </div>

      <div className="flex h-16 items-center justify-center gap-3">
        <label className="flex items-center justify-center gap-2 font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isMicCamToggled}
            onChange={(e) => handleCheckbox(e.target.checked)}
          />
          Join with mic and camera off
        </label>
        <DeviceSettings />
      </div>

      <Button
        className="rounded-md bg-green-500 px-4 py-2.5"
        onClick={handleJoin}
      >
        Join meeting
      </Button>
    </div>
  );
};

export default MeetingSetup;

