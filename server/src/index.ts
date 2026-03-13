import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const port = process.env.PORT || 8081;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const userToRoomMap = new Map<string, Set<string>>();

io.on('connection', (socket) => {
  console.log('Socket connected -' + socket.id);

  socket.on('room-join', (roomID) => {
    const room = io.sockets.adapter.rooms.get(roomID);

    if (room === undefined) {
      socket.join(roomID);
      socket.emit('room-created');
    } else if (room.size === 1) {
      socket.join(roomID);
      socket.emit('room-joined');
    } else {
      socket.emit('room-full');
      return;
    }

    if (!userToRoomMap.has(socket.id)) {
      userToRoomMap.set(socket.id, new Set([roomID]));
    } else {
      userToRoomMap.get(socket.id)?.add(roomID);
    }
  });

  socket.on('ready', (roomID) => {
    socket.to(roomID).emit('ready');
  });

  socket.on('message', (message, roomID) => {
    socket.to(roomID).emit('message', message);
  });

  socket.on('id2Content', (id2Content, roomID) => {
    console.log('id2Content', id2Content);
    socket.to(roomID).emit('id2Content', id2Content);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected -' + socket.id);
    const rooms = userToRoomMap.get(socket.id);
    if (rooms) {
      rooms.forEach((roomID) => {
        socket.to(roomID).emit('user-disconnected', socket.id);
      });
    }

    userToRoomMap.delete(socket.id);
  });
});

server.listen(port, () => {
  console.log('Server listening at http://localhost:' + port);
});
