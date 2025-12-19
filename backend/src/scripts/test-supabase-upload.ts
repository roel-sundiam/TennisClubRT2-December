import dotenv from 'dotenv';
dotenv.config();

import { supabase, GALLERY_BUCKET } from '../config/supabase';

async function testSupabaseUpload() {
  console.log('🧪 Testing Supabase Upload...\n');

  console.log('📋 Configuration:');
  console.log('  URL:', process.env.SUPABASE_URL);
  console.log('  Bucket:', GALLERY_BUCKET);
  console.log('  Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...\n');

  try {
    // Test 1: List buckets
    console.log('📂 Test 1: List buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }

    console.log('✅ Available buckets:', buckets?.map(b => b.name).join(', '));

    const bucketExists = buckets?.some(b => b.name === GALLERY_BUCKET);
    if (!bucketExists) {
      console.error(`❌ Bucket "${GALLERY_BUCKET}" does not exist!`);
      console.log('   Available buckets:', buckets?.map(b => b.name).join(', '));
      return;
    }
    console.log(`✅ Bucket "${GALLERY_BUCKET}" exists\n`);

    // Test 2: Upload a test file
    console.log('📤 Test 2: Upload test file...');
    const testContent = Buffer.from('This is a test image upload');
    const testPath = `test/test-upload-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      console.error('   Error details:', JSON.stringify(uploadError, null, 2));
      return;
    }

    console.log('✅ Upload successful!');
    console.log('   Path:', uploadData?.path);

    // Test 3: Get public URL
    console.log('\n🔗 Test 3: Get public URL...');
    const { data: urlData } = supabase.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(testPath);

    console.log('✅ Public URL:', urlData.publicUrl);

    // Test 4: Delete test file
    console.log('\n🗑️  Test 4: Delete test file...');
    const { error: deleteError } = await supabase.storage
      .from(GALLERY_BUCKET)
      .remove([testPath]);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      return;
    }

    console.log('✅ Delete successful!\n');
    console.log('🎉 All tests passed! Supabase connection is working.\n');

  } catch (error: any) {
    console.error('❌ Exception:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testSupabaseUpload();
