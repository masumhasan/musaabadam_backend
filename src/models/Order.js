const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed', // buyer confirmed receipt (terminal)
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: 'Product', required: true },
    title: { type: String, required: true },
    imageUrl: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const AddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    buyerId: { type: ObjectId, ref: 'User', required: true },
    sellerId: { type: ObjectId, ref: 'User', required: true },
    streamId: { type: ObjectId, ref: 'Stream' },

    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(arr) => arr.length > 0, 'Order must have at least one item'],
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },

    shippingAddressSnapshot: { type: AddressSnapshotSchema },

    trackingNumber: { type: String, trim: true },
    trackingCarrier: { type: String, trim: true },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },

    paymentMethod: { type: String, trim: true },
    paymentIntentId: { type: String, trim: true },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },

    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ sellerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ streamId: 1 });

module.exports = mongoose.model('Order', OrderSchema);
module.exports.ORDER_STATUS = ORDER_STATUS;
