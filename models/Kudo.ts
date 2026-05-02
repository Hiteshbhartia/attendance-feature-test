import mongoose, { Schema, Document } from 'mongoose';

export interface IKudo extends Document {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  tag: string;
  message: string;
  createdAt: Date;
}

const KudoSchema: Schema = new Schema({
  fromId: { type: String, required: true },
  fromName: { type: String, required: true },
  toId: { type: String, required: true },
  toName: { type: String, required: true },
  tag: { type: String, required: true },
  message: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

// Index for anti-spam (fromId + createdAt) and for leaderboard (toId + createdAt)
KudoSchema.index({ fromId: 1, createdAt: -1 });
KudoSchema.index({ toId: 1, createdAt: -1 });

export default mongoose.models.Kudo || mongoose.model<IKudo>('Kudo', KudoSchema);
