import { StreamClient } from '@stream-io/node-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

async function run() {
  const args = process.argv.slice(2);
  const minioUrlArg = args.find(a => a.startsWith('--minio-url='))?.split('=')[1];
  const webhookUrlArg = args.find(a => a.startsWith('--webhook-url='))?.split('=')[1];

  if (!apiKey || !apiSecret) {
    console.error('❌ Error: NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET must be set in .env.local');
    process.exit(1);
  }

  if (!minioUrlArg || !webhookUrlArg) {
    console.log('\n🚀 Required Arguments Missing!');
    console.log('Usage: npx tsx scripts/setup-stream.ts --minio-url=[NGROK_MINIO_URL] --webhook-url=[NGROK_APP_URL]/api/webhooks/stream');
    console.log('\nExample:');
    console.log('  npx tsx scripts/setup-stream.ts --minio-url=https://minio-tunnel.ngrok-free.app --webhook-url=https://app-tunnel.ngrok-free.app/api/webhooks/stream\n');
    process.exit(1);
  }

  const client = new StreamClient(apiKey, apiSecret, { timeout: 30000 });

  try {
    // URL Validation
    try {
      for (const url of [minioUrlArg, webhookUrlArg]) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
          throw new Error(`URL must use https: protocol: ${url}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ Invalid Argument: ${err.message}`);
      process.exit(1);
    }

    console.log('1️⃣  Registering MinIO External Storage...');
    
    // 1. Create or Update External Storage Configuration
    try {
      console.log('   Checking if storage exists...');
      await client.video.createExternalStorage({
        name: 'minio-storage',
        storage_type: 's3',
        bucket: process.env.MINIO_BUCKET || 'lms-recordings',
        aws_s3: {
          s3_custom_endpoint_url: minioUrlArg,
          s3_api_key: process.env.MINIO_ACCESS_KEY || 'admin',
          s3_secret: process.env.MINIO_SECRET_KEY || 'password123',
          s3_region: 'us-east-1',
        },
      });
      console.log('✅ MinIO Storage Registered!');
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log('ℹ️  MinIO Storage "minio-storage" already exists. Updating it with the new URL...');
        await client.video.updateExternalStorage('minio-storage', {
          storage_type: 's3',
          bucket: process.env.MINIO_BUCKET || 'lms-recordings',
          aws_s3: {
            s3_custom_endpoint_url: minioUrlArg,
            s3_api_key: process.env.MINIO_ACCESS_KEY || 'admin',
            s3_secret: process.env.MINIO_SECRET_KEY || 'password123',
            s3_region: 'us-east-1',
          },
        });
        console.log('✅ MinIO Storage Updated with new URL!');
      } else {
        throw err;
      }
    }

    console.log('2️⃣  Updating Call Type (default) to use MinIO...');
    
    // 2. Update 'default' call type to enable recording and link to storage
    await client.video.updateCallType('default', {
      notification_settings: {
        enabled: true,
      },
      recording: {
         enabled: true,
         mode: 'available',
         external_storage: 'minio-storage'
      }
    });
    console.log('✅ Call Type updated with Recording settings!');

    console.log('3️⃣  Configuring Webhook URL...');
    
    // 3. Update App Settings for Webhook
    await client.updateAppSettings({
      webhook_config: {
        callback_url: webhookUrlArg,
        enabled: true,
      }
    });
    console.log('✅ Webhook URL configured!');

    console.log('\n🎉 Setup Complete! Your LMS is now ready for recordings.');
    console.log('------------------------------------------------------');
    console.log(`MinIO Endpoint: ${minioUrlArg}`);
    console.log(`Webhook URL:    ${webhookUrlArg}`);
    console.log('------------------------------------------------------');
    
  } catch (error: any) {
    console.error('\n❌ Setup Failed!');
    console.error(error?.message || error);
    if (error?.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

run();
