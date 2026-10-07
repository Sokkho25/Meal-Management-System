import { useState } from 'react';
import { Activity, Building2, UserPlus, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { monthShort } from '../utils/format';
import { Avatar, Badge, Card, EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, Segmented, StatCard } from '../components/ui';
import { SERIES, SimpleBars } from '../components/charts';

const dateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never');

function ago(d) {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return dateTime(d).slice(0, 11);
}

const count = (v) => Number(v || 0).toLocaleString('en-US');

/** Site owner page: every account and household on this MessMate server. */
export default function Owner() {
  const [tab, setTab] = useState('users');
  const stats = useAsync(() => api.get('/owner/stats'), []);

  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  if (!stats.data) return <PageLoader />;
  const s = stats.data;

  return (
    <>
      <PageHeader title="Site owner" subtitle="Everyone who has signed up to this MessMate site. Only you can see this page." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={count(s.totals.users)} hint={`+${count(s.signups.last7)} this week`} icon={Users} tone="brand" />
        <StatCard label="Active today" value={count(s.active.last24h)} hint={`${count(s.active.last7)} this week`} icon={Activity} tone="sky" />
        <StatCard label="Households" value={count(s.totals.households)} hint={`${count(s.totals.members)} members`} icon={Building2} tone="violet" />
        <StatCard label="New (30 days)" value={count(s.signups.last30)} hint={`${count(s.active.last30)} active`} icon={UserPlus} tone="amber" />
      </div>

      <Card title="Sign-ups per day" subtitle="Last 30 days" className="mt-5">
        <SimpleBars
          data={s.signupsByDay.map((d) => ({ name: `${d.date.slice(8)}/${d.date.slice(5, 7)}`, 'Sign-ups': d.count }))}
          dataKey="Sign-ups"
          name="Sign-ups"
          color={SERIES[0]}
          height={200}
          formatter={(v) => count(v)}
        />
      </Card>

      <Segmented
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'users', label: `Users (${count(s.totals.users)})` },
          { value: 'households', label: `Households (${count(s.totals.households)})` },
        ]}
      />
      <div className="mt-3">{tab === 'users' ? <UsersTable /> : <HouseholdsTable />}</div>
    </>
  );
}

function UsersTable() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const { data, error, reload } = useAsync(() => api.get(`/owner/users?q=${encodeURIComponent(dq)}&sort=${sort === 'active' ? 'active' : 'newest'}&page=${page}&limit=25`), [dq, sort, page]);

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
        <Input
          className="flex-1"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Segmented
          size="sm"
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'active', label: 'Last active' },
          ]}
        />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <div className="py-12">
          <PageLoader />
        </div>
      ) : !data.items.length ? (
        <EmptyState icon={Users} title="No users found" description={q ? 'Try a different search.' : 'Nobody has signed up yet.'} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Household</th>
                  <th>Signed up</th>
                  <th>Last active</th>
                  <th className="text-right">Logins</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="hidden sm:block">
                          <Avatar name={u.name} size="sm" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{u.name}</p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.households.length ? (
                        <div className="flex flex-wrap gap-1">
                          {u.households.map((h) => (
                            <Badge key={h._id} tone={h.role === 'admin' ? 'brand' : 'slate'}>
                              {h.name}
                              {h.role === 'admin' ? ' · admin' : ''}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None yet</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-sm text-slate-600" title={dateTime(u.createdAt)}>
                      {ago(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap text-sm text-slate-600" title={dateTime(u.lastSeenAt)}>
                      {ago(u.lastSeenAt)}
                    </td>
                    <td className="num text-right">{count(u.loginCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function HouseholdsTable() {
  const { data, error, reload } = useAsync(() => api.get('/owner/households'), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageLoader />;
  if (!data.items.length) return <EmptyState icon={Building2} title="No households yet" />;
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Household</th>
              <th>Created by</th>
              <th className="text-right">Members</th>
              <th className="text-right">Logins</th>
              <th>Latest month</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((h) => (
              <tr key={h._id}>
                <td>
                  <p className="font-medium text-slate-800">{h.name}</p>
                  <p className="text-xs text-slate-500">{h.type === 'family' ? 'Family' : 'Bachelor mess'}</p>
                </td>
                <td>
                  <p className="text-sm text-slate-700">{h.owner?.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{h.owner?.email}</p>
                </td>
                <td className="num text-right">{count(h.members)}</td>
                <td className="num text-right">{count(h.logins)}</td>
                <td className="whitespace-nowrap text-sm text-slate-600">{h.latest ? `${monthShort(h.latest.year, h.latest.month)} (${count(h.months)} total)` : 'None'}</td>
                <td className="whitespace-nowrap text-sm text-slate-600" title={dateTime(h.lastActivity)}>
                  {ago(h.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
