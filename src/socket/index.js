const { Server } = require('socket.io');
const { registerBiddingSocket } = require('./bidding.socket');
const { registerChatSocket } = require('./chat.socket');
const auctionTimers = require('./auctionTimers');

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
    },
  });

  auctionTimers.setIO(io);
  auctionTimers.startSweeper();
  registerBiddingSocket(io);
  registerChatSocket(io);

  return io;
};

// Accessor so HTTP controllers can emit socket events (e.g. REST-placed bids).
const getIO = () => io;

module.exports = { initSocket, getIO };
