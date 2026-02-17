import { useEffect, useMemo, useState } from 'react';
import type { CompanyStats, Agent, Task } from '../types';
import AgentAvatar from './AgentAvatar';

interface DashboardProps {
  stats: CompanyStats | null;
  agents: Agent[];
  tasks: Task[];
  companyName: string;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const time = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const hour = now.getHours();
  const briefing = hour < 12 ? '오전 브리핑' : hour < 18 ? '오후 운영 점검' : '저녁 마감 점검';

  return { date, time, briefing };
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  inbox: { label: '수신함', color: 'bg-slate-500/20 text-slate-200 border-slate-400/30', dot: 'bg-slate-400' },
  planned: { label: '계획됨', color: 'bg-blue-500/20 text-blue-100 border-blue-400/30', dot: 'bg-blue-400' },
  in_progress: { label: '진행 중', color: 'bg-amber-500/20 text-amber-100 border-amber-400/30', dot: 'bg-amber-400' },
  review: { label: '검토 중', color: 'bg-violet-500/20 text-violet-100 border-violet-400/30', dot: 'bg-violet-400' },
  done: { label: '완료', color: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30', dot: 'bg-emerald-400' },
  pending: { label: '보류', color: 'bg-orange-500/20 text-orange-100 border-orange-400/30', dot: 'bg-orange-400' },
  cancelled: { label: '취소됨', color: 'bg-rose-500/20 text-rose-100 border-rose-400/30', dot: 'bg-rose-400' },
};

const RANK_ICONS = ['👑', '🥈', '🥉'];

const DEPT_COLORS = [
  { bar: 'from-blue-500 to-cyan-400', badge: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
  { bar: 'from-violet-500 to-fuchsia-400', badge: 'bg-violet-500/20 text-violet-200 border-violet-400/30' },
  { bar: 'from-emerald-500 to-teal-400', badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  { bar: 'from-amber-500 to-orange-400', badge: 'bg-amber-500/20 text-amber-100 border-amber-400/30' },
  { bar: 'from-rose-500 to-pink-400', badge: 'bg-rose-500/20 text-rose-100 border-rose-400/30' },
  { bar: 'from-cyan-500 to-sky-400', badge: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/30' },
  { bar: 'from-orange-500 to-red-400', badge: 'bg-orange-500/20 text-orange-100 border-orange-400/30' },
  { bar: 'from-teal-500 to-lime-400', badge: 'bg-teal-500/20 text-teal-100 border-teal-400/30' },
];

function CircularProgress({ value }: { value: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const safeValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
      <circle
        stroke="#1e293b"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke="url(#dashboardProgressGradient)"
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="dashboardProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Dashboard({ stats, agents, tasks, companyName }: DashboardProps) {
  const { date, time, briefing } = useNow();
  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  const totalTasks = stats?.tasks?.total ?? tasks.length;
  const completedTasks = stats?.tasks?.done ?? tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks =
    stats?.tasks?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length;
  const plannedTasks = stats?.tasks?.planned ?? tasks.filter((t) => t.status === 'planned').length;
  const reviewTasks = stats?.tasks?.review ?? tasks.filter((t) => t.status === 'review').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const activeAgents =
    stats?.agents?.working ?? agents.filter((a) => a.status === 'working').length;
  const idleAgents = stats?.agents?.idle ?? agents.filter((a) => a.status === 'idle').length;
  const totalAgents = stats?.agents?.total ?? agents.length;
  const completionRate =
    stats?.tasks?.completion_rate ??
    (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
  const activeRate = totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0;
  const reviewQueue = reviewTasks + pendingTasks;

  const deptData = useMemo(() => {
    if (stats?.tasks_by_department && stats.tasks_by_department.length > 0) {
      return stats.tasks_by_department
        .map((d, i) => ({
          id: d.id,
          name: d.name,
          icon: d.icon ?? '🏢',
          done: d.done_tasks,
          total: d.total_tasks,
          ratio: d.total_tasks > 0 ? Math.round((d.done_tasks / d.total_tasks) * 100) : 0,
          color: DEPT_COLORS[i % DEPT_COLORS.length],
        }))
        .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
    }

    const deptMap = new Map<string, { name: string; icon: string; done: number; total: number }>();
    for (const agent of agents) {
      if (!agent.department_id) continue;
      if (!deptMap.has(agent.department_id)) {
        deptMap.set(agent.department_id, {
          name: agent.department?.name_ko ?? agent.department?.name ?? agent.department_id,
          icon: agent.department?.icon ?? '🏢',
          done: 0,
          total: 0,
        });
      }
    }

    for (const task of tasks) {
      if (!task.department_id) continue;
      const entry = deptMap.get(task.department_id);
      if (!entry) continue;
      entry.total += 1;
      if (task.status === 'done') entry.done += 1;
    }

    return Array.from(deptMap.entries())
      .map(([id, value], i) => ({
        id,
        ...value,
        ratio: value.total > 0 ? Math.round((value.done / value.total) * 100) : 0,
        color: DEPT_COLORS[i % DEPT_COLORS.length],
      }))
      .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
  }, [stats, agents, tasks]);

  const topAgents = useMemo(() => {
    if (stats?.top_agents && stats.top_agents.length > 0) {
      return stats.top_agents.slice(0, 5).map((topAgent) => {
        const agent = agentMap.get(topAgent.id);
        return {
          id: topAgent.id,
          name: agent?.name_ko ?? agent?.name ?? topAgent.name,
          department: agent?.department?.name_ko ?? agent?.department?.name ?? '',
          tasksDone: topAgent.stats_tasks_done,
          xp: topAgent.stats_xp,
        };
      });
    }

    return [...agents]
      .sort((a, b) => b.stats_xp - a.stats_xp)
      .slice(0, 5)
      .map((agent) => ({
        id: agent.id,
        name: agent.name_ko ?? agent.name,
        department: agent.department?.name_ko ?? agent.department?.name ?? '',
        tasksDone: agent.stats_tasks_done,
        xp: agent.stats_xp,
      }));
  }, [stats, agents, agentMap]);

  const maxXp = topAgents.length > 0 ? Math.max(...topAgents.map((agent) => agent.xp), 1) : 1;

  const recentTasks = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, 6),
    [tasks]
  );

  const kpiCards = [
    {
      id: 'total',
      label: '전체 업무',
      value: totalTasks.toLocaleString('ko-KR'),
      sub: '누적 등록 태스크',
      icon: '📋',
      iconTone: 'bg-blue-500/15 text-blue-300',
      valueTone: 'text-white',
      borderTone: 'hover:border-blue-400/40',
    },
    {
      id: 'done',
      label: '완료율',
      value: `${completionRate}%`,
      sub: `${completedTasks.toLocaleString('ko-KR')}건 완료`,
      icon: '✅',
      iconTone: 'bg-emerald-500/15 text-emerald-300',
      valueTone: 'text-emerald-300',
      borderTone: 'hover:border-emerald-400/40',
    },
    {
      id: 'active',
      label: '활동 에이전트',
      value: `${activeAgents}/${totalAgents}`,
      sub: `가동률 ${activeRate}%`,
      icon: '🤖',
      iconTone: 'bg-cyan-500/15 text-cyan-300',
      valueTone: 'text-cyan-300',
      borderTone: 'hover:border-cyan-400/40',
    },
    {
      id: 'progress',
      label: '진행 중 업무',
      value: inProgressTasks.toLocaleString('ko-KR'),
      sub: `계획 ${plannedTasks.toLocaleString('ko-KR')}건`,
      icon: '⚡',
      iconTone: 'bg-amber-500/15 text-amber-300',
      valueTone: 'text-amber-300',
      borderTone: 'hover:border-amber-400/40',
    },
  ];

  return (
    <section className="relative isolate space-y-6 text-slate-100">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_45%)]" />
        <div className="relative grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Operational Dashboard</p>
            <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">{companyName}</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              실시간 진행 현황을 한 화면에서 확인하고 우선순위를 빠르게 조정할 수 있도록 정리된 운영 뷰입니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-600/70 bg-slate-800/70 px-3 py-1 text-xs text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {date}
              </span>
              <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                {briefing}
              </span>
              <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                검토 대기 {reviewQueue.toLocaleString('ko-KR')}건
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-inner shadow-slate-950/30">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">현재 시각</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-cyan-200">{time}</p>
              <p className="mt-1 text-xs text-slate-400">실시간 동기화 기준</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <div className="flex items-center gap-4">
                <div className="relative grid h-20 w-20 place-items-center">
                  <CircularProgress value={completionRate} />
                  <span className="absolute text-base font-semibold text-cyan-200">{completionRate}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100">업무 완료 진행률</p>
                  <p className="mt-1 text-xs text-slate-400">
                    완료 {completedTasks.toLocaleString('ko-KR')}건 / 전체 {totalTasks.toLocaleString('ko-KR')}건
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-700"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.id}
            className={`group rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800/70 ${card.borderTone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                <p className={`mt-3 text-3xl font-semibold tracking-tight ${card.valueTone}`}>{card.value}</p>
                <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
              </div>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.iconTone}`}>
                {card.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
            <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-sm text-blue-300">🏗️</span>
            <span>부서별 성과</span>
          </h2>
          {deptData.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">
              데이터가 없습니다
            </div>
          ) : (
            <div className="space-y-4">
              {deptData.map((dept) => (
                <article
                  key={dept.id}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 transition-colors hover:border-slate-600/70 hover:bg-slate-800/60"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/40 bg-slate-700/60 text-base">
                        {dept.icon}
                      </span>
                      <span className="font-medium text-slate-100">{dept.name}</span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${dept.color.badge}`}>
                      {dept.ratio}%
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                    <span>완료 {dept.done.toLocaleString('ko-KR')}건</span>
                    <span>전체 {dept.total.toLocaleString('ko-KR')}건</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-700/60">
                    <div
                      className={`relative h-full rounded-full bg-gradient-to-r ${dept.color.bar} transition-all duration-700`}
                      style={{ width: `${dept.ratio}%` }}
                    >
                      <div className="absolute inset-0 animate-[shimmer_2.4s_linear_infinite] bg-gradient-to-r from-white/0 via-white/25 to-white/0" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
            <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-sm text-amber-300">🏆</span>
            <span>에이전트 리더보드</span>
          </h2>
          {topAgents.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">
              등록된 에이전트가 없습니다
            </div>
          ) : (
            <div className="space-y-2.5">
              {topAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  className={`grid grid-cols-[2.6rem_auto_1fr] items-center gap-3 rounded-xl border p-3 transition-all duration-300 ${
                    index === 0
                      ? 'border-amber-400/35 bg-gradient-to-r from-amber-600/20 to-orange-500/10'
                      : index === 1
                      ? 'border-slate-500/40 bg-slate-700/30'
                      : index === 2
                      ? 'border-orange-500/30 bg-orange-500/10'
                      : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {index < 3 ? (
                      <span className="text-xl">{RANK_ICONS[index]}</span>
                    ) : (
                      <span className="font-mono text-base font-semibold text-slate-400">#{index + 1}</span>
                    )}
                  </div>

                  <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={40} />

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`truncate text-sm font-semibold ${index === 0 ? 'text-amber-100' : 'text-slate-100'}`}>
                        {agent.name}
                      </span>
                      <span className="ml-2 rounded bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium text-blue-200">
                        {agent.xp.toLocaleString()} XP
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          index === 0
                            ? 'bg-gradient-to-r from-amber-300 to-yellow-200'
                            : index === 1
                            ? 'bg-gradient-to-r from-slate-200 to-slate-100'
                            : index === 2
                            ? 'bg-gradient-to-r from-orange-400 to-amber-300'
                            : 'bg-gradient-to-r from-cyan-400 to-blue-400'
                        }`}
                        style={{ width: `${(agent.xp / maxXp) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                      <span className="max-w-[95px] truncate">{agent.department || '미지정'}</span>
                      <span>{agent.tasksDone.toLocaleString('ko-KR')} Tasks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="rounded-lg bg-cyan-500/20 px-2 py-1 text-sm text-cyan-300">📡</span>
            <span>최근 활동</span>
          </h2>
          <span className="rounded-full border border-slate-600/70 bg-slate-800/70 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-300">
            유휴 에이전트 {idleAgents.toLocaleString('ko-KR')}명
          </span>
        </div>
        {recentTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">최근 활동 없음</p>
        ) : (
          <div className="space-y-2.5">
            {recentTasks.map((task) => {
              const statusInfo = STATUS_LABELS[task.status] ?? {
                label: task.status,
                color: 'bg-slate-600/20 text-slate-200 border-slate-500/30',
                dot: 'bg-slate-400',
              };
              const assignedAgent =
                task.assigned_agent ??
                (task.assigned_agent_id ? agentMap.get(task.assigned_agent_id) : undefined);

              return (
                <article
                  key={task.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/35 p-3 transition-all hover:border-slate-600/80 hover:bg-slate-800/60"
                >
                  {assignedAgent ? (
                    <AgentAvatar agent={assignedAgent} agents={agents} size={40} rounded="xl" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg text-slate-400">
                      📄
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                      {assignedAgent ? (assignedAgent.name_ko ?? assignedAgent.name) : '미배정'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-[11px] text-slate-500">{timeAgo(task.updated_at)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
