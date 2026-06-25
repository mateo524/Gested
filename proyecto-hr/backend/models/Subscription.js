import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  companyId:         { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  plan:              { type: String, enum: ["base", "pro"], required: true },
  status:            { type: String, enum: ["pending", "authorized", "paused", "cancelled", "expired"], default: "pending" },

  employeeCount:     { type: Number },

  // MercadoPago identifiers
  mpPreapprovalId:   { type: String, index: true },    // preapproval subscription ID
  mpPayerId:         { type: String },                  // MP payer ID
  mpPayerEmail:      { type: String },

  // Billing cycle
  billingCycleStart: { type: Date },
  billingCycleEnd:   { type: Date },
  nextPaymentDate:   { type: Date },
  lastPaymentDate:   { type: Date },
  lastPaymentAmount: { type: Number },

  // Pending employee upgrade (one-time payment in progress)
  pendingUpgrade: {
    add:          { type: Number },
    newCount:     { type: Number },
    preferenceId: { type: String },
  },

  // Metadata
  cancelledAt:       { type: Date },
  cancelReason:      { type: String },
}, { timestamps: true });

export default mongoose.model("Subscription", subscriptionSchema);
