import React, { useMemo, useState } from 'react'
import {
  useStore, getMonthlyStats, getAlerts,
  isActive, isOverdue, isDueSoon, todayStr, monthNow, formatMoney,
  roleDisplayName, getDesignerIds, addDays, daysUntil
} from '../store.js'
import {
  Card, StatCard, SectionTitle, Badge, StatusBadge, ProgressBar, DataTable, Modal, EmptyState,
  Field, Input, Textarea
} from '../components.jsx'
import { PROJECT_PALETTE, buildProjectColors } from './Schedule.jsx'

const WEEK_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 首页 · 本周日历：周一至周日 7 列，仅列出刘琼设计师参与的项目；下方给出本周项目清单
function HomeWeekCalendar({ projects, members, projectColors, today, onOpenProject, onNavigate }) {
  const thisMonday = mondayOf(today)
  const [start, setStart] = useState(thisMonday)

  // 与「今日任务」保持同一口径：仅显示刘琼设计师参与的项目（协作项目计入）
  const liu = members.find((m) => m.name === '刘琼')
  const liuId = liu ? liu.id : 'M1'
  const liuProjects = useMemo(
    () => projects.filter((p) => getDesignerIds(p).includes(liuId)),
    [projects, liuId]
  )

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const ds = addDays(start, i)
    const ps = liuProjects
      .filter((p) => p.status !== '已取消' && p.startDate && p.endDate && p.startDate <= ds && p.endDate >= ds)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
    return { ds, ps }
  }), [start, liuProjects])

  // 本周刘琼参与的全部项目（去重），用于卡片底部的项目清单
  const weekProjects = useMemo(() => {
    const map = new Map()
    days.forEach((d) => d.ps.forEach((p) => { if (!map.has(p.id)) map.set(p.id, p) }))
    return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
  }, [days])

  return (
    <Card
      title="本周日历"
      subtitle={`${start} ~ ${addDays(start, 6)} · 今天 ${today} · 仅显示刘琼设计师参与的项目`}
      extra={
        <div className="hw-actions">
          <div className="btn-group">
            <button className="btn btn-outline btn-sm" title="上一周" onClick={() => setStart(addDays(start, -7))}>←</button>
            <button className="btn btn-outline btn-sm" onClick={() => setStart(thisMonday)}>本周</button>
            <button className="btn btn-outline btn-sm" title="下一周" onClick={() => setStart(addDays(start, 7))}>→</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('schedule')}>全部排期 →</button>
        </div>
      }
    >
      <div className="hw-grid">
        {days.map((d, i) => (
          <div className={`hw-col ${d.ds === today ? 'today' : ''}`} key={d.ds}>
            <div className="hw-head">
              <span className="hw-weekday">{WEEK_CN[i]}</span>
              <span className="hw-date">{d.ds.slice(5)}</span>
              {d.ds === today && <span className="hw-today-tag">今天</span>}
            </div>
            <div className="hw-body">
              {d.ps.length === 0
                ? <span className="hw-empty">—</span>
                : d.ps.map((p) => {
                    const c = projectColors[p.id] || PROJECT_PALETTE[0]
                    const isStart = p.startDate === d.ds
                    const isEnd = p.endDate === d.ds
                    return (
                      <button
                        key={p.id}
                        className="hw-pill"
                        style={{ background: c.bg, color: c.fg, borderLeftColor: c.bar }}
                        title={`${p.name}｜${p.startDate} ~ ${p.endDate}｜${p.status}`}
                        onClick={() => onOpenProject(p.id)}
                      >
                        {isStart && <em className="hw-mark">始</em>}
                        {isEnd && <em className="hw-mark">止</em>}
                        <span>{p.name}</span>
                      </button>
                    )
                  })}
            </div>
            <div className="hw-count">{d.ps.length} 项</div>
          </div>
        ))}
      </div>

      <div className="hw-weeklist">
        <span className="hw-weeklist-label">本周刘琼参与项目清单 · 共 {weekProjects.length} 个</span>
        <div className="hw-weeklist-chips">
          {weekProjects.length === 0
            ? <span className="muted">本周暂无刘琼参与的项目安排</span>
            : weekProjects.map((p) => {
                const c = projectColors[p.id] || PROJECT_PALETTE[0]
                return (
                  <button
                    key={p.id}
                    className="hw-weekchip"
                    title={`${p.name}｜${p.startDate} ~ ${p.endDate}｜点击查看项目详情`}
                    onClick={() => onOpenProject(p.id)}
                  >
                    <i style={{ background: c.bar }} />
                    {p.name}
                  </button>
                )
              })}
        </div>
      </div>
      <p className="hw-note">仅显示刘琼设计师参与的项目（协作项目计入）·「始」为当天开始、「止」为当天截止 · 已取消项目不计入 · 点击任意项目可查看详情</p>
    </Card>
  )
}

// 首页 · 今日任务：仅显示刘琼设计师参与的项目，基于真实日期与状态派生
function HomeTodayTasks({ projects, members, today, onOpenProject, onNavigate }) {
  const liu = members.find((m) => m.name === '刘琼')
  const liuId = liu ? liu.id : 'M1'
  const liuProjects = useMemo(
    () => projects.filter((p) => getDesignerIds(p).includes(liuId)),
    [projects, liuId]
  )

  const groups = useMemo(() => {
    const active = liuProjects.filter((p) => p.status !== '已完成' && p.status !== '已取消')
    const overdue = [], due = [], starting = [], working = []
    active.forEach((p) => {
      if (isOverdue(p, today)) overdue.push(p)
      else if (isDueSoon(p, today, 3)) due.push(p)
      else if (p.startDate === today) starting.push(p)
      else if (p.startDate && p.endDate && p.startDate <= today && p.endDate >= today) working.push(p)
    })
    const tag = (p) => {
      if (isOverdue(p, today)) return `已逾期 ${Math.abs(daysUntil(p.endDate, today))} 天`
      const d = daysUntil(p.endDate, today)
      if (d >= 0 && d <= 3) return d === 0 ? '今日交付' : `${d} 天后交付`
      if (p.startDate === today) return '今日启动'
      if (p.status === '未开始') return '待启动'
      return '推进中'
    }
    return { overdue, due, starting, working, tag }
  }, [liuProjects, today])

  const total = groups.overdue.length + groups.due.length + groups.starting.length + groups.working.length
  const dotColor = { danger: 'var(--red)', amber: 'var(--amber)', blue: 'var(--primary)', plain: '#9fb0c4' }
  const defs = [
    { key: 'overdue', icon: '🔴', label: '逾期未交付', tone: 'danger', rows: groups.overdue },
    { key: 'due', icon: '🟠', label: '今日 / 3 天内交付', tone: 'amber', rows: groups.due },
    { key: 'starting', icon: '🌱', label: '今日启动', tone: 'blue', rows: groups.starting },
    { key: 'working', icon: '📌', label: '进行中', tone: 'plain', rows: groups.working },
  ]
  const LIMIT = 6

  const renderRow = (p, tone) => (
    <button key={p.id} className="ht-item" onClick={() => onOpenProject(p.id)} title="点击查看项目详情">
      <span className="ht-dot" style={{ background: dotColor[tone] }} />
      <span className="ht-name">{p.name}</span>
      <span className={`ht-tag ${tone}`}>{groups.tag(p)}</span>
      <span className="ht-date">截止 {p.endDate || '—'}</span>
    </button>
  )

  return (
    <Card
      title="今日任务"
      subtitle={`${today} · 仅显示刘琼设计师参与的项目（共 ${liuProjects.length} 个）`}
      extra={<Badge color={groups.overdue.length ? 'red' : total ? 'blue' : 'green'} dot={false}>{total} 项待关注</Badge>}
    >
      <div className="ht-summary">
        <div className="ht-summary-item"><b>{total}</b><span>今日待办</span></div>
        <div className="ht-summary-item danger"><b>{groups.overdue.length}</b><span>逾期</span></div>
        <div className="ht-summary-item amber"><b>{groups.due.length}</b><span>临期交付</span></div>
      </div>

      {total === 0
        ? <EmptyState text="刘琼今天没有待处理项目，安排很轻松" />
        : defs.filter((d) => d.rows.length).map((def) => (
            <div className="ht-group" key={def.key}>
              <div className="ht-group-head">{def.icon} {def.label}<span className="ht-num">{def.rows.length}</span></div>
              <div className="ht-list">
                {def.rows.slice(0, LIMIT).map((p) => renderRow(p, def.tone))}
                {def.rows.length > LIMIT && (
                  <button className="ht-more" onClick={() => onNavigate('projects')}>还有 {def.rows.length - LIMIT} 个项目 · 查看全部 →</button>
                )}
              </div>
            </div>
          ))}

      <p className="ht-note">口径：仅统计刘琼作为设计师参与的项目（协作项目计入）；排除已完成 / 已取消；按「逾期 → 临期交付 → 今日启动 → 进行中」归类，同一项目只出现一次。点击条目可查看项目详情。</p>
    </Card>
  )
}

// 首页 · 待办事项：可新增、可编辑、可勾选完成、可删除，随全量 state 云端同步
function TodoCard() {
  const { state, generateTodoId, addTodo, updateTodo, deleteTodo, toggleTodo } = useStore()
  const todos = Array.isArray(state.todos) ? state.todos : []
  const today = todayStr()

  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(true)
  const [editor, setEditor] = useState(null)   // null | { mode:'new' } | { mode:'edit', todo }
  const [form, setForm] = useState({ text: '', note: '', due: '' })

  const undone = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const overdue = undone.filter((t) => t.due && t.due < today)

  const ordered = useMemo(() => {
    const a = [...undone].sort((x, y) =>
      String(y.createdAt || '').localeCompare(String(x.createdAt || '')) || String(y.id || '').localeCompare(String(x.id || '')))
    const b = [...done].sort((x, y) => String(y.doneAt || '').localeCompare(String(x.doneAt || '')))
    return [...a, ...b]
  }, [todos])
  const visible = showDone ? ordered : ordered.filter((t) => !t.done)

  const quickAdd = () => {
    const text = draft.trim()
    if (!text) return
    addTodo({ id: generateTodoId(), text, note: '', due: '', done: false, doneAt: '', createdAt: today })
    setDraft('')
  }

  const openNew = () => {
    setForm({ text: draft.trim(), note: '', due: '' })
    setEditor({ mode: 'new' })
  }
  const openEdit = (t) => {
    setForm({ text: t.text || '', note: t.note || '', due: t.due || '' })
    setEditor({ mode: 'edit', todo: t })
  }
  const saveEditor = () => {
    const text = form.text.trim()
    if (!editor || !text) return
    if (editor.mode === 'new') {
      addTodo({ id: generateTodoId(), text, note: form.note.trim(), due: form.due, done: false, doneAt: '', createdAt: today })
      setDraft('')
    } else {
      updateTodo(editor.todo.id, { text, note: form.note.trim(), due: form.due })
    }
    setEditor(null)
  }
  const removeTodo = () => {
    if (editor?.mode === 'edit') deleteTodo(editor.todo.id)
    setEditor(null)
  }

  return (
    <Card
      title="待办事项"
      subtitle="可新增 · 可编辑 · 勾选即完成 · 随云端同步"
      extra={<button className="btn btn-primary btn-sm" onClick={openNew}>＋ 新增待办</button>}
    >
      <div className="todo-quick">
        <Input
          value={draft}
          placeholder="输入待办内容，回车快速添加…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') quickAdd() }}
        />
        <button className="btn btn-outline btn-sm" onClick={quickAdd}>添加</button>
      </div>

      <div className="todo-summary">
        <div className="todo-summary-item"><b>{undone.length}</b><span>待完成</span></div>
        <div className="todo-summary-item danger"><b>{overdue.length}</b><span>已逾期</span></div>
        <div className="todo-summary-item ok"><b>{done.length}</b><span>已完成</span></div>
      </div>

      <div className="todo-toolbar">
        <span className="muted">未完成在前 · 已完成自动沉底</span>
        <button className="todo-toggle" onClick={() => setShowDone((v) => !v)}>
          {showDone ? '隐藏已完成' : `显示已完成 (${done.length})`}
        </button>
      </div>

      {visible.length === 0
        ? <EmptyState text={todos.length ? '没有需要显示的待办事项' : '还没有待办事项，添加一条吧'} />
        : (
          <div className="todo-list">
            {visible.map((t) => {
              const isOverdue = !t.done && t.due && t.due < today
              return (
                <div className={`todo-item ${t.done ? 'done' : ''}`} key={t.id}>
                  <label className="todo-check" title={t.done ? '标记为未完成' : '标记为已完成'}>
                    <input type="checkbox" checked={!!t.done} onChange={() => toggleTodo(t.id)} />
                    <span className="todo-box" />
                  </label>
                  <div className="todo-main">
                    <div className="todo-text">{t.text}</div>
                    {(t.note || t.due || (t.done && t.doneAt)) && (
                      <div className="todo-meta">
                        {t.due && <span className={`todo-due ${isOverdue ? 'overdue' : ''}`}>📅 {isOverdue ? '已逾期 · ' : ''}{t.due}</span>}
                        {t.note && <span className="todo-note">{t.note}</span>}
                        {t.done && t.doneAt && <span className="todo-doneat">✓ {t.doneAt} 完成</span>}
                      </div>
                    )}
                  </div>
                  <div className="todo-ops">
                    <button className="icon-btn todo-edit" title="编辑" onClick={() => openEdit(t)}>✎</button>
                    <button className="icon-btn todo-del" title="删除" onClick={() => deleteTodo(t.id)}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      <p className="todo-foot">待办事项保存在云端共享数据库，同一链接的其他电脑会自动同步；勾选、编辑、删除后约 1 秒上传。</p>

      {editor && (
        <Modal
          title={editor.mode === 'new' ? '新增待办事项' : '编辑待办事项'}
          subtitle="内容必填，可补充备注与截止日期"
          width="520px"
          onClose={() => setEditor(null)}
          footer={
            <>
              {editor.mode === 'edit' && <button className="btn btn-danger btn-sm todo-footer-del" onClick={removeTodo}>删除</button>}
              <button className="btn btn-ghost" onClick={() => setEditor(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveEditor}>保存</button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="待办内容" required wide>
              <Input
                value={form.text}
                autoFocus
                placeholder="例如：整理比稿提案初稿"
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditor() }}
              />
            </Field>
            <Field label="截止日期" hint="可选，逾期会自动标记">
              <Input type="date" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
            </Field>
            <Field label="备注" hint="可选补充说明" wide>
              <Textarea value={form.note} placeholder="例如：需与策划确认方向" onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  )
}

// 首页 · 成员项目统计（简约行式）：只列出每位设计师参与的项目，不展示进度等明细
function MemberProjectBrief({ projects, members, onOpenProject, projectColors }) {
  const active = projects.filter((p) => p.status !== '已取消')
  const rows = members.map((m) => ({
    m,
    ps: active.filter((p) => getDesignerIds(p).includes(m.id)),
  }))

  if (rows.length === 0) return <EmptyState text="暂无设计师成员档案" />
  if (!rows.some((r) => r.ps.length)) return <EmptyState text="当前暂无项目分配到设计师" />

  return (
    <div className="mpb">
      <div className="mpb-list">
        {rows.map((r) => (
          <div className="mpb-row" key={r.m.id}>
            <div className="mpb-who">
              <span className="avatar">{r.m.name.slice(0, 1)}</span>
              <span className="mpb-name">{r.m.name}</span>
              <span className="mpb-count">{r.ps.length} 项</span>
            </div>
            <div className="mpb-projects">
              {r.ps.length === 0
                ? <span className="mpb-none">暂无参与项目</span>
                : r.ps.map((p) => {
                    const c = projectColors[p.id] || PROJECT_PALETTE[0]
                    return (
                      <button
                        key={p.id}
                        className="mpb-chip"
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
      <p className="mpb-note">口径：排除已取消项目；多人协作项目计入每位参与设计师。</p>
    </div>
  )
}

export function DashboardView({ onOpenProject, onNavigate }) {
  const { state } = useStore()
  const { projects, members } = state
  const today = todayStr()
  const ym = monthNow()
  const stats = useMemo(() => getMonthlyStats(projects, ym, today), [projects, ym, today])
  const alerts = useMemo(() => getAlerts(state, today), [state, today])
  const projectColors = useMemo(() => buildProjectColors(projects), [projects])
  const [detail, setDetail] = useState(null)

  const active = projects.filter(isActive)

  const inMonth = stats.inMonthProjects

  // 已落地项目 = 已成交，且项目已结束（状态为「已完成」，或结束/实际完成日期已到）；排除已取消
  const isFinished = (p) => {
    const finish = p.actualCompleteDate || p.endDate
    return p.status === '已完成' || (!!finish && finish <= today)
  }
  const dealDone = projects.filter((p) => p.dealStatus === '已成交' && p.status !== '已取消')
  const landed = dealDone.filter(isFinished)

  const projectColumns = [
    { title: '项目名称', key: 'name', render: (p) => <b>{p.name}</b> },
    { title: '类型', render: (p) => <Badge color={p.type === 'direct' ? 'green' : 'purple'} dot={false}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge> },
    { title: '进度', key: 'progress', render: (p) => <ProgressBar value={p.progress} /> },
    { title: '负责人', render: (p) => roleDisplayName(p, 'lead', members) },
    { title: '开始', key: 'startDate' },
    { title: '结束', key: 'endDate', render: (p) => <span className={isOverdue(p, today) ? 'text-danger' : isDueSoon(p, today) ? 'text-amber' : ''}>{p.endDate || '—'}</span> },
  ]

  // 每个核心指标对应的项目清单与统计口径，点击卡片后在弹窗中展示
  const detailBaseCols = [
    { title: '项目名称', key: 'name', render: (p) => <b>{p.name}</b> },
    { title: '类型', render: (p) => <Badge color={p.type === 'direct' ? 'green' : 'purple'} dot={false}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge> },
    { title: '状态', render: (p) => <StatusBadge status={p.status} /> },
    { title: '周期', render: (p) => `${p.startDate || '—'} ~ ${p.endDate || '—'}` },
    { title: '负责人', render: (p) => roleDisplayName(p, 'lead', members) },
    { title: '设计师', render: (p) => roleDisplayName(p, 'designer', members) },
  ]

  const detailDefs = {
    total: {
      label: '本月项目总数', value: stats.total,
      scope: `${ym} 内周期与本月有交集的项目（开始不晚于月末、结束不早于月初）`,
      rows: inMonth, cols: [],
    },
    direct: {
      label: '直接成交项目', value: stats.directCount,
      scope: '本月项目中类型为「直接成交」的项目',
      rows: inMonth.filter((p) => p.type === 'direct'),
      cols: [
        { title: '成交状态', render: (p) => p.dealStatus || '—' },
        { title: '成交金额', render: (p) => (p.dealStatus === '已成交' ? formatMoney(p.dealAmount) : '—') },
      ],
    },
    pitch: {
      label: '比稿项目', value: stats.pitchCount,
      scope: '本月项目中类型为「比稿」的项目',
      rows: inMonth.filter((p) => p.type === 'pitch'),
      cols: [{ title: '比稿结果', render: (p) => p.pitchResult || '比稿进行中' }],
    },
    landed: {
      label: '已落地项目', value: landed.length,
      scope: '成交状态为「已成交」且项目已结束（状态为已完成，或结束/实际完成日期已到）的项目，排除已取消',
      rows: landed,
      cols: [
        { title: '成交状态', render: () => <Badge color="green" dot={false}>已成交</Badge> },
        { title: '完结日期', render: (p) => p.actualCompleteDate || p.endDate || '—' },
      ],
    },
  }
  const def = detail ? detailDefs[detail] : null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>首页</h1>
          <p>{ym} · 数据自动来自统一项目数据库 · 最后更新 {today}</p>
        </div>
        <div className="head-actions">
          <Badge color={alerts.some((a) => a.level === 'danger') ? 'red' : alerts.length ? 'amber' : 'green'}>
            预警 {alerts.length} 条
          </Badge>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="onboarding">
          <div className="onboarding-icon">🌱</div>
          <div>
            <h3>素来有调已就绪，等待录入项目数据</h3>
            <p>6 位成员档案已建立（刘琼、冯嘉灵、曾少练、刘佳胜、李福文、杨贵玲，固定岗位均为设计师）。所有统计模块已连接统一数据库，录入项目后将自动生成。请勿虚构项目或金额数据。</p>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('projects')}>前往录入项目</button>
        </div>
      )}

      <SectionTitle hint="刘琼的本周日历与今日任务、团队待办 · 数据自动来自项目排期">今日聚焦</SectionTitle>
      <HomeWeekCalendar projects={projects} members={members} projectColors={projectColors} today={today} onOpenProject={onOpenProject} onNavigate={onNavigate} />
      <div className="home-focus">
        <HomeTodayTasks projects={projects} members={members} today={today} onOpenProject={onOpenProject} onNavigate={onNavigate} />
        <TodoCard />
      </div>

      <SectionTitle hint="点击卡片查看明细项目 →">第一层 · 经营核心数据</SectionTitle>
      <div className="grid-4">
        <StatCard label="本月项目总数" value={stats.total} tone="blue" hint={`新增 ${stats.newCount} · 结束 ${stats.endedCount}`} onClick={() => setDetail('total')} />
        <StatCard label="直接成交项目" value={stats.directCount} tone="green" hint={`占比 ${stats.directRatio}%`} onClick={() => setDetail('direct')} />
        <StatCard label="比稿项目" value={stats.pitchCount} tone="pink" hint={`占比 ${stats.pitchRatio}%`} onClick={() => setDetail('pitch')} />
        <StatCard label="已落地项目" value={landed.length} tone="amber" hint={`已成交 ${dealDone.length} 个 · 已完结 ${landed.length} 个`} onClick={() => setDetail('landed')} />
      </div>

      <SectionTitle>第二层 · 项目情况</SectionTitle>
      <Card
        title={`当前项目列表 · ${active.length} 个`}
        extra={<button className="btn btn-ghost btn-sm" onClick={() => onNavigate('projects')}>查看全部 →</button>}
      >
        <DataTable
          compact
          columns={projectColumns}
          rows={active.slice(0, 8).map((p) => ({ ...p, _key: p.id }))}
          onRowClick={(p) => onOpenProject(p.id)}
          emptyText="暂无进行中的项目"
        />
      </Card>

      <Card
        title="成员项目统计"
        subtitle="按设计师列出各自参与的项目 · 点击项目名可查看详情"
        extra={<button className="btn btn-ghost btn-sm" onClick={() => onNavigate('memberStats')}>查看全部 →</button>}
      >
        <MemberProjectBrief projects={projects} members={members} onOpenProject={onOpenProject} projectColors={projectColors} />
      </Card>

      {def && (
        <Modal
          title={`${def.label} · ${def.value}`}
          subtitle={def.scope}
          width="1040px"
          onClose={() => setDetail(null)}
          footer={<button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>关闭</button>}
        >
          <div className="kpi-detail-note">
            {def.rows.length ? `共 ${def.rows.length} 个项目 · 点击任意一行可打开项目详情` : '该指标下暂无项目'}
          </div>
          <DataTable
            compact
            columns={[...detailBaseCols, ...def.cols]}
            rows={def.rows.map((p) => ({ ...p, _key: p.id }))}
            onRowClick={(p) => { setDetail(null); onOpenProject(p.id) }}
            emptyText="该指标下暂无项目"
          />
        </Modal>
      )}
    </div>
  )
}
