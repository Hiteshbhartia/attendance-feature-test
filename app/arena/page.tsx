import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import EmployeeSidebar from '@/components/employee-sidebar';
import ArenaConsole from '@/components/arena/ArenaConsole';

export default async function ArenaOperatorPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      <EmployeeSidebar />
      <div className="md:ml-64">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
          <ArenaConsole
            userId={user.id}
            userName={user.fullName}
            kpiTeam={user.playbookRole || 'recruiter'}
          />
        </div>
      </div>
    </div>
  );
}
