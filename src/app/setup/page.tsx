import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SetupWizardClient } from './SetupWizardClient';

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  return <SetupWizardClient />;
}
