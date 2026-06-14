const { ROLES, PERMISSIONS, SELLER_STATUS } = require('../../src/config/constants');

// Isolated tests — no DB connection needed for logic validation

describe('User model constants and permissions', () => {
  test('ROLES contains all five marketplace roles', () => {
    expect(Object.values(ROLES)).toEqual(
      expect.arrayContaining(['buyer', 'seller', 'moderator', 'cohost', 'admin'])
    );
  });

  test('BUYER permissions include bid and buy', () => {
    expect(PERMISSIONS.BUYER).toContain('bid');
    expect(PERMISSIONS.BUYER).toContain('buy');
  });

  test('SELLER permissions include create_stream and run_auction', () => {
    expect(PERMISSIONS.SELLER).toContain('create_stream');
    expect(PERMISSIONS.SELLER).toContain('run_auction');
  });

  test('ADMIN permissions are wildcard', () => {
    expect(PERMISSIONS.ADMIN).toContain('*');
  });

  test('SELLER_STATUS has expected values', () => {
    expect(Object.values(SELLER_STATUS)).toEqual(
      expect.arrayContaining(['none', 'pending', 'approved', 'rejected', 'suspended', 'needs_more_information'])
    );
  });
});

describe('apiResponse utility', () => {
  const { success, error, notFound, unauthorized, badRequest, conflict } = require('../../src/utils/apiResponse');

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('success returns 200 with success:true', () => {
    const res = mockRes();
    success(res, { id: 1 }, 'Done');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Done' }));
  });

  test('error returns given statusCode with success:false', () => {
    const res = mockRes();
    error(res, 'Oops', 500);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('notFound returns 404', () => {
    const res = mockRes();
    notFound(res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('unauthorized returns 401', () => {
    const res = mockRes();
    unauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('badRequest returns 400', () => {
    const res = mockRes();
    badRequest(res, 'Invalid input');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('conflict returns 409', () => {
    const res = mockRes();
    conflict(res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
