import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type OrganisationSettings = {
  inviteOnlyOnboarding: boolean;
  multiBatchGrouping: boolean;
  staffCanCreateMeetings: boolean;
  studentsCanPostQuestions: boolean;
};

const DEFAULT_SETTINGS: OrganisationSettings = {
  inviteOnlyOnboarding: true,
  multiBatchGrouping: true,
  staffCanCreateMeetings: true,
  studentsCanPostQuestions: true,
};

async function getCurrentOrgContext() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'User profile not found' }, { status: 404 }) };
  }

  if (!['super_admin', 'org_admin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!profile.org_id) {
    return { error: NextResponse.json({ error: 'User is not assigned to an organization' }, { status: 400 }) };
  }

  return { supabase, orgId: profile.org_id };
}

export async function GET() {
  try {
    const context = await getCurrentOrgContext();
    if ('error' in context) {
      return context.error;
    }

    const { data, error } = await createAdminClient()
      .from('organisations')
      .select('settings')
      .eq('id', context.orgId)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      settings: {
        ...DEFAULT_SETTINGS,
        ...(data?.settings ?? {}),
      },
    });
  } catch (error) {
    console.error('Organisation settings GET route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentOrgContext();
    if ('error' in context) {
      return context.error;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const settings = body as Partial<OrganisationSettings>;

    // Filter settings to only allowed keys and ensure boolean types
    const allowedKeys = Object.keys(DEFAULT_SETTINGS) as (keyof OrganisationSettings)[];
    const filteredSettings: Partial<OrganisationSettings> = {};

    for (const key of allowedKeys) {
      if (settings[key] !== undefined && typeof settings[key] === 'boolean') {
        filteredSettings[key] = settings[key];
      }
    }

    const mergedSettings: OrganisationSettings = {
      ...DEFAULT_SETTINGS,
      ...filteredSettings,
    };

    const invalidEntry = Object.entries(mergedSettings).find(([, value]) => typeof value !== 'boolean');
    if (invalidEntry) {
      return NextResponse.json({ error: `Invalid setting: ${invalidEntry[0]}` }, { status: 400 });
    }

    const { error } = await createAdminClient()
      .from('organisations')
      .update({ settings: mergedSettings })
      .eq('id', context.orgId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (error) {
    console.error('Organisation settings POST route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
