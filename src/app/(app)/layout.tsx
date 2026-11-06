import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { RecipeActivity } from '@/features/recipes/recipe-activity';

export const dynamic = 'force-dynamic';
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let userId: string;
  try {
    userId = (await requireUser()).userId;
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect('/login');
    throw error;
  }
  return (
    <>
      <RecipeActivity key={userId} />
      {children}
    </>
  );
}
