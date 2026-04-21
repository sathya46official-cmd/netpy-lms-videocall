'use client';

import { useCall, useCallStateHooks } from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';
import { useRole } from '@/hooks/useRole';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { LogOut, PhoneOff } from 'lucide-react';

const UnifiedEndCallButton = () => {
  const call = useCall();
  const router = useRouter();
  const { isStaffOrAbove } = useRole();

  if (!call) return null;

  const isMeetingOwner = isStaffOrAbove;

  const leaveCall = async () => {
    await call.leave();
    router.push('/');
  };

  const endCallForEveryone = async () => {
    await call.endCall();
    router.push('/');
  };

  // For students/non-owners, just show a simple Leave button
  if (!isMeetingOwner) {
    return (
      <Button 
        onClick={leaveCall} 
        className="bg-red-500 hover:bg-red-600 focus:ring-0 gap-2 font-semibold"
      >
        <LogOut size={18} />
        Leave
      </Button>
    );
  }

  // For instructors/admins, show a dropdown with both options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-red-500 hover:bg-red-600 focus:ring-0 gap-2 font-semibold font-sans">
          <PhoneOff size={18} />
          End
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white border border-gray-700 min-w-[200px] mb-2 right-0">
        <DropdownMenuItem 
          onClick={leaveCall}
          className="cursor-pointer py-3 hover:bg-dark-2 text-gray-200 focus:bg-dark-2 focus:text-white"
        >
          <LogOut size={18} className="mr-2" />
          Leave Meeting
        </DropdownMenuItem>
        
        <div className="h-[1px] bg-gray-700 w-full my-1"></div>
        
        <DropdownMenuItem 
          onClick={endCallForEveryone}
          className="cursor-pointer py-3 text-red-500 hover:bg-dark-2 hover:text-red-400 focus:bg-dark-2 focus:text-red-400 font-semibold"
        >
          <PhoneOff size={18} className="mr-2" />
          End for All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UnifiedEndCallButton;
