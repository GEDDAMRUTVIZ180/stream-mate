'use client';

import {
  FC,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
  use
} from 'react';

import { useRouter } from 'next/navigation';
import { Socket, io } from 'socket.io-client';

import { Button } from '@/components/ui/button';
import { Mic, MicOff, Camera, CameraOff, ScreenShare } from 'lucide-react';
import { toast } from 'sonner';

type Message = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function handleGetUserMediaError(error: Error) {
  switch (error.name) {
    case 'NotAllowedError':
      toast.error('Permission denied: Please allow camera/microphone.');
      break;
    case 'NotFoundError':
      toast.error('Camera or microphone not found.');
      break;
    default:
      toast.error('Error accessing media devices.');
  }
}

const Page: FC<{ params: Promise<{ id: string }> }> = ({ params }) => {
  const { id } = use(params);
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const id2ContentRef = useRef<Map<string, string>>(new Map());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const politeRef = useRef(false);

  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);

  const config: RTCConfiguration = useMemo(() => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }), []);

  const handleNegotiationNeeded = useCallback(async () => {
    try {
      makingOfferRef.current = true;

      if (!pcRef.current) return;

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      socketRef.current?.emit('message', { description: offer }, id);
    } finally {
      makingOfferRef.current = false;
    }
  }, [id]);

  const handleTrack = useCallback((event: RTCTrackEvent) => {
    const stream = event.streams[0];
    const content = id2ContentRef.current.get(stream.id);

    if (content === 'screen') {
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
    } else {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const handleICECandidate = useCallback(
    (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        socketRef.current?.emit(
          'message',
          { candidate: event.candidate.toJSON() },
          id
        );
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      id2ContentRef.current.set(stream.id, 'webcam');

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      localStreamRef.current = stream;
    } catch (error) {
      handleGetUserMediaError(error as Error);
    }
  }, []);

  const handlePeerMessage = useCallback(
    async ({ description, candidate }: Message) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (description) {
          const offerCollision =
            description.type === 'offer' &&
            (makingOfferRef.current || pc.signalingState !== 'stable');

          ignoreOfferRef.current = !politeRef.current && offerCollision;

          if (ignoreOfferRef.current) return;

          await pc.setRemoteDescription(
            new RTCSessionDescription(description)
          );

          if (description.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current?.emit(
              'message',
              { description: answer },
              id
            );
          }
        }

        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error(err);
      }
    },
    [id]
  );

  const addTracksToPC = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
  }, []);

  useEffect(() => {
    const socket = io('https://stream-mate.onrender.com', {
      transports: ['websocket']
    });

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

      pcRef.current = pc;
    });

    socket.on('room-full', () => router.push('/'));

    socket.on('ready', () => {
      const pc = createPeer();
      addTracksToPC(pc);
      pcRef.current = pc;
    });

    socket.on('message', handlePeerMessage);

    socket.on('user-disconnected', () => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      pcRef.current?.close();
      pcRef.current = null;
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      pcRef.current?.close();
    };
  }, [id, router, createPeer, getUserMedia, handlePeerMessage, addTracksToPC]);

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setMic(prev => !prev);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setCamera(prev => !prev);
  };

  const handleScreenShare = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    id2ContentRef.current.set(stream.id, 'screen');

    stream.getTracks().forEach(track => {
      pcRef.current?.addTrack(track, stream);
    });

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = stream;
      screenVideoRef.current.muted = true;
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-center mb-8">
          Video Conference Room
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <video ref={localVideoRef} autoPlay muted className="rounded-xl bg-muted" />
          <video ref={remoteVideoRef} autoPlay className="rounded-xl bg-muted" />
          <video ref={screenVideoRef} autoPlay className="rounded-xl bg-muted" />
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={toggleMic}>
            {mic ? <Mic /> : <MicOff />}
          </Button>

          <Button onClick={toggleCam}>
            {camera ? <Camera /> : <CameraOff />}
          </Button>

          <Button onClick={handleScreenShare}>
            <ScreenShare />
          </Button>
        </div>
      </div>
    </main>
  );
};

export default Page;