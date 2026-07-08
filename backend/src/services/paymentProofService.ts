import { supabase, isSupabaseConfigured, PAYMENT_PROOFS_BUCKET } from '../config/supabase';
import { IPaymentDocument } from '../models/Payment';

/**
 * Uploads a proof-of-payment image to the private Supabase bucket and
 * sets the resulting storage path/metadata on the given payment document.
 * The caller is responsible for calling payment.save() afterwards.
 */
export async function attachProofOfPayment(
  payment: IPaymentDocument,
  file: Express.Multer.File,
  uploadedByUserId: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Payment proof storage is not configured');
  }

  const timestamp = Date.now();
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `payment-proofs/${payment._id}/${timestamp}-${sanitizedName}`;

  const { error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Proof of payment upload failed: ${error.message}`);
  }

  payment.proofOfPaymentPath = storagePath;
  payment.proofOfPaymentUploadedAt = new Date();
  payment.proofOfPaymentUploadedBy = uploadedByUserId;
}
