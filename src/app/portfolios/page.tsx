import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PortfolioList } from '@/components/portfolio/PortfolioList';

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('portfolios')
    .select('id, title, subtitle, status, current_step, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PortfolioList portfolios={data ?? []} />
      </div>
    </div>
  );
}
