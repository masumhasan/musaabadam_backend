const { body, query, param } = require('express-validator');
const { LISTING_TYPES, PRODUCT_CONDITIONS, PRODUCT_STATUS } = require('../../../config/constants');

const productIdParam = [
  param('productId').isMongoId().withMessage('Invalid product ID'),
];

const createProductValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 3000 }),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('condition')
    .isIn(Object.values(PRODUCT_CONDITIONS))
    .withMessage(`Condition must be one of: ${Object.values(PRODUCT_CONDITIONS).join(', ')}`),
  body('listingType')
    .isIn(Object.values(LISTING_TYPES))
    .withMessage(`Listing type must be one of: ${Object.values(LISTING_TYPES).join(', ')}`),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  // Buy It Now requires a price
  body('price')
    .if(body('listingType').equals(LISTING_TYPES.BUY_IT_NOW))
    .isFloat({ min: 0.01 })
    .withMessage('Price is required for Buy It Now listings'),

  // Auction requires starting price + end time
  body('startingPrice')
    .if(body('listingType').equals(LISTING_TYPES.AUCTION))
    .isFloat({ min: 0.01 })
    .withMessage('Starting price is required for auctions'),
  body('auctionEndsAt')
    .if(body('listingType').equals(LISTING_TYPES.AUCTION))
    .isISO8601().withMessage('Auction end time must be a valid ISO date')
    .custom((value) => {
      if (new Date(value) <= new Date()) throw new Error('Auction end time must be in the future');
      return true;
    }),
  body('reservePrice').optional().isFloat({ min: 0 }),

  // Optional fields
  body('images').optional().isArray({ max: 8 }).withMessage('Maximum 8 images'),
  body('images.*').optional().isURL().withMessage('Each image must be a valid URL'),
  body('sku').optional().trim().isLength({ max: 100 }),
  body('costPerItem').optional().isFloat({ min: 0 }),
  body('flashSale').optional().isBoolean(),
  body('acceptOffers').optional().isBoolean(),
  body('maxDiscount').optional().isFloat({ min: 0, max: 100 }),
  body('reserveForLive').optional().isBoolean(),
  body('shippingWeight').optional().isFloat({ min: 0 }),
  body('hazardousMaterials').optional().isBoolean(),
  body('publishNow').optional().isBoolean(),
  body('tags').optional().isArray({ max: 10 }),
  body('tags.*').optional().trim().isLength({ min: 1, max: 50 }),
];

const updateProductValidator = [
  body('title').optional().trim().notEmpty().isLength({ max: 120 }),
  body('description').optional().trim().notEmpty().isLength({ max: 3000 }),
  body('category').optional().trim().notEmpty(),
  body('condition').optional().isIn(Object.values(PRODUCT_CONDITIONS)),
  body('listingType').optional().isIn(Object.values(LISTING_TYPES)),
  body('quantity').optional().isInt({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('startingPrice').optional().isFloat({ min: 0 }),
  body('auctionEndsAt').optional().isISO8601(),
  body('reservePrice').optional().isFloat({ min: 0 }),
  body('images').optional().isArray({ max: 8 }),
  body('images.*').optional().isURL(),
  body('sku').optional().trim().isLength({ max: 100 }),
  body('costPerItem').optional().isFloat({ min: 0 }),
  body('flashSale').optional().isBoolean(),
  body('acceptOffers').optional().isBoolean(),
  body('maxDiscount').optional().isFloat({ min: 0, max: 100 }),
  body('reserveForLive').optional().isBoolean(),
  body('shippingWeight').optional().isFloat({ min: 0 }),
  body('hazardousMaterials').optional().isBoolean(),
  body('tags').optional().isArray({ max: 10 }),
];

const listProductsValidator = [
  query('category').optional().trim().isLength({ min: 1, max: 100 }),
  query('listingType').optional().isIn(Object.values(LISTING_TYPES)),
  query('condition').optional().isIn(Object.values(PRODUCT_CONDITIONS)),
  query('status').optional().isIn([...Object.values(PRODUCT_STATUS), 'all']),
  query('search').optional().trim().isLength({ min: 1, max: 200 }),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('sellerId').optional().isMongoId(),
  query('sort').optional().isIn(['newest', 'price_asc', 'price_desc', 'ending_soon']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];

const inventoryQueryValidator = [
  query('status').optional().isIn(Object.values(PRODUCT_STATUS)),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];

module.exports = {
  productIdParam,
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  inventoryQueryValidator,
};
