'use client';
import { useEffect, useState } from 'react';
import {
  DeviceSettings,
  VideoPreview,
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

  if (!call) {
    throw new Error(
      'useStreamCall must be used within a StreamCall component.',
    );
  }

  const [isMicCamToggled, setIsMicCamToggled] = useState(false);

  useEffect(() => {
    if (isMicCamToggled) {
      // Disable via SDK first
      call.camera.disable();
      call.microphone.disable();

      // Also stop the underlying hardware track so the camera light turns off
      call.camera.state.mediaStream
        ?.getVideoTracks()
        .forEach((track) => track.stop());
    } else {
      call.camera.enable();
      call.microphone.enable();
    }
  }, [isMicCamToggled, call]);

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

      {/* Only render the live VideoPreview when camera is ON.
          When off, show a placeholder so the hardware track is fully released. */}
      {isMicCamToggled ? (
        <div className="flex h-[270px] w-[480px] items-center justify-center rounded-2xl bg-gray-800">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-4xl">
              🎥
            </div>
            <p className="text-sm">Camera is off</p>
          </div>
        </div>
      ) : (
        <VideoPreview />
      )}

      <div className="flex h-16 items-center justify-center gap-3">
        <label className="flex items-center justify-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={isMicCamToggled}
            onChange={(e) => setIsMicCamToggled(e.target.checked)}
          />
          Join with mic and camera off
        </label>
        <DeviceSettings />
      </div>

      <Button
        className="rounded-md bg-green-500 px-4 py-2.5"
        onClick={async () => {
          if (isMicCamToggled) {
            await call.camera.disable();
            await call.microphone.disable();
          }
          await call.join();
          setIsSetupComplete(true);
        }}
      >
        Join meeting
      </Button>
    </div>
  );
};

export default MeetingSetup;
