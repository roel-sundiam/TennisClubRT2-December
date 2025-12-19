import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in environment variables');
}

// Create Supabase client with service role key for admin operations
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Bucket name for gallery images
export const GALLERY_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'tennis-club-gallery';

/**
 * Helper function to get public URL for an image stored in Supabase Storage
 * @param path - The storage path of the image
 * @returns The public URL
 */
export const getPublicUrl = (path: string): string => {
  const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Helper function to delete an image from Supabase Storage
 * @param path - The storage path of the image
 * @returns Promise with success/error
 */
export const deleteFromStorage = async (path: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);

    if (error) {
      console.error('Error deleting from Supabase Storage:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Exception deleting from Supabase Storage:', error);
    return { success: false, error: error.message };
  }
};
