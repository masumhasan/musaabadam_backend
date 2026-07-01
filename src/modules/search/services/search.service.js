const User = require('../../../models/User');
const Product = require('../../../models/Product');
const Stream = require('../../../models/Stream');
const { ROLES, PRODUCT_STATUS, LISTING_TYPES } = require('../../../config/constants');
const { STREAM_STATUS, STREAM_VISIBILITY } = require('../../../models/Stream');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Map stream filter → status list.
const STREAM_FILTER = {
  live: [STREAM_STATUS.LIVE],
  upcoming: [STREAM_STATUS.SCHEDULED],
  ended: [STREAM_STATUS.ENDED],
};

// Unified search across sellers, products, and live shows.
// `type` (all|sellers|products|streams) scopes the search; `filter` refines
// (streams: live/upcoming/ended · products: auction/buy_now).
const search = async ({ q, type = 'all', filter, limit = 20 }) => {
  const term = (q || '').trim();
  if (!term) return { sellers: [], products: [], streams: [] };

  const rx = new RegExp(escapeRegex(term), 'i');
  const lim = Math.min(Number(limit) || 20, 50);
  const wantAll = type === 'all';

  const result = { sellers: [], products: [], streams: [] };

  if (wantAll || type === 'sellers') {
    result.sellers = await User.find({
      role: ROLES.SELLER,
      deletedAt: null,
      $or: [{ username: rx }, { displayName: rx }],
    })
      .select('username displayName avatarUrl averageRating ratingCount')
      .limit(lim);
  }

  if (wantAll || type === 'products') {
    const pq = { deletedAt: null, status: PRODUCT_STATUS.ACTIVE, $or: [{ title: rx }, { tags: rx }] };
    if (filter === 'auction') pq.listingType = LISTING_TYPES.AUCTION;
    if (filter === 'buy_now') pq.listingType = LISTING_TYPES.BUY_IT_NOW;
    result.products = await Product.find(pq)
      .select('title price listingType images currentHighBid startingPrice flashSale flashSalePrice status')
      .limit(lim);
  }

  if (wantAll || type === 'streams') {
    const sq = {
      deletedAt: null,
      visibility: { $ne: STREAM_VISIBILITY.PRIVATE },
      $or: [{ title: rx }, { tags: rx }],
    };
    const statuses = STREAM_FILTER[filter];
    sq.status = statuses ? { $in: statuses } : { $in: [STREAM_STATUS.LIVE, STREAM_STATUS.SCHEDULED] };
    result.streams = await Stream.find(sq)
      .select('title status thumbnailUrl scheduledAt startedAt totalViewers')
      .populate('sellerId', 'username displayName avatarUrl')
      .limit(lim);
  }

  return result;
};

module.exports = { search };
