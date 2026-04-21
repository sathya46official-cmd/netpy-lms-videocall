'use client';
import { useEffect, useState } from 'react';
import {
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  ScreenShareButton,
  RecordCallButton,
  ReactionsButton,
  SpeakingWhileMutedNotification,
  useCall,
} from '@stream-io/video-react-sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LayoutList, MessageSquare, Hand, PenLine, HelpCircle, MoreVertical, Smile } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Loader from './Loader';
import UnifiedEndCallButton from './UnifiedEndCallButton';
import ChatWindow from './ChatWindow';
import Whiteboard from './Whiteboard';
import QAPanel from './QAPanel';
import { cn } from '@/lib/utils';
import { useRole } from '@/hooks/useRole';
import { useToast } from './ui/use-toast';

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('grid');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const { useCallCallingState, useHasOngoingScreenShare } = useCallStateHooks();
  const { user, isStaffOrAbove } = useRole();
  const { toast } = useToast();

  const callingState = useCallCallingState();
  const hasOngoingScreenShare = useHasOngoingScreenShare();
  const call = useCall();
  
  const isMeetingOwner = isStaffOrAbove;

  useEffect(() => {
    if (!call) return;
    const unsubscribe = call.on('call.reaction_new', (event) => {
      const e = event as any;
      if (e.reaction?.type === 'raised-hand') {
        const reactedUser = e.reaction.user || e.user;
        const name = reactedUser?.name || reactedUser?.id;
        if (isMeetingOwner) {
          toast({ title: `${name} raised their hand! ✋` });
        }
        
        const tiles = document.querySelectorAll('.str-video__participant-view');
        tiles.forEach(tile => {
          if (tile.innerHTML.includes(reactedUser?.id) || tile.innerHTML.includes(name)) {
            tile.classList.add('golden-border');
            setTimeout(() => tile.classList.remove('golden-border'), 10000);
          }
        });
      }
    });
    return () => unsubscribe();
  }, [call, isMeetingOwner, toast]);

  const toggleRaiseHand = async () => {
    try {
      await call?.sendReaction({ type: 'raised-hand', emoji_code: ':raise-hand:' });
      toast({ title: 'You raised your hand' });
    } catch(err) {
      console.error(err);
    }
  };

  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    // Override layout automatically if someone is screen sharing!
    if (hasOngoingScreenShare && layout === 'grid') {
      return <SpeakerLayout participantsBarPosition="bottom" />; // Best for screen share
    }

    switch (layout) {
      case 'grid':
        return <PaginatedGridLayout />;
      case 'speaker-right':
        return <SpeakerLayout participantsBarPosition="left" />;
      default:
        return <SpeakerLayout participantsBarPosition="right" />;
    }
  };

  return (
    <section className="relative h-screen w-full overflow-hidden pt-4 text-white bg-dark-2">
      <style>{`
        .golden-border {
          border: 4px solid gold !important;
          border-radius: 12px;
          box-shadow: 0 0 15px gold;
          transition: all 0.3s ease;
        }
        /* Make mobile layout more compact */
        @media (max-width: 640px) {
          .str-video__call-controls__button {
            height: 36px;
            width: 36px;
          }
          .icon-btn-container {
             padding: 6px 12px !important;
          }
        }
      `}</style>
      <div className="relative flex size-full items-center justify-center pb-24">
        {showWhiteboard ? (
          <div className="flex size-full items-center p-4">
            {user?.id && user?.username ? (
              <Whiteboard 
                meetingId={call?.id ?? ''}
                isHost={isMeetingOwner}
                currentUserId={user.id}
                currentUserName={user.username}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-white text-slate-600">
                Whiteboard is unavailable until your profile finishes loading.
              </div>
            )}
          </div>
        ) : (
          <div className="flex size-full max-w-[1200px] items-center px-2">
            <CallLayout />
          </div>
        )}
        
        <div
          className={cn('h-[calc(100vh-100px)] hidden ml-2 w-full max-w-[350px] rounded-lg overflow-hidden shrink-0 shadow-lg z-10', {
            'show-block': showChat,
          })}
        >
          {call?.id && <ChatWindow callId={call.id} isTeacher={isMeetingOwner} onClose={() => setShowChat(false)} />}
        </div>
        <div
          className={cn('h-[calc(100vh-100px)] hidden ml-2 w-full max-w-[350px] rounded-lg overflow-hidden shrink-0 shadow-lg z-10', {
            'show-block': showParticipants,
          })}
        >
          <CallParticipantsList onClose={() => setShowParticipants(false)} />
        </div>
        {showQA && call?.id && (
          <div className="h-[calc(100vh-100px)] ml-2 flex-shrink-0 w-full max-w-[350px] z-10 shadow-lg">
            <QAPanel callId={call.id} onClose={() => setShowQA(false)} />
          </div>
        )}
      </div>

      {/* Video layout and call controls - Redesigned bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 flex w-full items-center justify-center gap-2 p-3 bg-dark-1/80 backdrop-blur-md border-t border-dark-3 sm:px-6 md:gap-4 z-20">
        
        {/* Mobile: Wrap less critical items in "More", Desktop: Show all */}
        <div className="hidden md:flex items-center justify-center gap-3">
          {isMeetingOwner && <RecordCallButton />}
          <button onClick={toggleRaiseHand} className="transition-all hover:scale-105" title="Raise Hand">
            <div className="icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b] flex items-center justify-center">
              <Hand size={20} className="text-white" />
            </div>
          </button>
          <ReactionsButton />
        </div>

        <div className="flex items-center justify-center gap-2">
           <SpeakingWhileMutedNotification>
              <ToggleAudioPublishingButton />
            </SpeakingWhileMutedNotification>
            <ToggleVideoPublishingButton />
            {isMeetingOwner && <ScreenShareButton />}
        </div>

        {/* Desktop features */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => {setShowChat(p => !p); setShowQA(false); setShowParticipants(false);}} className="transition-all hover:scale-105" title="Chat">
            <div className={cn("icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]", {"bg-blue-1 hover:bg-blue-600": showChat })}>
              <MessageSquare size={20} className="text-white" />
            </div>
          </button>

          <button onClick={() => {setShowQA(p => !p); setShowChat(false); setShowParticipants(false);}} className="transition-all hover:scale-105" title="Q&A">
            <div className={cn("icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]", {"bg-sky-600 hover:bg-sky-700": showQA })}>
              <HelpCircle size={20} className="text-white" />
            </div>
          </button>

          <button onClick={() => setShowWhiteboard(p => !p)} className="transition-all hover:scale-105" title="Whiteboard">
            <div className={cn("icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]", {"bg-blue-1 hover:bg-blue-600": showWhiteboard })}>
              <PenLine size={20} className="text-white" />
            </div>
          </button>

          <button onClick={() => {setShowParticipants(p => !p); setShowChat(false); setShowQA(false);}} title="Participants">
            <div className={cn("icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]", {"bg-blue-1 hover:bg-blue-600": showParticipants})}>
              <Users size={20} className="text-white" />
            </div>
          </button>
        </div>

        {/* Mobile Dropdown for extras */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger className="icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b] flex items-center h-10 w-10 justify-center">
              <MoreVertical size={20} className="text-white" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white pb-2">
              <DropdownMenuItem onClick={() => {setShowChat(p => !p); setShowQA(false); setShowParticipants(false);}}>
                <MessageSquare size={16} className="mr-2"/> Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {setShowQA(p => !p); setShowChat(false); setShowParticipants(false);}}>
                <HelpCircle size={16} className="mr-2"/> Q&A
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowWhiteboard(p => !p)}>
                <PenLine size={16} className="mr-2"/> Whiteboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {setShowParticipants(p => !p); setShowChat(false); setShowQA(false);}}>
                <Users size={16} className="mr-2"/> Participants
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleRaiseHand}>
                <Hand size={16} className="mr-2"/> Raise Hand
              </DropdownMenuItem>
              <DropdownMenuSeparator className="border-dark-1" />
              <div className="px-2 pt-1">
                <p className="text-xs text-gray-400 mb-1 px-1">Reactions</p>
                <ReactionsButton />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DropdownMenu>
          <div className="flex items-center">
            <DropdownMenuTrigger className="icon-btn-container cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b] hidden sm:flex">
              <LayoutList size={20} className="text-white" />
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white">
            {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
              <div key={index}>
                <DropdownMenuItem onClick={() => setLayout(item.toLowerCase() as CallLayoutType)}>
                  {item}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="border-dark-1" />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden lg:block">
          <CallStatsButton />
        </div>

        <UnifiedEndCallButton />
      </div>
    </section>
  );
};

export default MeetingRoom;
