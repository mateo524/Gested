import mongoose from 'mongoose';

const twoFactorAuthSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    secret: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    backupCodes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const TwoFactorAuth = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);

export default TwoFactorAuth;
