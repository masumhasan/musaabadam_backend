require('dotenv').config();
const mongoose = require('mongoose');
const Stream = require('../../src/models/Stream');
const streamService = require('../../src/modules/streams/services/stream.service');
const streamClient = require('../../src/utils/streamClient');
const uploadService = require('../../src/modules/uploads/services/upload.service');

jest.mock('../../src/utils/streamClient', () => ({
  getStreamClient: jest.fn(() => ({
    video: {
      call: jest.fn(() => ({
        getOrCreate: jest.fn().mockResolvedValue({}),
        end: jest.fn().mockResolvedValue({}),
      })),
    },
  })),
  upsertStreamUser: jest.fn().mockResolvedValue({}),
  startCallRecording: jest.fn().mockResolvedValue(true),
  stopCallRecording: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/modules/uploads/services/upload.service', () => ({
  uploadRemoteFileToS3: jest.fn().mockResolvedValue({
    key: 'streams/recordings/test-stream-id/test.mp4',
    publicUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/streams/recordings/test-stream-id/test.mp4',
  }),
  deleteFile: jest.fn().mockResolvedValue({}),
}));

jest.setTimeout(30000);

describe('Stream Recording Lifecycle', () => {
  let sellerId;
  let categoryId;
  let testStream;

  beforeAll(async () => {
    // Connect to in-memory/test mongodb
    const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bidsrush-test';
    await mongoose.connect(url);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Stream.deleteMany({});
    sellerId = new mongoose.Types.ObjectId();
    categoryId = new mongoose.Types.ObjectId();

    // Create a mock stream in DB
    testStream = await Stream.create({
      sellerId,
      title: 'Test Live Stream',
      description: 'Testing stream recording',
      categoryId,
      callId: 'call_test_123',
      callType: 'livestream',
      status: 'scheduled',
    });
  });

  test('should start recording automatically when a stream goes live', async () => {
    const startedStream = await streamService.startStream(sellerId, testStream._id);

    expect(startedStream.status).toBe('live');
    expect(startedStream.recordingStatus).toBe('processing');
    expect(streamClient.startCallRecording).toHaveBeenCalledWith('livestream', 'call_test_123');
  });

  test('should stop recording and end the call when a stream ends', async () => {
    // Setup stream as live and recording processing
    testStream.status = 'live';
    testStream.recordingStatus = 'processing';
    await testStream.save();

    const endedStream = await streamService.endStream(sellerId, testStream._id);

    expect(endedStream.status).toBe('ended');
    expect(streamClient.stopCallRecording).toHaveBeenCalledWith('livestream', 'call_test_123');
  });

  test('should ingest recording from webhook, upload to S3, and mark as ready', async () => {
    // Setup stream as ended and recording processing
    testStream.status = 'ended';
    testStream.recordingStatus = 'processing';
    await testStream.save();

    const mockRecordingPayload = {
      url: 'https://getstream-recordings.com/file.mp4',
      start_time: '2026-07-07T12:00:00Z',
      end_time: '2026-07-07T12:05:00Z',
    };

    const ingestedStream = await streamService.ingestRecording('call_test_123', mockRecordingPayload);

    expect(ingestedStream.recordingStatus).toBe('ready');
    expect(ingestedStream.isRecorded).toBe(true);
    expect(ingestedStream.recordingUrl).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/streams/recordings/test-stream-id/test.mp4');
    expect(ingestedStream.recordingDurationSeconds).toBe(300); // 5 minutes duration
    expect(uploadService.uploadRemoteFileToS3).toHaveBeenCalled();
  });
});
