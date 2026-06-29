const svc = require('../services/upload.service');

const getUploadUrl = async (req, res, next) => {
  try {
    const { folder, contentType, fileSize } = req.body;
    const result = await svc.generatePresignedUploadUrl({
      folder,
      contentType,
      fileSize: Number(fileSize),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUploadUrl };
