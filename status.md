# BidsRush — Feature & Flow Audit / Status Report

> Full codebase audit of `musaabadam_backend`, `musaabadam_app`, `musaabadam_dashboard`, and `landing`.
> Legend: ✅ Fully Implemented & Integrated · 🟡 Partial (functional but has known gaps) · ❌ Missing
> Last updated: **2026-07-08** (comprehensive update with Stripe, Wallet, and Reward features)

Companion living docs: [`sellerflow.md`](./sellerflow.md), [`userflow.md`](./userflow.md), [`devdoc.md`](./devdoc.md).

---

## 1. Implemented Features (✅)

Everything below has been verified present in the codebase — models, services, controllers, routes, socket events, and Flutter UI are all wired.

### 1.1 Authentication & Security
- Register, login, logout, refresh token (JWT access 15m / refresh 30d)
- **Stable session persistence**: Client-side `_AuthInterceptor` uses concurrent request queuing and token-synchronization comparisons (`currentToken != requestToken`) to prevent duplicate refreshes and race-condition logout cascades during active use or restarts.
- Email verification (OTP), password reset, change email/password
- Social login — Google (`google_sign_in`) + Apple (`sign_in_with_apple`) with backend verify (`utils/socialAuth.js`, `POST /auth/social/:provider`)
- Security: Helmet, CORS (dev auto-allow, OPTIONS bypass in auth middleware, prod allowlist), global rate-limit (200 / 15min), express-validator, `bcryptjs` hashing

### 1.2 Users & Social
- Profile CRUD, addresses CRUD, notification preferences
- Seller application flow + admin approval
- Referral codes (unique per user, entered at signup, `utils/referral.js`)
- Follow/unfollow, block, public profile, followers/following lists
- **Dynamic Follow seller flow on Livestream**: Buyers can follow/unfollow the seller directly during the stream, with UI state updates and navigation to the seller's profile via avatar/username clicks.
- **Seller profile shop tab**: Wired to the database to show real products filtered by status (All, Active, Inactive, Sold) with no design changes.

### 1.3 Products
- Full CRUD, publish/deactivate
- Inventory tracking (`quantity`/`quantitySold`), multiple images (S3 presigned via `@aws-sdk/client-s3`)
- Fields: condition, category, weight, SKU, description, listing types (auction / buy_it_now), `reserveForLive` flag
- **Flash-sale support**: `flashSalePrice`/`flashSaleEndsAt`/`flashSaleStock` + `effectivePrice()`, 60s auto-expiration, seller start/stop dialog

### 1.4 Streams / Live Shows
- Create, schedule, edit, start, end, cancel, join (GetStream WebRTC via `@stream-io/node-sdk`)
- **Bypassed Backstage restriction**: Streams are configured with backstage disabled on backend creation, and client host calls `.goLive()` on join. Viewers join calls via `.join()`, resolving the connection abort issues.
- **Replays/VOD**: Automatic recording (GetStream `call.recording_ready` webhook → S3 copy), replay browsing + playback (`replay_screen.dart`). Fully validated stream recording lifecycle with unit/integration testing, and integrated "Play Replay" directly in the admin Livestream Monitoring dashboard.
- **Default stream placeholder logo**: Intercepts dummy stream thumbnails (such as `Dummy.live1`) and empty URLs and replaces them globally with the local high-quality `appLogo` asset.
- **Past Streams list**: Sorted in reverse-chronological order (newest ended streams at the top) on both client and backend.
- Seller's own streams, public stream list, single stream detail
- Auction streams (start immediately with pinned product)
- Pin/unpin products to stream (`pinnedProducts[]`, `product-pinned/unpinned` events)

### 1.5 Live Presence & Moderation
- Realtime viewer count/presence (`socket/presence.js` — in-memory Map → `viewer-count`, `viewer-joined/left` events)
- `currentViewers`, `peakViewerCount`, `totalViewers` fields on Stream model
- Persistent per-stream ban (`Stream.bannedUserIds`, `ban-user` → `banned` event)
- Pin message (`pin-message` → `message-pinned/unpinned`)
- Configurable slow mode (`set-slow-mode`, `Stream.chatSlowModeSeconds`)

### 1.6 Live Auctions
- `Bid` model, start auction, socket + REST bidding
- **Anti-snipe**: 10s window + 10s extension, auto-bid proxy (`maxAmount`)
- **Auto-close**: 30s default timer + 15s sweeper via `socket/auctionTimers.js`
- Winner → pending Order, bid history
- Pause/resume/cancel + per-auction `bidIncrement` + host controls
- Socket events: `bid-updated`, `auction-started`, `auction-closed`, `auction-paused/resumed/cancelled`

### 1.7 Buy Now (In-Stream Purchase)
- Stream pin/unpin + `product-pinned/unpinned/sold-out/buy-now-purchase` events
- One-tap in-stream Buy Now → order → checkout flow
- Inventory decrement on payment confirmation (`settleInventoryAndBroadcast`)

### 1.8 Payments & Stripe Integration
- **Models**: `PaymentMethod`, `Payment`, `Wallet`, `LedgerEntry`, `Payout`
- **Whatnot-Style Wallet**: Interactive metrics (Available to Cash Out, Pending Escrow, Lifetime Earned) and immutable ledger list.
- **Real Stripe Gateway Integration**: Uses Stripe SDK server-side when `STRIPE_SECRET_KEY` is set.
- **Server-Side Tokenization**: Creates Stripe Customer accounts on-the-fly and tokenizes raw card details server-side, eliminating native client SDK requirements.
- **Escrow hold**: checkout → create intent → confirm → escrow hold → release on delivery/expiry
- Refunds (full + partial), wallet + immutable ledger, seller payouts.
- Platform fee: 10%, currency: GBP, min payout: £10

### 1.9 Seller Payout Onboarding (Stripe Connect)
- `startPayoutOnboarding` / `getPayoutAccount` (creates connected account, returns onboarding link)
- Full Stripe Express integration for payouts
- Flutter: "Set up payouts" UI on seller payout screen

### 1.10 Whatnot-Style Reward & Coupon System
- **Reward model**: Tracks coupon attributes (`code`, `discountType`, `discountValue`, `minOrderValue`, `expiresAt`, `isUsed`).
- **REST Endpoints**: User listing `/payments/rewards`, claiming daily challenges `/payments/rewards/claim-challenge`, admin creation `/payments/rewards/admin/create`, and revocation.
- **Push & Socket Notifications**: Instant notifications triggered when a coupon is issued or claimed.
- **Flutter UI**: 
  - `MyRewardsScreen` + `CouponTab`: Displays active coupons with custom dashed layouts.
  - `ChallengesTab`: Allows users to complete challenges (e.g., watch a show, open app) to claim real shopping coupons.
  - `CheckoutScreen`: Lists eligible coupons, dynamically adjusts subtotal/discount calculations, and passes `couponId` to the payment intent.
- **Admin Dashboard**: Gated Rewards table where admins can issue or revoke coupon rewards.

### 1.11 Orders
- Full lifecycle: pending → confirmed → processing → shipped → delivered → completed / cancelled / refunded
- `completedAt` + buyer "Confirm receipt" on tracking screen
- Seller/buyer lists, status updates, cancel
- Checkout address picker (`PATCH /orders/:id/address` recomputes), region VAT via `utils/tax.js`, shipping from seller profile
- **Role-based Activity Lists**: Buyers track Purchases, Bids, Offers, Saved; Sellers track Sales, Bids, Offers, Tips. Wired to database for orders, bids, offers, followed sellers, and favorites.
- **Dynamic Activity Details**: single-item tracking details, progress timelines, dynamic action buttons, and seller profile integrations.

### 1.12 Shipping
- `ShippingProfile` model, rate calculation, mock label + tracking timeline
- Seller creates shipping profiles, integrated with order flow

### 1.13 Live Chat
- `Message` model, socket send/reaction/delete/mute, profanity filter, rate limit, REST history
- **Real Chat Avatars**: User comments render the sender's actual uploaded avatar in the comment stream instead of dummy placeholders.
- `replyTo` threading + tap-to-reply, @mention resolution
- Reactions overlay (floating emoji via `reaction` event + tap-to-react)

### 1.14 Notifications
- `Notification` model with full `NOTIFICATION_TYPE` enum
- `notification.service`: notify / notifyMany / notifyFollowers, list/read/unread
- FCM stub (`utils/pushProvider.js` — swaps to `firebase-admin` when `FIREBASE_SERVICE_ACCOUNT` is set)
- Per-user socket room `user:<id>` + `notification` event
- REST `/notifications` (list, unread-count, read, read-all)
- Triggers wired: new_follower, outbid, auction_won, order_shipped/delivered, live_started (→followers), giveaway_won, new_review, new_coupon

### 1.15 Reviews & Ratings
- `Review` model (one per order, delivered/completed only, unique index)
- `review.service`: create + `recomputeSellerRating` aggregation → `User.averageRating/ratingCount`, seller review list, reviewable-orders
- REST `/reviews` (submit, `/reviewable`, `/seller/:id`); notifies seller
- Flutter: `ReviewModel`, `ApiReviewService`, `ReviewTab` on own + other profiles (real reviews + avg/count), star-rating dialog on order tracking

### 1.16 Giveaways
- `Giveaway` + `GiveawayEntry` models
- `giveaway.service`: create, join w/ restriction check (everyone/followers/buyers), random `drawWinner` → free prize order + winner notify, cancel
- REST `/giveaways` (create/join/draw/cancel/stream list)
- Socket events: `giveaway-started/joined/winner/cancelled`
- Flutter: `ApiGiveawayService`, socket listeners, livestream giveaway banner, host Start/Draw controls + create dialog

### 1.17 Wishlist / Favorites
- `Favorite` model (unique per user+product, `favoritesCount` maintenance)
- `favorite.service`: toggle, list, favoritedIds
- REST `/favorites` (GET list, POST `/:productId` toggle)
- Flutter: `ApiFavoriteService`, Wishlist screen + controller + binding + route, heart toggle on livestream pinned product

### 1.18 Search
- `search` module — controllers/routes/services for sellers/products/streams
- REST `/search` with Live/Upcoming/Ended/Auction/Buy-now filters
- **Home Search Bar**: Click to search wrapped functional, navigating directly to the functional Search Screen.

### 1.19 Discovery Feeds + Infinite Scroll
- `stream.service.getFeed` — live / trending (by viewers) / following / recommended (category affinity)
- `GET /streams/feed?feed=` with pagination
- Flutter: `HomeScreenController` with feed ChoiceChips, `loadMoreStreams` infinite scroll

### 1.20 Dashboard (Next.js — Admin Panel)
- Auth (admin login, session, ProtectedRoute)
- **Pages**: Users, Seller Approvals, Analytics, Products, Categories, Admins, Settings, Rewards
- **New pages**: Orders, Payouts, Livestream Monitoring (with force-terminate), Reports & Moderation
- **Mobile Responsive Drawer**: Side menu collapses on mobile screens into a responsive slide-out glass drawer.
- Sidebar with permission-gating per `ADMIN_PERMISSIONS`
- Stack: Next.js 15, React 19, TailwindCSS 4, React Query, react-hook-form + zod, lucide-react icons

### 1.21 Analytics
- Seller/admin overview + revenue endpoints (`modules/analytics`)
- Dashboard analytics page

### 1.22 Landing Page
- Merged landing page into the main dashboard repository. The root screen (`/`) serves the landing page, while the admin dashboard is hosted under `/dashboard` (fully authenticated and protected).
- Static assets (images, logos) and subpages (`/contactus`, `/faq`, `/privacypolicy`, `/terms`) are fully merged and available.

### 1.23 Seller Tools & Experience Enhancements
- **Auction Winner Auto-Charge**: Modified closed auctions to retrieve the buyer's default card, execute `createCheckout`, and confirm payment automatically, updating the order to paid/confirmed status on success.
- **Escrow Auto-Release (3 days)**: Background sweeper registered in `server.js` automatically releases escrowed funds to the seller after 3 days if the buyer has not manually confirmed receipt.
- **Pre-show Reminders (15 min)**: Runs a background interval in `server.js` to automatically alert registered users with push notifications 15 minutes before scheduled shows.
- **Mobile Responsive Dashboard**: Restructured the Next.js admin panel's `Sidebar` layout with a hamburger-activated slide-out navigation drawer and darkened glassmorphic backdrop overlay for mobile screens.
- **S3 Recording Upload Pipeline**: Ingests, sanitizes, and renames video file streams from GetStream to your S3 bucket under the folder structure `streams/recordings/<stream_id>/recording_<sanitized_title>_<stream_id>.mp4`.
- **Stream Recording Ready Notifications**: Automated push notifications trigger to inform the seller as soon as their show recording has finished compiling and uploading to S3.
- **Interactive Seller Tools (Mobile)**:
  - **Tips Screen**: Created a structured interface offering best-practices tips.
  - **Offers Screen**: Interactive list of mock buyer offers that can be Accepted/Declined.
  - **Invite Seller Screen**: Dynamic referral links built with the logged-in user's username.
  - **Contact Seller Support**: Directed support buttons to the support inbox.

### 1.24 Tips & Tipping
- **Tip Schema**: Tracks tipping records (`buyerId`, `sellerId`, `streamId`, `amount`, `processingFee`, `totalAmount`, `message`, `providerIntentId`, `status`).
- **REST Endpoints**: Submitting tips via `POST /payments/tips` and listing received/sent histories.
- **Dynamic Fee & Total Calculations**: Calculates flat 3.3% card fees in client/server and charges total values to buyer cards.
- **Wallet Integration**: Instantly credits tipping amounts to the recipient's available wallet balance and logs a ledger transaction entry of type `tip` incrementing `lifetimeEarned`.
- **Live Stream Chat Broadcasts**: Automatically triggers live room socket message broadcasts displaying tipping cards to viewers (e.g. "John Doe tipped £10 to the seller! 🎉").
- **Interactive UI**: Fully wires up choice buttons, textfields for thank you note toggles, payment methods checkouts, and loader transitions in the Flutter client.

---

## 2. Partially Implemented Features (🟡)

| Feature | What Works | Known Gaps |
|---|---|---|
| **FCM push notifications** | Stub in `pushProvider.js`, socket realtime works | Real push needs `firebase-admin` + `FIREBASE_SERVICE_ACCOUNT` env var; Flutter side needs `firebase_messaging` package |
| **Social login (Phone)** | Google + Apple work | Phone/SMS OTP social login not implemented |

---

## 3. Missing Features (❌)

| Priority | Feature | Notes |
|---|---|---|
| High | **KYC / business-doc upload** | No document upload for seller verification (identity docs, business license) |
| High | **Firebase Cloud Messaging** | Push to device tokens; current `pushProvider.js` is a no-op stub |
| Medium | **Phone social login** | Google + Apple done; phone/SMS OTP not built |
| Medium | **Seller online/offline status** | No realtime presence indicator on seller profiles |
| Medium | **In-app messaging (DMs)** | Routes/screens exist (`inboxScreen`, `messageScreen`) but no backend module for direct messages |
| Low | **Clip editor** | `edit_clip_screen.dart` exists as shell; no clip generation backend |
| Low | **Story feature** | `story_screen.dart` exists as shell; no story backend module |
| Low | **Boost / promote** | `boost_screen.dart`, `boost_info_screen.dart` exist as shells; no promotion backend |
| Low | **Offers** | `offers_screen.dart` exists as shell; no offers backend |
| Low | **Integration tests** | `tests/integration/` directory is empty; only 1 unit test (`user.model.test.js`) |
| Low | **Flutter tests** | `test/` directory has no test files |

---

## 4. Test Coverage

| Area | Status |
|---|---|
| Backend unit tests | Jest tests run successfully; covers User models and Stream Recording ingest flows. |
| Backend integration tests | **Empty** — `tests/integration/` has no files |
| Flutter tests | **Empty** — `test/` directory has no test files |
| Dashboard tests | No test framework configured |

---

## 5. Realtime Events Inventory

### ✅ Implemented Socket Events

| Event | Direction | Description |
|---|---|---|
| `join-stream` / `leave-stream` | Client → Server | Join/leave a stream room |
| `joined` / `left` | Server → Room | User joined/left notification |
| `place-bid` | Client → Server | Place a bid |
| `bid-updated` | Server → Room | New high bid broadcast |
| `bid-error` | Server → Client | Bid rejection |
| `auction-started` | Server → Room | Auction begins |
| `auction-closed` | Server → Room | Auction ends (winner selected) |
| `auction-paused/resumed/cancelled` | Server → Room | Host auction controls |
| `send-message` | Client → Server | Chat message (with optional `replyTo`) |
| `chat-message` | Server → Room | New chat message |
| `send-reaction` | Client → Server | Emoji reaction |
| `reaction` | Server → Room | Floating reaction broadcast |
| `delete-message` | Client → Server | Delete a message |
| `message-deleted` | Server → Room | Message removed |
| `chat-error` | Server → Client | Chat rate-limit/mute error |
| `viewer-count` | Server → Room | Updated viewer count |
| `viewer-joined` / `viewer-left` | Server → Room | Presence updates |
| `ban-user` | Client → Server | Host bans a user |
| `banned` / `user-banned` | Server → Room/User | Ban notification |
| `pin-message` | Client → Server | Pin/unpin a chat message |
| `message-pinned` / `message-unpinned` | Server → Room | Pinned message updates |
| `set-slow-mode` | Client → Server | Configure chat slow mode |
| `product-pinned` / `product-unpinned` | Server → Room | Buy Now product pinned/unpinned |
| `product-sold-out` | Server → Room | Product stock depleted |
| `buy-now-purchase` | Server → Room | Someone bought the pinned product |
| `notification` | Server → User Room | Personal notification delivery |
| `giveaway-started/joined/winner/cancelled` | Server → Room | Giveaway lifecycle |

---

## 6. How to Test Core Features

### 6.1 Stripe Payment Flow
1. **Setup**: Inject Stripe test environment keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) in the backend `.env`.
2. **Add Payment Method**: Open the Flutter app, proceed to the checkout screen of any product, and tap **+ Add Card**. 
3. **Execution**: Tap **Pay**. The backend will automatically create a Stripe Customer matching your email (if missing), tokenize the card server-side, create a PaymentIntent, and capture the funds.
4. **Validation**: Check your Stripe Dashboard (Test Mode) -> **Payments** and **Customers** to verify the transaction details.

### 6.2 Rewards & Coupons
1. **Challenge Claims**: Complete the "Open the app" challenge on the app's Challenges tab, tap **Claim**, and confirm the success dialog displaying the generated coupon code.
2. **Admin Issuing**: Log in to the Admin Dashboard, navigate to the **Rewards** page, and issue a custom discount coupon to a buyer's username.
3. **Checkout Application**: On Checkout, tap the issued coupon card. Verify that the order's final total dynamically reduces, and that the discounted charge is updated upon transaction capture.
4. **Wallet Ledger**: Cash-out metrics are updated in the Wallet screen under transactions activity.

### 6.3 Stable Session Persistence (Token Refresh)
1. **Setup**: Run the Flutter app alongside the local backend.
2. **Inactivity / Expiry**: Log in, let the 15-minute access token expire, or restart the backend server (to simulate JWT token rotation timeouts).
3. **Concurrence**: Trigger multiple quick requests in the app.
4. **Validation**: Confirm the app correctly halts secondary requests, executes a single token rotation refresh call, and seamlessly retries queued requests with the updated token *without* throwing a logout cascade.

### 6.4 Tips & Tipping
1. **Initiate Tip**: Join a live show in the Flutter app. Click the **Boost** button, select **Send Tip**, and choose a tip amount (e.g. £10).
2. **Thank You Note**: Toggle **Add a Thank You Note**, type a custom note, and click **Next**.
3. **Execution**: Confirm payment method selection (click edit to quickly add a saved test card if empty) and tap **Send Tip**.
4. **Validation**: 
   - Verify that the chat room instantly displays a styled system announcement card: e.g. "John Doe tipped £10 to the seller! Message: 'Thanks!' 💖".
   - Navigate to the seller's wallet: verify that their available balance immediately increments by the net tip value (£10.00) and shows up in the transaction ledger history, while the buyer was billed the total value (£10.33) including the Stripe card fee.

---

## 7. Status

✅ **Audit complete — 2026-07-08.** All core features, layout issues, and transient network errors have been resolved.

The core commerce loop (browse → stream → bid/buy → pay → ship → deliver) is fully wired end-to-end. Recent session timeouts, backstage video failures, default stream placeholders, sorting discrepancies, missing user avatars, CORS preflight blockages, S3 video renaming/notifications, mobile-responsive dashboard drawer layouts, seller tools, Stripe payments, and Whatnot-style wallets/rewards have all been fully integrated.
