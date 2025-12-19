/**
 * Test script to verify Supabase connection and storage bucket setup
 * Run this after adding Supabase credentials to .env
 *
 * Usage: npx ts-node src/scripts/test-supabase-connection.ts
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before importing supabase config
dotenv.config();

import { supabase, GALLERY_BUCKET } from '../config/supabase';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Test 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');
  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not found in .env');
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    return;
  }
  if (!process.env.SUPABASE_STORAGE_BUCKET) {
    console.error('❌ SUPABASE_STORAGE_BUCKET not found in .env');
    return;
  }
  console.log('✅ Environment variables configured');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  console.log(`   Bucket: ${GALLERY_BUCKET}\n`);

  // Test 2: List storage buckets
  console.log('2️⃣ Testing storage bucket access...');
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError.message);
      return;
    }

    console.log(`✅ Successfully connected to Supabase Storage`);
    console.log(`   Found ${buckets?.length || 0} bucket(s):`);
    buckets?.forEach((bucket) => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    console.log('');

    // Test 3: Check if gallery bucket exists
    console.log('3️⃣ Checking gallery bucket...');
    const galleryBucket = buckets?.find((b) => b.name === GALLERY_BUCKET);

    if (!galleryBucket) {
      console.error(`❌ Bucket "${GALLERY_BUCKET}" not found!`);
      console.log(`\n📝 Please create the bucket in Supabase dashboard:`);
      console.log(`   1. Go to Storage in Supabase dashboard`);
      console.log(`   2. Click "New bucket"`);
      console.log(`   3. Name: ${GALLERY_BUCKET}`);
      console.log(`   4. Make it PUBLIC`);
      return;
    }

    console.log(`✅ Gallery bucket "${GALLERY_BUCKET}" exists`);
    console.log(`   Public: ${galleryBucket.public ? 'Yes ✓' : 'No ✗'}`);

    if (!galleryBucket.public) {
      console.warn(`\n⚠️  WARNING: Bucket is not public!`);
      console.log(`   Images won't be accessible. Make it public in Supabase dashboard.`);
    }
    console.log('');

    // Test 4: Test file upload and delete
    console.log('4️⃣ Testing file upload...');
    const testFileName = `test/connection-test-${Date.now()}.txt`;
    const testContent = 'This is a test file from Tennis Club RT2';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(testFileName, Buffer.from(testContent), {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      return;
    }

    console.log(`✅ Successfully uploaded test file: ${testFileName}`);
    console.log('');

    // Test 5: Get public URL
    console.log('5️⃣ Testing public URL generation...');
    const { data: urlData } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(testFileName);

    if (urlData?.publicUrl) {
      console.log(`✅ Public URL generated successfully`);
      console.log(`   ${urlData.publicUrl}`);
      console.log('');
    }

    // Test 6: Clean up test file
    console.log('6️⃣ Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from(GALLERY_BUCKET)
      .remove([testFileName]);

    if (deleteError) {
      console.warn(`⚠️  Warning: Could not delete test file: ${deleteError.message}`);
    } else {
      console.log(`✅ Test file deleted successfully`);
    }
    console.log('');

    // Success!
    console.log('🎉 All tests passed! Supabase is ready to use.\n');
    console.log('Next steps:');
    console.log('1. Start your backend server: npm run dev');
    console.log('2. Test image upload via the admin interface');
    console.log('3. Check that images appear in the public gallery\n');
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

// Run the test
testSupabaseConnection()
  .then(() => {
    console.log('Test completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
