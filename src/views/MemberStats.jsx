import React, { useMemo, useState } from 'react'
import { useStore, PROJECT_TYPES, PROJECT_STATUS, getDesignerIds } from '../store.js'
import { Card, EmptyState, FilterBar, FilterItem, Select, BarChart, PieChart } from '../components.jsx'
import { PROJECT_PALETTE, buildProjectColors } from './Schedule.jsx'

// 成员项目统计：由「项目排期」迁移至本页最上方；仅列出各自参与的项目，不展示进度等明细
function MemberProjectStats({ projects, members, onOpenProject, projectColors }) {
  const active = projects.filter((p) => p.status !== '已取消')
  const rows = members.map((m) => ({
    m,
    ps: active.filter((p) => getDesignerIds(p).includes(m.id)),
  }))

  if (!rows.some((r) => r.ps.length)) return <EmptyState text="当前筛选条件下暂无项目分配到设计师" />

  return (
    <div className="mps">
      <div className="mps-grid">
        {rows.map((r) => (
          <div className="mps-card" key={r.m.id}>
            <div className="mps-head">
              <span className="avatar">{r.m.name.slice(0, 1)}</span>
              <div className="mps-ident"><b>{r.m.name}</b></div>
              <div className="mps-total"><b>{r.ps.length}</b><span>个项目</span></div>
            </div>

            <div className="mps-projects">
              {r.ps.length === 0
                ? <span className="mps-none">暂无参与项目</span>
                : r.ps.map((p) => {
                    const c = projectColors[p.id] || PROJECT_PALETTE[0]
                    return (
                      <button
                        key={p.id}
                        className="mps-project"
                        style={{ borderLeftColor: c.bar }}
                        title="点击查看项目详情"
                        onClick={() => onOpenProject(p.id)}
                      >
                        <i style={{ background: c.bar }} />
                        {p.name}
                      </button>
                    )
                  })}
            </div>
          </div>
        ))}
      </div>
      <p className="mps-note">统计口径：排除已取消项目；协作项目计入每位参与设计师。点击项目条目可查看详情。</p>
    </div>
  )
}

// 设计师项目分布 / 参与占比：同样由「项目排期」迁移而来
function DesignerProjectCharts({ projects, members }) {
  const active = projects.filter((p) => p.status !== '已取消')
  const rows = useMemo(() => members.map((m) => {
    const participated = active.filter((p) => getDesignerIds(p).includes(m.id))
    // 三类互斥：未成交优先判定，其余按来源分为比稿与直接成交
    const lost = participated.filter((p) => p.dealStatus === '未成交')
    const pitch = participated.filter((p) => p.dealStatus !== '未成交' && p.type === 'pitch')
    const direct = participated.filter((p) => p.dealStatus !== '未成交' && p.type !== 'pitch')
    return {
      ...m,
      label: m.name,
      total: participated.length,
      direct: direct.length,
      pitch: pitch.length,
      lost: lost.length,
    }
  }), [active, members])

  const totalAssignments = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="two-col">
      <Card title="设计师成员项目数分布" subtitle="各成员参与项目数（多人协作项目计入每位设计师）· 随筛选联动">
        {totalAssignments === 0
          ? <EmptyState text="当前筛选条件下暂无项目分配到设计师" />
          : <BarChart
              data={rows}
              series={[
                { key: 'direct', label: '直接成交', color: '#00b42a' },
                { key: 'pitch', label: '比稿', color: '#ffb400' },
                { key: 'lost', label: '未成交', color: '#c9cdd4' },
              ]}
              stacked
              height={260}
              yFormat={(v) => v}
            />}
      </Card>
      <Card title="设计师项目参与占比" subtitle="按参与人次占比 · 含协作项目的重复计入">
        {totalAssignments === 0
          ? <EmptyState text="当前筛选条件下暂无项目分配到设计师" />
          : <PieChart
              data={rows.map((r) => ({ label: r.name, value: r.total }))}
              height={260}
              centerLabel="参与人次"
              valueFormat={(v) => `${v} 个项目`}
            />}
      </Card>
    </div>
  )
}

export function MemberStatsView({ onOpenProject }) {
  const { state } = useStore()
  const { projects, members } = state
  const [filters, setFilters] = useState({ member: '', type: '', status: '' })

  const memberOptions = [
    { value: '', label: '全部成员' },
    ...members.map((m) => ({ value: m.id, label: `${m.name}（${m.role}）` })),
  ]

  const filtered = useMemo(() => projects.filter((p) => {
    if (filters.type && p.type !== filters.type) return false
    if (filters.status && p.status !== filters.status) return false
    if (filters.member && !getDesignerIds(p).includes(filters.member)) return false
    return true
  }), [projects, filters])

  const projectColors = useMemo(() => buildProjectColors(projects), [projects])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>成员统计</h1>
          <p>设计师参与项目清单、项目数分布与参与占比 · 随项目数据实时更新</p>
        </div>
      </div>

      <Card title="成员项目统计" subtitle="按设计师维度列出各自参与的项目 · 随筛选联动">
        <MemberProjectStats projects={filtered} members={members} onOpenProject={onOpenProject} projectColors={projectColors} />
      </Card>

      <Card title="筛选" subtitle="对上方清单与下方图表同时生效" extra={
        <FilterBar>
          <FilterItem label="设计师"><Select value={filters.member} onChange={(e) => setFilters({ ...filters, member: e.target.value })} options={memberOptions} /></FilterItem>
          <FilterItem label="类型"><Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={[{ value: '', label: '全部类型' }, ...PROJECT_TYPES]} /></FilterItem>
          <FilterItem label="状态"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[{ value: '', label: '全部状态' }, ...PROJECT_STATUS]} /></FilterItem>
        </FilterBar>
      } />

      <DesignerProjectCharts projects={filtered} members={members} />
    </div>
  )
}
