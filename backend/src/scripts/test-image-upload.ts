import dotenv from 'dotenv';
dotenv.config();

import { supabase, GALLERY_BUCKET } from '../config/supabase';
import sharp from 'sharp';

async function testImageUpload() {
  console.log('🧪 Testing Image Upload with Sharp...\n');

  try {
    // Create a simple test image using Sharp
    console.log('📸 Creating test image with Sharp...');
    const testImageBuffer = await sharp({
      create: {
        width: 500,
        height: 300,
        channels: 3,
        background: { r: 255, g: 100, b: 50 }
      }
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    console.log('✅ Test image created:', testImageBuffer.length, 'bytes\n');

    // Generate paths
    const timestamp = Date.now();
    const storagePath = `gallery/test-${timestamp}.jpg`;
    const thumbnailPath = `gallery/thumbnails/test-thumb-${timestamp}.jpg`;

    console.log('📂 Upload paths:');
    console.log('   Main:', storagePath);
    console.log('   Thumbnail:', thumbnailPath);
    console.log();

    // Create thumbnail
    console.log('🖼️  Creating thumbnail...');
    const thumbnailBuffer = await sharp(testImageBuffer)
      .resize(400, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    console.log('✅ Thumbnail created:', thumbnailBuffer.length, 'bytes\n');

    // Upload main image
    console.log('📤 Uploading main image...');
    const uploadResult = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(storagePath, testImageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadResult.error) {
      console.error('❌ Main image upload error:', uploadResult.error);
      console.error('   Error details:', JSON.stringify(uploadResult.error, null, 2));
      return;
    }

    console.log('✅ Main image uploaded!');
    console.log('   Path:', uploadResult.data?.path);

    // Upload thumbnail
    console.log('\n📤 Uploading thumbnail...');
    const thumbnailResult = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (thumbnailResult.error) {
      console.error('❌ Thumbnail upload error:', thumbnailResult.error);
      console.error('   Error details:', JSON.stringify(thumbnailResult.error, null, 2));
      return;
    }

    console.log('✅ Thumbnail uploaded!');
    console.log('   Path:', thumbnailResult.data?.path);

    // Get public URLs
    console.log('\n🔗 Public URLs:');
    const mainUrl = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(storagePath);
    const thumbUrl = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(thumbnailPath);

    console.log('   Main:', mainUrl.data.publicUrl);
    console.log('   Thumbnail:', thumbUrl.data.publicUrl);

    // Cleanup
    console.log('\n🗑️  Cleaning up...');
    await supabase.storage.from(GALLERY_BUCKET).remove([storagePath, thumbnailPath]);
    console.log('✅ Cleanup complete!\n');

    console.log('🎉 Image upload test passed!\n');

  } catch (error: any) {
    console.error('❌ Exception:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testImageUpload();
