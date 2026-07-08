# BidsRush — Seller Flow (Living Document)

> Source of truth for seller-side app flows. **Update this file whenever a seller feature or flow changes.**
> Legend: ✅ implemented & integrated · 🟡 partial · ❌ missing
> Last updated: 2026-07-01 (partial-feature completion pass)

## Changelog — 2026-07-01 partial-feature completion
- **Auctions**: pause/resume/cancel + per-auction `bidIncrement` + host start/pause/resume/cancel controls in the live UI (events `auction-paused/resumed/cancelled`).
- **Live stream**: realtime viewer count/presence (`viewer-count`, `viewer-joined/left`), persistent ban (`ban-user`→`user-banned`/`banned`, `Stream.bannedUserIds`), pin message (`pin-message`→`message-pinned/unpinned`), floating emoji reactions overlay.
- **Buy Now**: realtime `product-pinned/unpinned`, `product-sold-out`, `buy-now-purchase`; one-tap in-stream Buy now → order → checkout; inventory decremented on paid confirm.
- **Chat**: replies (`replyTo`), @mentions (resolved to users), configurable slow mode (`set-slow-mode`/`Stream.chatSlowModeSeconds`).
- **Schedule show**: `draft` status + publish + delete + `visibility` (public/followers/private).
- **Flash sale**: `flashSalePrice`/`flashSaleEndsAt`/`flashSaleStock` + `effectivePrice()` + buyer countdown + 60s auto-expiration job.
- **Orders**: `completed` status (buyer confirm-receipt), shipping + region-tax computed at order/checkout.
- **Earnings**: Stripe Connect payout-account onboarding scaffold (`/payments/payout-account[/onboard]`, mock→Stripe swappable) + "Set up payouts" UI.
- **Search**: unified `/search` (sellers/products/streams) + filters.


---

## 0. Seller Roles & Status

- Roles (`config/constants.ROLES`): `buyer` (default) → `seller` (after approval) · plus `moderator`, `cohost`, `admin`.
- Seller status (`SELLER_STATUS`): `none → pending → approved | rejected | suspended | needs_more_information`.
- Stored on `User.sellerProfile` (embedded). Approval is performed by an **Admin** via the dashboard.

---

## 1. Seller Onboarding ✅ (🟡 payment/tax)

**Flow:** Sign Up → Verify Email (OTP) → Apply as Seller → Admin Approval → (Payment/Shipping setup) → Seller Hub.

| Step | State | Notes |
|---|---|---|
| Seller account | ✅ | Same `User`, role elevated on approval |
| Seller application | ✅ | `POST /users/seller-application` (category, subcategories, sellerType, businessAddress, averageEarningRange) → sets `sellerProfile.status = pending` |
| Seller approval | ✅ | Admin dashboard `sellers` page → approve/reject (`APPROVE_SELLERS` permission) |
| Seller verification | 🟡 | Application + admin review only; **no ID/KYC document upload or business/tax-doc verification** |
| Payment setup | 🟡 | Buyer-style saved cards exist (`/payments/methods`). **No Stripe Connect payout-account onboarding** (only `User.stripeProfile.stripeAccountId` field exists, unused) |
| Shipping setup | ✅ | `create_shipping_profile_screen` → `POST /shipping/profiles` (carrier, flat rate, free-ship threshold) |
| Seller dashboard | ✅ | `seller_hub_screen` (Flutter) |
| Tax information | ❌ | No tax-doc collection / VAT/tax-rate config |
| Status tracking | ✅ | `sellerProfile.status`, surfaced in app |

**App screens:** `seller_verification/*` (5-step), `seller/seller_hub_screen`, `seller/seller_tool_screen`.
**Gaps:** Stripe Connect onboarding + payout account; KYC/business-doc upload; tax info.

---

## 2. Schedule Live Show 🟡

**Flow:** Seller Hub → Schedule Show → fill fields → Create (scheduled) → Go Live.

| Feature | State | Notes |
|---|---|---|
| Create live show | ✅ | `POST /streams` (creates GetStream call, status `scheduled` or immediate) |
| Edit live show | ✅ | `PATCH /streams/:id` |
| Cancel live show | ✅ | `PATCH /streams/:id/cancel` |
| Delete live show | ❌ | No delete route (only cancel/soft state) |
| Draft live show | ❌ | `Stream.status` enum has no `draft` |
| Publish live show | 🟡 | Implicit (create = published/scheduled); no draft→publish transition |
| Fields: title, description, category, thumbnail, schedule date/time | ✅ | On `Stream` model (`scheduledAt`) |
| Visibility (public/private/followers) | ❌ | No `visibility` field |

**App screens:** `seller/schedule_live_show`, `seller/shows_screen`.
**Gaps:** draft status, delete, visibility field + filter.

---

## 3. Product / Inventory Management ✅ (🟡 flash sale)

**Flow:** Seller Hub → Inventory → Create Listing (multi-step) → product saved (draft/active) → pin to live show.

| Feature | State | Notes |
|---|---|---|
| Add / Edit / Delete product | ✅ | `POST /products`, `PUT /products/:id`, `DELETE /products/:id` |
| Multiple images | ✅ | `Product.images[]` (S3 presigned upload) |
| Condition, category, weight, quantity, SKU, description | ✅ | All on `Product` model |
| Inventory tracking | ✅ | `quantity` / `quantitySold`, `isAvailable` virtual, low-stock not alerted |
| Publish / deactivate | ✅ | `PATCH /products/:id/publish|deactivate` |
| Product types: Auction, Buy Now, Reserved-for-Live | ✅ | `listingType` = auction/buy_it_now; `reserveForLive` bool |
| Flash Sale type | 🟡 | `flashSale` + `maxDiscount` flags exist; **no discount price, countdown, or auto-expiration engine** |
| Reusable across shows | 🟡 | Products persist; single `streamId` link + `Stream.pinnedProducts[]`. No many-to-many show history |

**App screens:** `seller/create_quality_listing`, `seller/seller_inventory_screen`.
**Gaps:** flash-sale pricing/countdown/expiry; low-stock alerts.

---

## 4. Start Live Stream 🟡

**Flow:** Show → Go Live → GetStream WebRTC publish → viewers join room.

| Feature | State | Notes |
|---|---|---|
| Camera / mic / preview / go-live / end | ✅ | GetStream Video SDK (`livestream_screen`), `PATCH /streams/:id/start|end` |
| Switch camera / mute mic | 🟡 | SDK-capable; explicit UI controls partial |
| Viewer count | 🟡 | `Stream.totalViewers` stored; **no realtime viewer-count socket broadcast / presence** |
| Live timer / live status | ✅ | Derived from `startedAt`/status |
| Pause stream | ❌ | Not implemented |
| Moderation: remove message | ✅ | `delete-message` socket + `DELETE /chat/messages/:id` |
| Moderation: mute viewer | 🟡 | `mute-user` socket = **in-memory only**, lost on restart, no persistence |
| Moderation: ban viewer | ❌ | No persistent ban |
| Moderation: pin message | ❌ | Not implemented |

**Gaps:** realtime viewer count/presence, persistent ban, pin message, pause.

---

## 5. Live Auction 🟡

**Flow:** Live → Start Auction on a product → viewers bid (socket) → anti-snipe extends → auto-close → winner → pending Order → winner checkout.

| Feature | State | Notes |
|---|---|---|
| Select product, starting/reserve price, duration | ✅ | `POST /auctions/start` |
| Start auction | ✅ | Emits `auction-started`, schedules close timer |
| Bid increment (configurable) | 🟡 | Fixed `AUCTION.MIN_INCREMENT = 1`; not per-auction configurable |
| Bidding + anti-snipe + auto-bid proxy | ✅ | `place-bid` socket / `POST /auctions/:id/bids`; eBay-style proxy resolution |
| End auction / winner selection | ✅ | Auto-close (timer + 15s sweeper) or `POST /auctions/:id/close`; emits `auction-closed` with winner |
| Automatic payment | 🟡 | Winner gets a **pending** Order + prompt to checkout; not auto-charged |
| Pause / resume / cancel auction | ❌ | No pause/resume; no explicit cancel (only close) |
| Realtime: countdown, new bids, highest bidder, bid history | ✅ | `bid-updated` (currentHighBid, leadingBidder, bidCount); `GET /auctions/:id/bids` |
| Winner popup | ✅ | Snackbar → checkout (buyer side) |

**Gaps:** pause/resume/cancel, per-auction bid increment, auto-charge on win, host "start auction round" UI control.

---

## 6. Buy Now 🟡

| Feature | State | Notes |
|---|---|---|
| Pin product | 🟡 | `Stream.pinnedProducts[]` set at create; **no realtime `product-pinned` socket event** during live |
| Buy instantly | 🟡 | Order via `POST /orders` + `/payments` checkout; no one-tap in-stream buy flow |
| Quantity management / sold out | 🟡 | `quantity`/`quantitySold`; no realtime sold-out broadcast |
| Remove item | 🟡 | Via product deactivate; no live "remove pinned" event |

**Gaps:** realtime pin/unpin + sold-out events, in-stream one-tap purchase.

---

## 7. Flash Sale ❌

Only `flashSale`/`maxDiscount` boolean flags on Product. **Missing:** discount price, countdown, limited inventory enforcement, automatic expiration job, UI.

---

## 8. Giveaway ❌

Entirely missing: no `Giveaway` model, endpoints, socket events (`giveaway-started/joined/winner`), random-winner logic, restriction rules (everyone/followers/buyers), or UI.

---

## 9. Seller Orders ✅

**Flow:** Seller Hub → Orders / Fulfillment → generate label → mark shipped → mark delivered (releases escrow).

| Feature | State | Notes |
|---|---|---|
| Orders list + tabs (paid/pending/cancelled/refunded) | ✅ | `GET /orders/seller`, `seller_order_screen` wired |
| Print shipping label | ✅ | `POST /shipping/orders/:id/label` (mock carrier → tracking #) |
| Mark shipped / delivered | ✅ | `PATCH /orders/:id/status`; delivered → escrow release |
| Refund | ✅ | `POST /payments/orders/:id/refund` (seller) |
| Completed | 🟡 | `delivered` is terminal; no separate `completed` |

---

## 10. Seller Earnings ✅

**Flow:** Seller Hub → Payouts → view wallet → request payout.

| Feature | State | Notes |
|---|---|---|
| Revenue / fees | ✅ | 10% platform fee; `sellerNet` per payment |
| Pending / available balance | ✅ | `Wallet.pending` (escrow) / `available`; `seller_payout_screen` wired |
| Withdraw | ✅ | `POST /payments/payouts` (mock provider; Stripe-swappable) |
| Transaction history | ✅ | `GET /payments/wallet/ledger`, `GET /payments/payouts` |

**Gaps:** real Stripe Connect payout account (mock only).

---

## Seller Realtime Summary

Implemented: `join-stream/joined/left`, `bid-updated`, `auction-started`, `auction-closed`, `chat-message`, `message-deleted`, `reaction`, `user-muted`, `place-bid`, `send-message`, `send-reaction`, `delete-message`, `mute-user`.
Missing: viewer-count/presence, stream-started/ended broadcast to feed, auction-paused/resumed, product-pinned, buy-now-purchase, giveaway-*, notifications channel, seller-online/offline.
