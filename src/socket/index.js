const { Server } = require('socket.io');
const { registerBiddingSocket } = require('./bidding.socket');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
    },
  });

  registerBiddingSocket(io);

  return io;
};

module.exports = { initSocket };
