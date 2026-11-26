import React, { useMemo } from 'react'
import {
  useStore, getWorkloadDetails, getMemberStats, getAlerts, roleDisplayName,
  daysUntil, todayStr, isActive, isOverdue, getMissingRoles
} from '../store.js'
import { Card, StatCard, SectionTitle, Badge, LoadBar, AlertRow, EmptyState, DataTable, HBarList } from '../components.jsx'

export function ResourcesView({ onOpenMember }) {
  const { state } = useStore()
  const { members, projects } = state
  const today = todayStr()
  const alerts = useMemo(() => getAlerts(state, today), [state, today])

  const rows = useMemo(() => members.map((m) => {
    const stats = getMemberStats(m, projects, today)
    const wl = getWorkloadDetails(m.id, projects, today)
    const d7 = wl.active.filter((p) => p.endDate && daysUntil(p.endDate, today) >= 0 && daysUntil(p.endDate, today) <= 7)
    const d30 = wl.active.filter((p) => p.endDate && daysUntil(p.endDate, today) >= 0 && daysUntil(p.endDate, today) <= 30)
    return { member: m, stats, wl, d7, d30 }
  }), [members, projects, today])

  const columns = [
    { title: '成员', key: 'name', sortable: true, render: (r) => <b>{r.member.name}</b> },
    { title: '固定岗位', render: (r) => r.member.role === '待配置' ? <Badge color="amber">待配置</Badge> : <Badge color="blue">{r.member.role}</Badge> },
    { title: '状态', render: (r) => <Badge color={r.member.status === '在岗' ? 'green' : r.member.status === '休假' ? 'amber' : 'gray'}>{r.member.status}</Badge> },
    { title: '负责', key: 'leading', sortable: true, render: (r) => r.stats.leading },
    { title: '参与', key: 'participating', sortable: true, render: (r) => r.stats.participating },
    { title: '7天交付', render: (r) => <span className={r.d7.length ? 'text-amber' : ''}>{r.d7.length}</span> },
    { title: '30天交付', render: (r) => r.d30.length },
    { title: '逾期', render: (r) => <span className={r.stats.overdue ? 'text-danger' : ''}>{r.stats.overdue}</span> },
    { title: '预计投入工时', render: (r) => `${r.wl.hours}h` },
    { title: '工作负荷', key: 'workload', sortable: true, render: (r) => <LoadBar percent={r.wl.percent} /> },
    { title: '负荷等级', render: (r) => <Badge color={r.wl.level === '超载' ? 'red' : r.wl.level === '繁忙' ? 'amber' : r.wl.level === '适中' ? 'blue' : 'gray'}>{r.wl.level}</Badge> },
    { title: '操作', render: (r) => <button className="btn btn-ghost btn-sm" onClick={() => onOpenMember(r.member.id)}>查看</button> },
  ]

  const available = rows.filter((r) => r.member.status === '在岗' && r.wl.percent < 70)
  const busy = rows.filter((r) => r.wl.percent >= 100)
  const unassigned = projects.filter((p) => isActive(p) && getMissingRoles(p).length > 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>团队资源调配</h1>
          <p>以 6 位成员为维度分析工作分配 · 负荷综合优先级、任务数量与预计投入时间</p>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="团队成员" value={members.length} tone="blue" />
        <StatCard label="可承接新任务" value={available.length} tone="green" hint="在岗且负荷低于70%" />
        <StatCard label="负荷超载" value={busy.length} tone="red" />
        <StatCard label="人员缺失项目" value={unassigned.length} tone={unassigned.length ? 'amber' : 'gray'} />
      </div>

      <Card title="人员资源分配视图" subtitle="用于快速决定新项目安排给谁 · 负荷越低、状态在岗越适合分配">
        <DataTable
          columns={columns}
          rows={rows.map((r) => ({ ...r, _key: r.member.id, name: r.member.name, leading: r.stats.leading, participating: r.stats.participating, workload: r.wl.percent }))}
        />
      </Card>

      <div className="two-col mt">
        <Card title="工作负荷对比">
          <HBarList items={rows.map((r) => ({ label: r.member.name, value: r.wl.percent, color: r.wl.percent >= 100 ? '#e27593' : r.wl.percent >= 70 ? '#eda75f' : '#4a90e2' }))} format={(v) => `${v}%`} max={Math.max(100, ...rows.map((r) => r.wl.percent))} />
        </Card>
        <Card title="分配建议">
          <div className="suggest-list">
            <div className="suggest-block">
              <h4 className="text-green">近期有空余工作能力</h4>
              {available.length === 0 ? <p className="muted">暂无空余成员</p> : available.map((r) => (
                <div className="suggest-item" key={r.member.id}>
                  <span>{r.member.name}（{r.member.role}）</span>
                  <Badge color="green">负荷 {r.wl.percent}%</Badge>
                </div>
              ))}
            </div>
            <div className="suggest-block">
              <h4 className="text-red">近期任务繁重</h4>
              {busy.length === 0 ? <p className="muted">暂无超载成员</p> : busy.map((r) => (
                <div className="suggest-item" key={r.member.id}>
                  <span>{r.member.name}（{r.member.role}）</span>
                  <Badge color="red">负荷 {r.wl.percent}%</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title={`工作负荷预警 · ${alerts.length} 条`} subtitle="项目时间重叠、短期交付高峰、岗位超负荷/闲置、人员缺失、跨岗位未确认、项目逾期">
        {alerts.length === 0 ? <EmptyState text="当前没有预警" /> : (
          <div className="alert-list">{alerts.map((a) => <AlertRow key={a.id} alert={a} />)}</div>
        )}
      </Card>

      {unassigned.length > 0 && (
        <Card title="缺少人员分工的项目">
          <DataTable
            columns={[
              { title: '项目名称', render: (p) => <b>{p.name}</b> },
              { title: '缺少角色', render: (p) => <span className="text-danger">{getMissingRoles(p).join('、')}</span> },
              { title: '负责人', render: (p) => roleDisplayName(p, 'lead', members) },
              { title: '截止日期', key: 'endDate' },
            ]}
            rows={unassigned.map((p) => ({ ...p, _key: p.id }))}
          />
        </Card>
      )}
    </div>
  )
}
