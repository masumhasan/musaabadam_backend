const express = require('express');
const { authenticateAdmin, requireAdminPermission } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const authCtrl = require('../controllers/admin.auth.controller');
const userCtrl = require('../controllers/admin.user.controller');
const sellerCtrl = require('../controllers/admin.seller.controller');
const adminCtrl = require('../controllers/admin.admin.controller');
const categoryCtrl = require('../controllers/admin.category.controller');
const productCtrl = require('../controllers/admin.product.controller');
const settingsCtrl = require('../../settings/controllers/settings.controller');
const { updateLegalContentValidator } = require('../../settings/validators/settings.validators');
const {
  loginValidator,
  adminForgotPasswordValidator,
  adminVerifyResetOtpValidator,
  adminResetPasswordValidator,
  userIdParam,
  adminIdParam,
  suspendValidator,
  banValidator,
  rejectSellerValidator,
  requestInfoValidator,
  listUsersValidator,
  listSellersValidator,
  createAdminValidator,
  categoryIdParam,
  createCategoryValidator,
  updateCategoryValidator,
  listCategoriesValidator,
  productIdParam,
  listProductsAdminValidator,
} = require('../validators/admin.validators');

const router = express.Router();

// ── Auth (public within admin prefix) ────────────────────────────────────────
router.post('/auth/login', loginValidator, validate, authCtrl.login);
router.post('/auth/forgot-password', adminForgotPasswordValidator, validate, authCtrl.forgotPassword);
router.post('/auth/verify-reset-otp', adminVerifyResetOtpValidator, validate, authCtrl.verifyResetOtp);
router.post('/auth/reset-password', adminResetPasswordValidator, validate, authCtrl.resetPassword);
router.get('/auth/me', authenticateAdmin, authCtrl.me);

// ── All routes below require admin token ─────────────────────────────────────
router.use(authenticateAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────
const canViewUsers = requireAdminPermission('VIEW_USERS');
const canSuspendUsers = requireAdminPermission('SUSPEND_USERS');

router.get('/users', canViewUsers, listUsersValidator, validate, userCtrl.list);
router.get('/users/:userId', canViewUsers, userIdParam, validate, userCtrl.getOne);
router.patch('/users/:userId/suspend', canSuspendUsers, suspendValidator, validate, userCtrl.suspend);
router.patch('/users/:userId/ban', canSuspendUsers, banValidator, validate, userCtrl.ban);
router.patch('/users/:userId/activate', canSuspendUsers, userIdParam, validate, userCtrl.activate);
router.delete('/users/:userId', canSuspendUsers, userIdParam, validate, userCtrl.deleteUser);

// ── Sellers ───────────────────────────────────────────────────────────────────
const canApproveSellers = requireAdminPermission('APPROVE_SELLERS');

router.get('/sellers', canApproveSellers, listSellersValidator, validate, sellerCtrl.list);
router.patch('/sellers/:userId/approve', canApproveSellers, userIdParam, validate, sellerCtrl.approve);
router.patch('/sellers/:userId/reject', canApproveSellers, rejectSellerValidator, validate, sellerCtrl.reject);
router.patch('/sellers/:userId/request-info', canApproveSellers, requestInfoValidator, validate, sellerCtrl.requestInfo);

// ── Admin management (super_admin only via MANAGE_ADMINS permission) ──────────
const canManageAdmins = requireAdminPermission('MANAGE_ADMINS');

router.get('/admins', canManageAdmins, validate, adminCtrl.list);
router.post('/admins', canManageAdmins, createAdminValidator, validate, adminCtrl.create);
router.patch('/admins/:adminId/:action', canManageAdmins, adminIdParam, validate, adminCtrl.toggleActive);

// ── Categories ─────────────────────────────────────────────────────────────────
const canManageCategories = requireAdminPermission('MANAGE_CATEGORIES');

router.get('/categories', canManageCategories, listCategoriesValidator, validate, categoryCtrl.list);
router.post('/categories', canManageCategories, createCategoryValidator, validate, categoryCtrl.create);
router.patch('/categories/:categoryId', canManageCategories, ...updateCategoryValidator, validate, categoryCtrl.update);
router.delete('/categories/:categoryId', canManageCategories, ...categoryIdParam, validate, categoryCtrl.remove);

// ── Products (read + moderation — any authenticated admin) ────────────────────
router.get('/products', listProductsAdminValidator, validate, productCtrl.list);
router.patch('/products/:productId/deactivate', ...productIdParam, validate, productCtrl.deactivate);
router.patch('/products/:productId/activate', ...productIdParam, validate, productCtrl.activate);

// ── Monitoring: orders, payouts, livestreams ─────────────────────────────────
const monitoringCtrl = require('../controllers/admin.monitoring.controller');
const canViewAnalytics = requireAdminPermission('VIEW_ANALYTICS');
const canApprovePayouts = requireAdminPermission('APPROVE_PAYOUTS');
const canTerminateStreams = requireAdminPermission('TERMINATE_STREAMS');

router.get('/orders', canViewAnalytics, monitoringCtrl.listOrders);
router.get('/payouts', canApprovePayouts, monitoringCtrl.listPayouts);
router.get('/streams', canTerminateStreams, monitoringCtrl.listStreams);
router.patch('/streams/:streamId/terminate', canTerminateStreams, monitoringCtrl.terminateStream);

// ── Settings — legal content (any authenticated admin) ────────────────────────
router.put('/settings/privacy-policy', updateLegalContentValidator, validate, settingsCtrl.updatePrivacyPolicy);
router.put('/settings/terms', updateLegalContentValidator, validate, settingsCtrl.updateTerms);

module.exports = router;
