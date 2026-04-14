import { StreamClient } from '@stream-io/node-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

async function run() {
  const args = process.argv.slice(2);
  const webhookUrlArg = args.find(a => a.startsWith('--webhook-url='))?.split('=')[1];

  if (!apiKey || !apiSecret) {
    console.error('❌ Error: NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET must be set in .env.local');
    process.exit(1);
  }

  if (!webhookUrlArg) {
    console.log('\n🚀 Required Webhook URL Missing!');
    console.log('Usage: npx tsx scripts/setup-stream-native.ts --webhook-url=[NGROK_APP_URL]/api/webhooks/stream');
    process.exit(1);
  }

  const client = new StreamClient(apiKey, apiSecret, { timeout: 30000 });

  try {
    try {
      new URL(webhookUrlArg);
      if (!webhookUrlArg.startsWith('https://')) {
        throw new Error('Webhook URL must be absolute and use https://');
      }
    } catch (err: any) {
      console.error(`❌ Invalid Webhook URL: ${err.message}`);
      process.exit(1);
    }

    console.log('1️⃣  Resetting Call Type (default) to Native Storage...');
    
    // Update 'default' call type to use native storage (remove external_storage override)
    await client.video.updateCallType('default', {
      recording: {
         enabled: true,
         mode: 'available',
         quality: '720p',
         external_storage: '', // Empty string reverts to native Stream storage
      }
    });
    console.log('✅ Call Type updated to use Native Storage!');

    console.log('2️⃣  Configuring Webhook URL...');
    
    // Update App Settings for Webhook
    await client.updateAppSettings({
      webhook_config: {
        callback_url: webhookUrlArg,
        enabled: true,
      }
    });
    console.log('✅ Webhook URL configured!');

    console.log('\n🎉 Native Setup Complete! Recordings will now use Stream Cloud.');
    console.log('------------------------------------------------------');
    console.log(`Webhook URL: ${webhookUrlArg}`);
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
