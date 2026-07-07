const mongoose = require('mongoose');
const DirectMessage = require('../../../models/DirectMessage');
const User = require('../../../models/User');
const { HTTP_STATUS } = require('../../../config/constants');
const AppError = require('../../../utils/AppError');

const sendMessage = async (senderId, receiverId, text) => {
  if (senderId.toString() === receiverId.toString()) {
    throw new AppError('Cannot send message to yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new AppError('Recipient not found', HTTP_STATUS.NOT_FOUND);
  }

  const message = await DirectMessage.create({
    senderId,
    receiverId,
    text,
  });

  return message;
};

const getMessages = async (userId, partnerId, { page = 1, limit = 50 } = {}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

  const query = {
    $or: [
      { senderId: userObjectId, receiverId: partnerObjectId },
      { senderId: partnerObjectId, receiverId: userObjectId },
    ],
  };

  const skip = (Number(page) - 1) * Number(limit);

  // Mark all unread messages from partner as read
  await DirectMessage.updateMany(
    { senderId: partnerObjectId, receiverId: userObjectId, isRead: false },
    { $set: { isRead: true } }
  );

  const [messages, total] = await Promise.all([
    DirectMessage.find(query)
      .sort({ createdAt: 1 }) // Older messages first for chat view
      .skip(skip)
      .limit(Number(limit)),
    DirectMessage.countDocuments(query),
  ]);

  return {
    messages,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

const getConversations = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const conversations = await DirectMessage.aggregate([
    {
      $match: {
        $or: [
          { senderId: userObjectId },
          { receiverId: userObjectId },
        ],
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$senderId', userObjectId] },
            '$receiverId',
            '$senderId',
          ],
        },
        lastMessage: { $first: '$text' },
        lastMessageTime: { $first: '$createdAt' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiverId', userObjectId] },
                  { $eq: ['$isRead', false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'partner',
      },
    },
    {
      $unwind: '$partner',
    },
    {
      $project: {
        _id: 0,
        partnerId: '$_id',
        partnerName: { $ifNull: ['$partner.displayName', '$partner.username'] },
        partnerAvatar: '$partner.avatarUrl',
        lastMessage: 1,
        lastMessageTime: 1,
        unreadCount: 1,
      },
    },
    {
      $sort: { lastMessageTime: -1 },
    },
  ]);

  return conversations;
};

module.exports = {
  sendMessage,
  getMessages,
  getConversations,
};
