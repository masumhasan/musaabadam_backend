const crypto = require('crypto');
const logger = require('./logger');

// ─── Payment provider abstraction ─────────────────────────────────────────────
// The rest of the app talks to this interface only. A real Stripe implementation
// can be dropped in behind the same methods without touching the service layer.
//
// When STRIPE_SECRET_KEY is set AND the `stripe` package is installed, the Stripe
// implementation is used. Otherwise a deterministic in-memory mock is used so the
// payments flow works end-to-end in development (mirrors how S3 is stubbed).

const rid = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

// ── Mock provider ────────────────────────────────────────────────────────────
const mockProvider = {
  name: 'mock',

  async attachPaymentMethod({ card }) {
    // Accepts raw test card metadata, returns a tokenized reference.
    const last4 = (card?.number || '4242424242424242').slice(-4);
    return {
      id: rid('pm'),
      brand: card?.brand || 'visa',
      last4,
      expMonth: card?.expMonth || 12,
      expYear: card?.expYear || 2030,
    };
  },

  async createPaymentIntent({ amount, currency, metadata }) {
    return {
      id: rid('pi'),
      clientSecret: rid('secret'),
      status: 'requires_confirmation',
      amount,
      currency,
      metadata: metadata || {},
    };
  },

  async confirmPaymentIntent({ intentId }) {
    // Mock always succeeds (test cards). A real provider returns the live status.
    return { id: intentId, status: 'succeeded' };
  },

  async refund({ intentId, amount }) {
    return { id: rid('re'), intentId, amount, status: 'succeeded' };
  },

  async createPayout({ amount, currency, destination }) {
    return { id: rid('po'), amount, currency, destination, status: 'paid' };
  },

  // Connect (seller payout account) — mock auto-completes onboarding.
  async createConnectAccount() {
    return { id: rid('acct') };
  },
  async createAccountLink({ accountId }) {
    return { url: `https://connect.mock/onboard/${accountId}`, accountId };
  },
  async getAccountStatus() {
    return { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true };
  },
};

// ── Stripe provider (lazy — only loaded when configured) ─────────────────────
let _provider = mockProvider;

if (process.env.STRIPE_SECRET_KEY) {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    _provider = {
      name: 'stripe',

      async attachPaymentMethod({ card, providerPaymentMethodId, customerId }) {
        let pmId = providerPaymentMethodId;
        if (card && card.number) {
          let token = 'tok_visa';
          const cleanNum = card.number.replace(/\s+/g, '');
          if (cleanNum.startsWith('5')) {
            token = 'tok_mastercard';
          } else if (cleanNum.startsWith('3')) {
            token = 'tok_amex';
          } else if (cleanNum.startsWith('6')) {
            token = 'tok_discover';
          }

          const createdPm = await stripe.paymentMethods.create({
            type: 'card',
            card: {
              token: token,
            },
          });
          pmId = createdPm.id;
        }

        const pm = await stripe.paymentMethods.attach(pmId, { customer: customerId });
        return {
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
        };
      },

      async createPaymentIntent({ amount, currency, metadata, customerId, paymentMethodId }) {
        const intent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency,
          customer: customerId,
          payment_method: paymentMethodId,
          metadata,
          capture_method: 'automatic',
        });
        return { id: intent.id, clientSecret: intent.client_secret, status: intent.status, amount, currency };
      },

      async confirmPaymentIntent({ intentId, paymentMethodId }) {
        const intent = await stripe.paymentIntents.confirm(intentId, { payment_method: paymentMethodId });
        return { id: intent.id, status: intent.status };
      },

      async refund({ intentId, amount }) {
        const refund = await stripe.refunds.create({
          payment_intent: intentId,
          amount: amount != null ? Math.round(amount * 100) : undefined,
        });
        return { id: refund.id, intentId, amount, status: refund.status };
      },

      async createPayout({ amount, currency, destination }) {
        const payout = await stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency,
          destination,
        });
        return { id: payout.id, amount, currency, destination, status: 'pending' };
      },

      async createConnectAccount({ email } = {}) {
        const account = await stripe.accounts.create({ type: 'express', email });
        return { id: account.id };
      },
      async createAccountLink({ accountId }) {
        const link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${process.env.APP_URL || ''}/payouts/refresh`,
          return_url: `${process.env.APP_URL || ''}/payouts/return`,
          type: 'account_onboarding',
        });
        return { url: link.url, accountId };
      },
      async getAccountStatus({ accountId }) {
        const acct = await stripe.accounts.retrieve(accountId);
        return {
          chargesEnabled: acct.charges_enabled,
          payoutsEnabled: acct.payouts_enabled,
          detailsSubmitted: acct.details_submitted,
        };
      },
    };
    logger.info('Payment provider: Stripe');
  } catch (err) {
    logger.warn(`Stripe configured but unavailable (${err.message}); falling back to mock provider`);
  }
} else {
  logger.info('Payment provider: mock (no STRIPE_SECRET_KEY set)');
}

module.exports = _provider;
