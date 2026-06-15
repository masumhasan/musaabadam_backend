const { verifyToken } = require('../utils/jwtService');
const User = require('../models/User');
const Product = require('../models/Product');
const Stream = require('../models/Stream');
const logger = require('../utils/logger');

const registerBiddingSocket = (io) => {
  // Authenticate every socket connection via JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication error: no token'));

      const decoded = verifyToken(token);
      // Reject non-access tokens (email_verify, otp_verified, etc.)
      if (decoded.type && decoded.type !== 'access') {
        return next(new Error('Authentication error: invalid token type'));
      }

      const user = await User.findById(decoded.sub).select('_id username displayName avatarUrl role');
      if (!user) return next(new Error('Authentication error: user not found'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.user._id}`);

    // Viewer/host joins a stream room to receive bid updates
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

    // Viewer places a bid on the pinned product
    socket.on('place-bid', async ({ streamId, productId, amount }) => {
      try {
        if (!streamId || !productId || amount == null) {
          return socket.emit('bid-error', { message: 'streamId, productId and amount are required' });
        }

        const bidAmount = parseFloat(amount);
        if (isNaN(bidAmount) || bidAmount <= 0) {
          return socket.emit('bid-error', { message: 'Invalid bid amount' });
        }

        const product = await Product.findById(productId);
        if (!product) return socket.emit('bid-error', { message: 'Product not found' });
        if (product.listingType !== 'auction') return socket.emit('bid-error', { message: 'Product is not an auction listing' });

        // Auction end-time guard
        if (product.auctionEndsAt && new Date() > new Date(product.auctionEndsAt)) {
          return socket.emit('bid-error', { message: 'Auction has ended' });
        }

        const floor = product.currentHighBid ?? product.startingPrice ?? 0;
        if (bidAmount <= floor) {
          return socket.emit('bid-error', {
            message: `Bid must exceed current high of $${floor.toFixed(2)}`,
          });
        }

        product.currentHighBid = bidAmount;
        await product.save();

        const update = {
          productId: String(product._id),
          streamId,
          currentHighBid: bidAmount,
          bidder: {
            userId: String(socket.user._id),
            displayName: socket.user.displayName || socket.user.username,
          },
        };

        io.to(`stream:${streamId}`).emit('bid-updated', update);
      } catch {
        socket.emit('bid-error', { message: 'Failed to place bid' });
      }
    });

    // Leave a stream room
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

module.exports = { registerBiddingSocket };
