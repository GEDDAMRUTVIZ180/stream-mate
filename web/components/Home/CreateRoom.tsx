'use client';

import { FC } from 'react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

type CreateRoomProps = {};

const CreateRoom: FC<CreateRoomProps> = () => {
  const router = useRouter();

  const createRoom = () => {
    const id = uuidv4();
    router.push(`/room/${id}`);
  };

  return (
    <Button variant="outline" onClick={createRoom} className="font-bold">
      Create Room
    </Button>
  );
};

export default CreateRoom;
