'use client';

import { FC, useEffect, useRef, useCallback, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { Socket, io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Camera, CameraOff, ScreenShare } from 'lucide-react';
import { toast } from 'sonner';

type Message = {
  description: RTCSessionDescription;
  candidate: RTCIceCandidate;
};

function handleGetUserMediaError(error: Error) {
  switch (error.name) {
    case 'NotAllowedError':
      toast.error('Permission denied: Please allow access to camera/microphone.');
      break;
    case 'NotFoundError':
      toast.error('No camera/microphone found on this device.');
      break;
    case 'NotReadableError':
      toast.error(
        'Could not access your media devices. They may be in use by another application.'
      );
      break;
    case 'OverconstrainedError':
      toast.error(`Constraints cannot be satisfied by available devices.`);
      break;
    case 'AbortError':
      toast.error('Media capture was aborted.');
      break;
    default:
      toast.error('An unknown error occurred while trying to access media devices.');
  }
}

const Page: FC<{ params: Promise<{ id: string }> }> = ({ params }) => {
  const { id } = use(params);
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const id2ContentRef = useRef(new Map<string, string>());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);
  const politeRef = useRef<boolean>(false);

  const [mic, setMic] = useState<boolean>(true);
  const [camera, setCamera] = useState<boolean>(true);

  const config: RTCConfiguration = useMemo(() => {
    return {
      iceServers: [
        {
          urls: ['stun:fr-turn3.xirsys.com', 'stun:stun1.l.google.com:19302']
        },
        {
          username:
            'mypv_nBgtsi595DUOKcQBvSThglQ0tIZXK1PTWosWAYSBZRv8fbVPJtCCMCEBWdIAAAAAGZ3Fz5zZW5ibw==',
          credential: 'e38da9f4-30c4-11ef-b935-0242ac120004',
          urls: [
            'turn:fr-turn3.xirsys.com:80?transport=udp',
            'turn:fr-turn3.xirsys.com:3478?transport=udp',
            'turn:fr-turn3.xirsys.com:80?transport=tcp',
            'turn:fr-turn3.xirsys.com:3478?transport=tcp',
            'turns:fr-turn3.xirsys.com:443?transport=tcp',
            'turns:fr-turn3.xirsys.com:5349?transport=tcp'
          ]
        }
      ]
    };
  }, []);

  const handleNegotiationNeeded = useCallback(async () => {
    try {
      makingOfferRef.current = true;
      await pcRef.current?.setLocalDescription();

      socketRef.current?.emit('message', { description: pcRef.current?.localDescription }, id);
    } catch (e) {
      console.log(e);
    } finally {
      makingOfferRef.current = false;
    }
  }, [id]);

  const handleTrack = useCallback(({ track, streams: [stream] }: RTCTrackEvent) => {
    const content = id2ContentRef.current.get(stream.id);

    if (content === 'screen') {
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
    } else if (content === 'webcam') {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const handleICECandidate = useCallback(
    (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        socketRef.current?.emit('message', { candidate: e.candidate }, id);
      }
    },
    [id]
  );

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection(config);

    pc.onnegotiationneeded = handleNegotiationNeeded;
    pc.ontrack = handleTrack;
    pc.onicecandidate = handleICECandidate;

    return pc;
  }, [config, handleNegotiationNeeded, handleTrack, handleICECandidate]);

  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      id2ContentRef.current.set(stream.id, 'webcam');

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;
    } catch (error) {
      handleGetUserMediaError(error as Error);
    }
  }, []);

  const handlePeerMessage = useCallback(
    async ({ description, candidate }: Message) => {
      try {
        if (description) {
          const offerCollision =
            description.type == 'offer' &&
            (makingOfferRef.current || pcRef.current?.signalingState !== 'stable');

          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) {
            return;
          }

          await pcRef.current?.setRemoteDescription(description);

          if (description.type === 'offer') {
            await pcRef.current?.setLocalDescription();
            socketRef.current?.emit(
              'message',
              { description: pcRef.current?.localDescription },
              id
            );
          }
        } else if (candidate) {
          try {
            await pcRef.current?.addIceCandidate(candidate);
          } catch (err) {
            if (!ignoreOfferRef) {
              throw err;
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
    },
    [id]
  );

  const addTracksToPC = useCallback((pc: RTCPeerConnection) => {
    localStreamRef.current
      ?.getTracks()
      .forEach((track) => pc.addTrack(track, localStreamRef.current!));
  }, []);

  useEffect(() => {
    const socket = io('https://streammate-signalling-server.onrender.com');
    console.log('socket', socket);
    socket.emit('room-join', id);

    socket.on('room-created', async () => {
      await getUserMedia();
    });

    socket.on('room-joined', async () => {
      politeRef.current = true;

      const pc = createPeer();
      await getUserMedia();
      addTracksToPC(pc);

      socket.emit('ready', id);
      socket.emit('id2Content', Array.from(id2ContentRef.current), id);
      pcRef.current = pc;
    });

    socket.on('room-full', () => {
      router.push('/');
    });

    socket.on('ready', () => {
      const pc = createPeer();
      addTracksToPC(pc);

      socket.emit('id2Content', Array.from(id2ContentRef.current), id);
      pcRef.current = pc;
    });

    socket.on('id2Content', (data: Array<[string, string]>) => {
      const map = new Map(data);
      map.forEach((value, key) => {
        id2ContentRef.current.set(key, value);
      });
    });

    socket.on('message', handlePeerMessage);

    socket.on('user-disconnected', () => {
      politeRef.current = false;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      pcRef.current?.close();
      socketRef.current = null;
      pcRef.current = null;
    };
  }, [id, router, createPeer, getUserMedia, handlePeerMessage, addTracksToPC]);

  const toggleMediaStream = useCallback((type: string, state: boolean) => {
    localStreamRef.current?.getTracks().forEach((track) => {
      if (track.kind === type) {
        track.enabled = !state;
      }
    });
  }, []);

  const toggleMic = useCallback(() => {
    toggleMediaStream('audio', mic);
    setMic((mic) => !mic);
  }, [toggleMediaStream, mic]);

  const toggleCam = useCallback(() => {
    toggleMediaStream('video', camera);
    setCamera((camera) => !camera);
  }, [toggleMediaStream, camera]);

  const handleScreenShare = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ audio: true });
    } catch (error) {
      switch ((error as Error).name) {
        case 'NotAllowedError':
          toast.error('Permission denied: Please allow access to screen sharing.');
          break;
        case 'NotFoundError':
          toast.error('No screen found on this device.');
      }
      return;
    }

    id2ContentRef.current.set(stream.id, 'screen');
    socketRef.current?.emit('id2Content', Array.from(id2ContentRef.current), id);

    stream.getTracks().forEach((track) => pcRef.current?.addTrack(track, stream));

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = stream;
      screenVideoRef.current.muted = true;
    }
  }, [id]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Video Conference Room
          </h1>
          <p className="text-muted-foreground">
            Share the <span className="text-red-500 font-semibold">room link</span> with your friend
            to start the call
          </p>
        </div>

        {/* Video Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Side Panel - Local & Remote Videos */}
          <div className="lg:col-span-3 space-y-4">
            {/* Local Video */}
            <div className="relative group">
              <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium">
                You
              </div>
              <video
                autoPlay
                ref={localVideoRef}
                muted
                className="w-full aspect-video bg-muted rounded-xl border-2 border-border shadow-lg object-cover"
              />
            </div>

            {/* Remote Video */}
            <div className="relative">
              <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium">
                Friend
              </div>
              <video
                autoPlay
                ref={remoteVideoRef}
                className="w-full aspect-video bg-muted rounded-xl border-2 border-border shadow-lg object-cover"
              />
            </div>
          </div>

          {/* Main Screen Share Area */}
          <div className="lg:col-span-9">
            <div className="relative bg-muted rounded-xl border-2 border-border shadow-lg overflow-hidden">
              <video
                ref={screenVideoRef}
                autoPlay
                className="w-full h-full min-h-[400px] lg:min-h-[500px] object-contain"
              />
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="flex justify-center">
          <div className="bg-card rounded-2xl shadow-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <Button
                variant={mic ? 'default' : 'destructive'}
                size="lg"
                onClick={toggleMic}
                className="rounded-xl h-12 w-12 p-0 transition-all hover:scale-105">
                {mic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button
                variant={camera ? 'default' : 'destructive'}
                size="lg"
                onClick={toggleCam}
                className="rounded-xl h-12 w-12 p-0 transition-all hover:scale-105">
                {camera ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={handleScreenShare}
                className="rounded-xl h-12 w-12 p-0 transition-all hover:scale-105">
                <ScreenShare className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Page;
