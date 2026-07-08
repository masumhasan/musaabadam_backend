# BidsRush — Buyer (User) Flow (Living Document)

> Source of truth for buyer-side app flows. **Update this file whenever a buyer feature or flow changes.**
> Legend: ✅ implemented & integrated · 🟡 partial · ❌ missing
> Last updated: 2026-07-01 (partial-feature completion pass)

## Changelog — 2026-07-01 partial-feature completion
- **Watch stream**: live viewer count (realtime), floating emoji reactions overlay (tap ❤️).
- **Auction bidding**: reflects pause/resume/cancel banners; per-auction increment respected.
- **Buy Now**: one-tap in-stream Buy now → checkout; live sold-out notice.
- **Chat**: tap-to-reply, @mentions render, slow-mode notices.
- **Checkout**: inline shipping-address picker (recomputes shipping + region tax); tax now calculated (VAT by destination).
- **Order tracking**: `completed` state + "Confirm receipt" action.
- **Search**: unified search across sellers/products/live shows with Live/Upcoming/Ended/Auction/Buy-now filters.
- **Seller profile**: upcoming + previous shows loaded from the seller's streams. *(Reviews/ratings still need a `Review` model — tracked as a missing feature.)*


---

## 1. Buyer Onboarding 🟡

**Flow:** Register → Verify Email (OTP) → Home Feed → (add address / payment method when needed).

| Feature | State | Notes |
|---|---|---|
| Register | ✅ | `POST /auth/register` (+ optional `referralCode`) |
| Login / Logout / Refresh | ✅ | `/auth/login`, `/auth/logout`, `/auth/refresh-token` |
| Email verification | ✅ | 6-digit OTP, `/auth/verify-email` |
| Password reset | ✅ | `/auth/forgot-password` → verify OTP → reset |
| Address | ✅ | `/users/addresses` CRUD |
| Payment method | ✅ | `/payments/methods` (mock provider tokens) |
| Home feed | ✅ | Live streams + past shows + categories |
| Google / Apple / Phone login | ❌ | Not implemented |

---

## 2. Browse Feed 🟡

| Feature | State | Notes |
|---|---|---|
| Live streams | ✅ | `GET /streams` → home grid (empty-state = "No live streams right now") |
| Categories | ✅ | `GET /categories`, category screen |
| Trending / Recommended / Following feeds | ❌ | No ranking/recommendation/following-feed endpoints |
| Infinite scroll | 🟡 | Backend paginates; app grids are single-page |
| Search | 🟡 | Product text index + stream list; **no unified search endpoint across sellers/products/streams with Live/Upcoming/Ended/Auction/BuyNow filters** |

---

## 3. Watch Live Stream ✅ (🟡 reactions)

**Flow:** Tap live card → `POST /streams/:id/join` (GetStream token) → watch video → chat/bid/buy.

| Feature | State | Notes |
|---|---|---|
| Video | ✅ | GetStream Video SDK |
| Live chat | ✅ | Socket `chat-message`, history `GET /chat/streams/:id/messages` |
| Current product / bid button / buy button | ✅ | Pinned product + bidding section |
| Viewer count | 🟡 | Static `totalViewers`; no realtime update |
| Live reactions | 🟡 | `send-reaction`/`reaction` socket wired in controller; **no floating-reaction UI render** |

---

## 4. Follow Seller 🟡

| Feature | State | Notes |
|---|---|---|
| Follow / Unfollow | ✅ | `POST/DELETE /users/:id/follow`, `Follower` model |
| Followers / Following lists | ✅ | `GET /users/:id/followers|following` |
| Follow notifications | ❌ | No notification emitted (no notifications system) |

---

## 5. Live Chat 🟡

| Feature | State | Notes |
|---|---|---|
| Send messages | ✅ | `send-message` socket / REST fallback |
| Emojis | ✅ | Plain text + `send-reaction` |
| Message moderation | ✅ | Profanity mask, `message-deleted`, mute |
| Slow mode | 🟡 | Fixed 5 msg / 5s rate limit (not configurable slow mode) |
| Replies / Mentions | ❌ | No reply threading or @mention |

---

## 6. Auction Bidding ✅ (🟡 notifications)

| Feature | State | Notes |
|---|---|---|
| Place bid + highest bid + bid history | ✅ | `bid-updated`, `GET /auctions/:id/bids` |
| Bid confirmation | ✅ | Socket echo / `bid-error` |
| Winner confirmation | ✅ | `auction-closed` → winner snackbar → checkout |
| Outbid notification | 🟡 | UI reflects new high bid; **no push/outbid notification** |

---

## 7. Buy Now Purchase 🟡

**Flow:** Pinned product → (order) → Checkout → pay → confirmation.

| Feature | State | Notes |
|---|---|---|
| Buy / checkout / confirmation / order creation | ✅ | `POST /orders` + `/payments/orders/:id/checkout|confirm` → `checkout_screen` |
| One-tap in-stream buy + sold-out realtime | ❌ | No instant in-stream buy socket flow |

---

## 8. Giveaway Entry ❌

No giveaway feature (see sellerflow.md §8).

---

## 9. Checkout ✅ (🟡 tax)

**Flow:** Order → Checkout screen → select card → Pay → escrow hold → Order confirmed → tracking.

| Feature | State | Notes |
|---|---|---|
| Shipping address | 🟡 | Address stored; checkout screen doesn't yet pick/edit address inline |
| Payment | ✅ | `/payments/orders/:id/checkout` + `confirm` (escrow) |
| Taxes | ❌ | `Order.taxAmount` field exists but no tax calculation engine |
| Confirmation / receipt | ✅ | Confirmation snackbar; `activity` receipt screens (partly mock) |

---

## 10. Order Tracking ✅

**Flow:** Order → Order Tracking screen → timeline.

| Status | State |
|---|---|
| pending / confirmed(paid) / processing / shipped / delivered | ✅ `GET /shipping/orders/:id/track` timeline + `order_tracking_screen` |
| completed | 🟡 delivered is terminal |

---

## 11. Seller Profile (buyer view) 🟡

| Feature | State | Notes |
|---|---|---|
| Products / Followers / Following | ✅ | Public profile + follow lists |
| Upcoming / Previous shows | 🟡 | Stream lists exist; profile tabs partly mock |
| Reviews / Ratings | ❌ | `averageRating`/`ratingCount` fields only; no `Review` model/endpoints; `review_tab` is mock |

---

## 12. Notifications ❌

`User.fcmTokens` exists; `notificationScreen` is **mock**; backend `notifications` module is **empty**. Missing all types: live started, auction started, outbid, auction won, order shipped, giveaway won, new follower, new message. No `Notification` model, no push (FCM), no realtime notifications channel.

---

## Cross-cutting

| Area | State |
|---|---|
| Wishlist / Favorites | ❌ `Product.favoritesCount` only; no `Favorite` model/endpoint/UI |
| Reviews | ❌ (see §11) |
| Reports (user/seller/stream) | ❌ report UI is mock; no `Report` model/endpoint. **Block user ✅** (`/users/:id/block`) |
| Search + filters | 🟡 (see §2) |
| Auth security | ✅ helmet, CORS, global rate limit, express-validator, JWT access/refresh |
| Image storage | ✅ S3 presigned (requires AWS env) |
| Payments | ✅ mock provider (Stripe-swappable via `STRIPE_SECRET_KEY`) |

---

## Buyer Realtime Summary

Implemented: `joined/left`, `bid-updated`, `auction-started`, `auction-closed`, `chat-message`, `message-deleted`, `reaction`, `user-muted`.
Missing: viewer-joined/left/count, stream-started/ended feed broadcast, auction-paused/resumed, winner-selected popup event (currently via auction-closed), product-pinned, buy-now-purchase, giveaway-*, notifications, seller-online/offline.
