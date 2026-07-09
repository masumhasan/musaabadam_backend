const registerDmSocket = (io) => {
  io.on('connection', (socket) => {
    // The shared auth middleware (from bidding.socket.js) populates socket.user
    if (socket.user && socket.user._id) {
      const userIdStr = String(socket.user._id);
      socket.join(`user:${userIdStr}`);
      
      // Also allow explicit join/leave if necessary for any reason
      socket.on('join-personal-room', () => {
        socket.join(`user:${userIdStr}`);
      });
      socket.on('leave-personal-room', () => {
        socket.leave(`user:${userIdStr}`);
      });
    }
  });
};

module.exports = { registerDmSocket };
