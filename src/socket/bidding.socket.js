const { verifyToken } = require('../utils/jwtService');
const User = require('../models/User');
const Stream = require('../models/Stream');
const auctionService = require('../modules/auctions/services/auction.service');
const { scheduleAuctionClose } = require('./auctionTimers');
const logger = require('../utils/logger');

// Shared JWT authentication for every socket connection. Attaches socket.user.
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error: no token'));

    const decoded = verifyToken(token);
    if (decoded.type && decoded.type !== 'access') {
      return next(new Error('Authentication error: invalid token type'));
    }

    const user = await User.findById(decoded.sub).select('_id username displayName avatarUrl role');
    if (!user) return next(new Error('Authentication error: user not found'));

    socket.user = user;
    return next();
  } catch {
    return next(new Error('Authentication error'));
  }
};

const registerBiddingSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.user._id}`);

    // Viewer/host joins a stream room to receive bid + auction updates.
    socket.on('join-stream', async ({ streamId }) => {
      try {
        if (!streamId) return socket.emit('error', { message: 'streamId required' });

        const stream = await Stream.findOne({ _id: streamId, deletedAt: null, status: 'live' });
        if (!stream) return socket.emit('error', { message: 'Stream not found or not live' });

        socket.join(`stream:${streamId}`);
        socket.emit('joined', { streamId });
      } catch {
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Viewer places a bid (manual or auto-bid) on the pinned auction product.
    socket.on('place-bid', async ({ streamId, productId, amount, maxAmount, isAutoBid }) => {
      try {
        if (!streamId || !productId || amount == null) {
          return socket.emit('bid-error', { message: 'streamId, productId and amount are required' });
        }

        const update = await auctionService.placeBid(socket.user._id, {
          productId,
          streamId,
          amount,
          maxAmount,
          isAutoBid,
        });

        // Anti-snipe pushed the close time out — reschedule the auto-close.
        if (update.extended && update.auctionEndsAt) {
          scheduleAuctionClose(productId, update.auctionEndsAt);
        }

        io.to(`stream:${streamId}`).emit('bid-updated', update);
      } catch (err) {
        socket.emit('bid-error', { message: err.isOperational ? err.message : 'Failed to place bid' });
      }
    });

    socket.on('leave-stream', ({ streamId }) => {
      if (streamId) {
        socket.leave(`stream:${streamId}`);
        socket.emit('left', { streamId });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { registerBiddingSocket, authenticateSocket };
