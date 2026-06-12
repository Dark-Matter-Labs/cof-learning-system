import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

export const DELETE = withAuth<{ id: string }>(async ({ params, supabase }) => {
  const { id } = await params;

  const { error } = await supabase
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
});
