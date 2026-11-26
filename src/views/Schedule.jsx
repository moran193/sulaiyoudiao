import React, { useMemo, useState, useEffect } from 'react'
import {
  useStore, PROJECT_TYPES, PROJECT_STATUS, MEMBER_STATUS,
  isOverdue, isDueSoon, daysUntil, todayStr, monthNow, monthBounds,
  formatDate, formatMoney, addDays, roleDisplayName, getDesignerIds
} from '../store.js'
import { Card, Badge, StatusBadge, EmptyState, Field, Input, Select, FilterBar, FilterItem, SectionTitle, ProgressBar } from '../components.jsx'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// 项目专属色板：每个项目分配一种颜色，月历 / 周历 / 甘特图保持一致
export const PROJECT_PALETTE = [
  { bg: '#dceafc', fg: '#2e6bb4', bar: '#4a90e2' }, // 晴蓝
  { bg: '#e2f4e8', fg: '#33855a', bar: '#5fb87e' }, // 抹茶绿
  { bg: '#fcebf0', fg: '#c14a6e', bar: '#e27593' }, // 樱粉
  { bg: '#fdf0df', fg: '#b97a2e', bar: '#eda75f' }, // 杏橙
  { bg: '#edeafa', fg: '#6f5cbd', bar: '#9d8fd8' }, // 雾紫
  { bg: '#e0f2f6', fg: '#2e8aa0', bar: '#55b1c4' }, // 湖青
  { bg: '#fdf6d9', fg: '#a8862a', bar: '#e3b84f' }, // 奶黄
  { bg: '#e4e9fb', fg: '#4a55b0', bar: '#7d88d8' }, // 风信紫
  { bg: '#dff5ee', fg: '#2b8f74', bar: '#4fc0a1' }, // 薄荷
  { bg: '#fdeadb', fg: '#c05f3c', bar: '#e8825e' }, // 珊瑚
]

function hashString(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

// 基于全部项目建立颜色映射：先按名称稳定取色，重名色则顺延，保证当前项目尽量一项目一色
export function buildProjectColors(projects) {
  const map = {}
  const used = new Set()
  ;[...projects]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
    .forEach((p) => {
      let idx = hashString(String(p.name || p.id || '')) % PROJECT_PALETTE.length
      let step = 0
      while (used.has(idx) && step < PROJECT_PALETTE.length) {
        idx = (idx + 1) % PROJECT_PALETTE.length
        step += 1
      }
      used.add(idx)
      map[p.id] = PROJECT_PALETTE[idx]
    })
  return map
}

function ProjectColorLegend({ projects, colorMap }) {
  const list = projects.filter((p) => colorMap[p.id])
  if (!list.length) return null
  return (
    <div className="cal-legend">
      <span className="cal-legend-title">项目色标</span>
      <div className="cal-legend-items">
        {list.map((p) => (
          <span key={p.id} className="cal-legend-item" title={p.name}>
            <i style={{ background: colorMap[p.id].bar }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ScheduleView({ onOpenProject }) {
  const { state } = useStore()
  const { projects, members } = state
  const today = todayStr()
  const [mode, setMode] = useState('month')
  const [ym, setYm] = useState(monthNow())
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today + 'T00:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [filters, setFilters] = useState({ member: '', role: '', type: '', status: '' })

  const filtered = useMemo(() => projects.filter((p) => {
    if (filters.type && p.type !== filters.type) return false
    if (filters.status && p.status !== filters.status) return false
    if (filters.role === 'designer' && getDesignerIds(p).length === 0) return false
    if (filters.role && filters.role !== 'designer' && !p[filters.role]) return false
    if (filters.member && !getDesignerIds(p).includes(filters.member)) return false
    return true
  }), [projects, filters])

  const projectColors = useMemo(() => buildProjectColors(projects), [projects])

  const memberOptions = [
    { value: '', label: '全部成员' },
    ...members.map((m) => ({ value: m.id, label: `${m.name}（${m.role}）` })),
  ]

  const control = (
    <FilterBar>
      <FilterItem label="视图">
        <Select value={mode} onChange={(e) => setMode(e.target.value)} options={[
          { value: 'month', label: '月度日历' }, { value: 'week', label: '周度日历' }, { value: 'gantt', label: '甘特图' },
        ]} />
      </FilterItem>
      {mode === 'month' && <FilterItem label="月份"><Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></FilterItem>}
      {mode === 'week' && <FilterItem label="周起始"><Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></FilterItem>}
      <FilterItem label="设计师"><Select value={filters.member} onChange={(e) => setFilters({ ...filters, member: e.target.value })} options={memberOptions} /></FilterItem>
      <FilterItem label="类型"><Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={[{ value: '', label: '全部类型' }, ...PROJECT_TYPES]} /></FilterItem>
      <FilterItem label="状态"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[{ value: '', label: '全部状态' }, ...PROJECT_STATUS]} /></FilterItem>
    </FilterBar>
  )

  const projectDot = (p) => {
    const c = projectColors[p.id] || PROJECT_PALETTE[0]
    const overdue = isOverdue(p, today)
    return (
      <span
        className={`cal-pill ${overdue ? 'overdue' : ''}`}
        style={{ background: c.bg, color: c.fg, borderLeftColor: c.bar }}
        title={`${p.name}｜${p.startDate} ~ ${p.endDate}｜${p.status}｜${p.progress}%${overdue ? '｜已逾期' : ''}`}
        onClick={(e) => { e.stopPropagation(); onOpenProject(p.id) }}
      >
        {overdue ? '⚠️ ' : ''}{p.name}
      </span>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>项目排期</h1>
          <p>月度日历、周度日历与甘特图共用同一项目数据 · 修改项目时间后自动联动</p>
        </div>
      </div>

      <Card title="筛选" extra={control} />

      {mode === 'month' && <MonthCalendar ym={ym} filtered={filtered} projectDot={projectDot} today={today} members={members} projectColors={projectColors} onOpenProject={onOpenProject} />}
      {mode === 'week' && <WeekCalendar start={weekStart} filtered={filtered} projectDot={projectDot} today={today} members={members} onShift={setWeekStart} projectColors={projectColors} />}
      {mode === 'gantt' && <GanttChart projects={filtered} today={today} members={members} onOpenProject={onOpenProject} projectColors={projectColors} />}
    </div>
  )
}

function MonthCalendar({ ym, filtered, projectDot, today, members, projectColors, onOpenProject }) {
  const [selected, setSelected] = useState(today)
  // 切换月份时把选中日调整到该月，避免面板显示与日历不一致
  useEffect(() => {
    if (selected.slice(0, 7) === ym) return
    setSelected(today.slice(0, 7) === ym ? today : `${ym}-01`)
  }, [ym])

  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startOffset = (first.getDay() || 7) - 1
  const daysInMonth = new Date(y, m, 0).getDate()
  // 按当月实际需要的周数渲染，不再固定 6 行
  const weeks = Math.ceil((startOffset + daysInMonth) / 7)
  const startDate = new Date(y, m - 1, 1 - startOffset)
  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const inMonth = d.getMonth() === m - 1
    const ps = filtered
      .filter((p) => p.startDate && p.endDate && p.startDate <= ds && p.endDate >= ds)
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
    cells.push({ ds, day: d.getDate(), inMonth, ps })
  }
  const selectedCell = cells.find((c) => c.ds === selected)
  const selectedProjects = selectedCell
    ? selectedCell.ps
    : filtered.filter((p) => p.startDate && p.endDate && p.startDate <= selected && p.endDate >= selected)

  return (
    <Card title={`${ym} 月度日历`} subtitle="点击任意日期查看当日完整项目 · 点击项目条可直接查看详情">
      <div className="calendar">
        <div className="cal-weekdays">{WEEKDAYS.map((w) => <div key={w}>周{w}</div>)}</div>
        <div className="cal-grid">
          {cells.map((c) => (
            <div
              key={c.ds}
              className={`cal-cell ${c.inMonth ? '' : 'outside'} ${c.ds === today ? 'today' : ''} ${c.ds === selected ? 'selected' : ''}`}
              onClick={() => setSelected(c.ds)}
            >
              <div className="cal-day">
                <span className="cal-day-num">{c.day}</span>
                {c.ds === today && <span className="cal-day-today">今天</span>}
                {c.ps.length > 0 && <span className="cal-day-count">{c.ps.length} 项</span>}
              </div>
              <div className="cal-events">
                {c.ps.map((p) => <div key={p.id} className="cal-event">{projectDot(p)}</div>)}
                {c.ps.length === 0 && <div className="cal-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DayDetailPanel
        ds={selected}
        projects={selectedProjects}
        members={members}
        projectColors={projectColors}
        today={today}
        onOpenProject={onOpenProject}
        onGoToday={() => setSelected(today)}
      />
      <ProjectColorLegend projects={filtered} colorMap={projectColors} />
    </Card>
  )
}

// 当日完整项目面板：显示选中日期的全部项目及完整字段，不受日历格子空间限制
function DayDetailPanel({ ds, projects, members, projectColors, today, onOpenProject, onGoToday }) {
  const d = new Date(ds + 'T00:00:00')
  const weekLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return (
    <div className="day-panel">
      <div className="day-panel-head">
        <div className="day-panel-title">
          <b>{ds}</b>
          <span className="day-panel-sub">{weekLabel} · 当日完整项目</span>
          <Badge color={projects.length ? 'blue' : 'gray'} dot={false}>{projects.length} 个项目</Badge>
        </div>
        {ds !== today && today.slice(0, 7) === ds.slice(0, 7) && (
          <button className="btn btn-ghost btn-sm" onClick={onGoToday}>回到今天</button>
        )}
      </div>
      {projects.length === 0
        ? <div className="day-panel-empty"><EmptyState text="该日期没有进行中的项目" /></div>
        : (
          <div className="day-projects">
            {projects.map((p) => {
              const c = projectColors[p.id] || PROJECT_PALETTE[0]
              const overdue = isOverdue(p, today)
              const soon = !overdue && isDueSoon(p, today)
              const designers = getDesignerIds(p)
                .map((id) => members.find((mm) => mm.id === id)?.name)
                .filter(Boolean)
              return (
                <div key={p.id} className="day-project" onClick={() => onOpenProject(p.id)}>
                  <span className="day-project-bar" style={{ background: c.bar }} />
                  <div className="day-project-main">
                    <div className="day-project-top">
                      <b className="day-project-name">{p.name}</b>
                      <Badge color={p.type === 'direct' ? 'green' : 'purple'} dot={false}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge>
                      <StatusBadge status={p.status} />
                      {overdue && <Badge color="red" dot={false}>⚠️ 已逾期</Badge>}
                      {soon && <Badge color="amber" dot={false}>临期</Badge>}
                    </div>
                    <div className="day-project-meta">
                      <span>周期 <b>{p.startDate || '—'} ~ {p.endDate || '—'}</b></span>
                      <span>进度 <b>{p.progress || 0}%</b></span>
                      <span>负责人 <b>{roleDisplayName(p, 'lead', members) || '—'}</b></span>
                      <span>策划 <b>{roleDisplayName(p, 'planner', members) || '—'}</b></span>
                      <span>执行 <b>{roleDisplayName(p, 'executor', members) || '—'}</b></span>
                      <span>设计师 <b>{designers.length ? designers.join('、') : '—'}</b></span>
                      {p.dealStatus === '已成交' && <span>成交 <b>{formatMoney(p.dealAmount)}</b></span>}
                    </div>
                    <div className="day-project-progress"><ProgressBar value={p.progress || 0} /></div>
                  </div>
                  <span className="day-project-go">查看详情 →</span>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

function WeekCalendar({ start, filtered, projectDot, today, members, onShift, projectColors }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const ds = addDays(start, i)
    return { ds, label: `${['周一','周二','周三','周四','周五','周六','周日'][i]} ${ds.slice(5)}`, ps: filtered.filter((p) => p.startDate && p.endDate && p.startDate <= ds && p.endDate >= ds) }
  })
  return (
    <Card
      title={`周度日历 · ${start} ~ ${addDays(start, 6)}`}
      extra={
        <div className="btn-group">
          <button className="btn btn-outline btn-sm" onClick={() => onShift(addDays(start, -7))}>← 上一周</button>
          <button className="btn btn-outline btn-sm" onClick={() => onShift(today)}>本周</button>
          <button className="btn btn-outline btn-sm" onClick={() => onShift(addDays(start, 7))}>下一周 →</button>
        </div>
      }
    >
      <div className="week-grid">
        {days.map((d) => (
          <div className={`week-col ${d.ds === today ? 'today' : ''}`} key={d.ds}>
            <div className="week-head">{d.label}</div>
            <div className="week-body">
              {d.ps.length === 0 && <div className="week-empty">无项目</div>}
              {d.ps.map((p) => <div key={p.id} className="week-event">{projectDot(p)}</div>)}
            </div>
          </div>
        ))}
      </div>
      <ProjectColorLegend projects={filtered} colorMap={projectColors} />
    </Card>
  )
}

function GanttChart({ projects, today, members, onOpenProject, projectColors }) {
  const [range, setRange] = useState(120)
  const sorted = useMemo(() => [...projects].filter((p) => p.startDate && p.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate)), [projects])

  if (!sorted.length) {
    return <Card title="项目甘特图"><EmptyState text="暂无包含日期的项目数据" /></Card>
  }

  let min = sorted.reduce((a, p) => (p.startDate < a ? p.startDate : a), sorted[0].startDate)
  let max = sorted.reduce((a, p) => (p.endDate > a ? p.endDate : a), sorted[0].endDate)
  if (today < min) min = today
  if (today > max) max = today
  const start = addDays(min, -3)
  const totalDays = Math.min(range, Math.max(30, Math.round((new Date(max) - new Date(min)) / 86400000) + 10))
  const dates = Array.from({ length: totalDays }, (_, i) => addDays(start, i))
  const dayW = 30
  const todayIndex = dates.indexOf(today)

  const monthGroups = []
  dates.forEach((ds, i) => {
    const key = ds.slice(0, 7)
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.key === key) last.count += 1
    else monthGroups.push({ key, count: 1, startIndex: i })
  })

  return (
    <Card title="项目甘特图" subtitle="横轴为日期，色条为项目专属色 · 红色描边标记逾期，虚线为今天">
      <div className="gantt-toolbar">
        <span>显示天数：</span>
        <Select value={range} onChange={(e) => setRange(Number(e.target.value))} options={[{ value: 60, label: '60 天' }, { value: 120, label: '120 天' }, { value: 240, label: '240 天' }]} />
        <span className="muted">共 {sorted.length} 个项目 · 横向可滚动</span>
      </div>
      <div className="gantt-scroll">
        <div className="gantt-inner" style={{ width: 230 + totalDays * dayW }}>
          <div className="gantt-header">
            <div className="gantt-name gantt-head-cell">项目名称 / 负责人</div>
            <div className="gantt-timeline">
              <div className="gantt-months">
                {monthGroups.map((g) => <div key={g.key} style={{ width: g.count * dayW }}>{g.key}</div>)}
              </div>
              <div className="gantt-days">
                {dates.map((ds, i) => {
                  const d = new Date(ds + 'T00:00:00')
                  const wd = d.getDay()
                  return <div key={ds} className={`gantt-day ${wd === 0 || wd === 6 ? 'weekend' : ''} ${ds === today ? 'today' : ''}`} style={{ width: dayW }}>{d.getDate()}</div>
                })}
              </div>
            </div>
          </div>
          <div className="gantt-body">
            {sorted.map((p) => {
              const sIdx = dates.indexOf(p.startDate)
              const eIdx = dates.indexOf(p.endDate)
              const from = sIdx >= 0 ? sIdx : 0
              const to = eIdx >= 0 ? eIdx : 0
              const left = from * dayW
              const width = Math.max(dayW, (to - from + 1) * dayW)
              const lead = roleDisplayName(p, 'lead', members)
              const c = projectColors[p.id] || PROJECT_PALETTE[0]
              const overdue = isOverdue(p, today)
              return (
                <div className="gantt-row" key={p.id}>
                  <div className="gantt-name" onClick={() => onOpenProject(p.id)}>
                    <b title={p.name}>{p.name}</b>
                    <small>{lead} · {p.status} · {p.progress}%</small>
                  </div>
                  <div className="gantt-track">
                    <div className="gantt-bar" style={{ left, width, background: c.bar, boxShadow: overdue ? 'inset 0 0 0 2px #e27593' : 'none' }} onClick={() => onOpenProject(p.id)} title={`${p.name} ${p.startDate}~${p.endDate}${overdue ? '（已逾期）' : ''}`}>
                      <span>{p.progress}%</span>
                    </div>
                    {todayIndex >= 0 && <div className="gantt-today-line" style={{ left: todayIndex * dayW + dayW / 2 }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <ProjectColorLegend projects={sorted} colorMap={projectColors} />
    </Card>
  )
}

// 成员统计相关区块（项目清单、分布图、占比图）均已迁移至「成员统计」导航页（src/views/MemberStats.jsx）
