import type { Task, Language } from '../types';
import { TEAM_MEMBERS } from '../data/templatesData';
import { getTranslation } from '../utils/locales';

interface WorkloadViewProps {
  tasks: Task[];
  lang: Language;
}

// Timezone-safe local date utilities
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDaysBetween = (d1: Date, d2: Date): number => {
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

export default function WorkloadView({ tasks, lang }: WorkloadViewProps) {
  
  // Calculate stats for each team member
  const memberWorkloads = TEAM_MEMBERS.map(member => {
    const memberTasks = tasks.filter(t => t.assignee === member.name);
    
    // Calculate total days allocated (milestones are 0 days)
    const allocatedDays = memberTasks.reduce((sum, t) => {
      if (t.isMilestone) return sum;
      const start = parseLocalDate(t.startDate);
      const end = parseLocalDate(t.endDate);
      return sum + getDaysBetween(start, end) + 1;
    }, 0);

    // Calculate completed vs total tasks
    const totalCount = memberTasks.length;
    const completedCount = memberTasks.filter(t => t.status === 'done').length;
    const activeTasks = memberTasks.filter(t => t.status !== 'done');
    
    // Average progress
    const avgProgress = totalCount > 0
      ? Math.round(memberTasks.reduce((sum, t) => sum + t.progress, 0) / totalCount)
      : 0;

    // Overload criteria: > 20 days allocated OR > 3 active tasks
    const isOverloaded = allocatedDays > 20 || activeTasks.length > 3;

    return {
      ...member,
      tasks: memberTasks,
      allocatedDays,
      totalCount,
      completedCount,
      activeCount: activeTasks.length,
      avgProgress,
      isOverloaded
    };
  });

  return (
    <div className="workload-container">
      <div className="workload-header">
        <h3>{getTranslation(lang, 'workloadTitle')}</h3>
        <p>{getTranslation(lang, 'workloadSubtitle')}</p>
      </div>

      <div className="workload-grid">
        {memberWorkloads.map(mw => {
          // Calculate percentage for visual fill bar (max load = 30 days)
          const fillPercentage = Math.min((mw.allocatedDays / 30) * 100, 100);
          
          return (
            <div key={mw.name} className="workload-card">
              {/* User Avatar Info */}
              <div className="workload-user-info">
                <div className="workload-user">
                  <div 
                    className="workload-avatar" 
                    style={{ backgroundColor: mw.avatarColor }}
                  >
                    {mw.name.substring(0, 2)}
                  </div>
                  <div className="workload-name">
                    <h4>{mw.name}</h4>
                    <p>{lang === 'uk' ? mw.roleUa : mw.roleEn}</p>
                  </div>
                </div>

                {/* Overload status badge */}
                <span className={`workload-badge ${mw.isOverloaded ? 'badge-overloaded' : 'badge-optimal'}`}>
                  {mw.isOverloaded 
                    ? getTranslation(lang, 'statusOverloaded') 
                    : getTranslation(lang, 'statusOptimal')}
                </span>
              </div>

              {/* Numerical Stats grid */}
              <div className="workload-stats">
                <div>
                  <div className="stat-label">{getTranslation(lang, 'allocatedDays')}</div>
                  <div className="stat-val">{mw.allocatedDays} {getTranslation(lang, 'daysCount')}</div>
                </div>
                <div>
                  <div className="stat-label">{getTranslation(lang, 'progress')}</div>
                  <div className="stat-val">{mw.avgProgress}%</div>
                </div>
              </div>

              {/* Workload Load Bar */}
              <div className="workload-bar-wrapper">
                <div className="workload-bar-label">
                  <span>Завантаженість / Capacity</span>
                  <span>{mw.activeCount} активних / active</span>
                </div>
                <div className="workload-bar-bg">
                  <div 
                    className="workload-bar-fill" 
                    style={{ 
                      width: `${fillPercentage}%`,
                      backgroundColor: mw.isOverloaded ? 'var(--danger)' : 'var(--primary)'
                    }} 
                  />
                </div>
              </div>

              {/* List of Assigned Tasks */}
              <div style={{ marginTop: '4px' }}>
                <h5 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Завдання / Tasks ({mw.totalCount})
                </h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {mw.tasks.map(t => (
                    <li 
                      key={t.id} 
                      style={{ 
                        fontSize: '0.78rem', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px'
                      }}
                    >
                      <span style={{ 
                        textDecoration: t.status === 'done' ? 'line-through' : 'none',
                        color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        maxWidth: '180px'
                      }} title={t.title}>
                        {t.title}
                      </span>
                      <span style={{ color: t.status === 'done' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 500 }}>
                        {t.isMilestone ? 'Віха / Milestone' : `${t.progress}%`}
                      </span>
                    </li>
                  ))}
                  {mw.totalCount === 0 && (
                    <li style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '6px' }}>
                      Немає призначених завдань
                    </li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
