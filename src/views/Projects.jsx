import React, { useMemo, useState, useEffect } from 'react'
import {
  useStore, PROJECT_TYPES, PROJECT_STATUS, PRIORITIES, DEAL_STATUS, PAYMENT_STATUS,
  PITCH_RESULTS, ROLE_KEYS, ROLE_LABELS, STATUS_COLORS, getStage,
  isOverdue, isDueSoon, daysUntil, todayStr, monthNow, formatMoney,
  getRoleMismatch, getMissingRoles, roleDisplayName, exportCSV, getDesignerIds
} from '../store.js'
import {
  Card, Badge, StatusBadge, PriorityBadge, ProgressBar, EmptyState, Field, Input,
  Select, Textarea, Modal, ConfirmDialog, DataTable, FilterBar, FilterItem, SectionTitle
} from '../components.jsx'

/* ============ 图形化视图：项目专属色（与排期日历一致） ============ */
const PROJECT_PALETTE = [
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

function buildProjectColors(projects) {
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

function RingProgress({ value, color = '#4a90e2', size = 72 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const dash = (v / 100) * c
  return (
    <div className="ring-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2edf8" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-label"><b>{v}</b><small>%</small></div>
    </div>
  )
}

function PersonAvatar({ name, tone = 'blue' }) {
  const text = name && name !== '待分配' ? String(name).slice(-2) : '?'
  return <span className={`person-avatar tone-${tone}`}>{text}</span>
}

function ProjectCard({ project: p, color, members, onOpen }) {
  const designers = getDesignerIds(p).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean)
  const leadName = roleDisplayName(p, 'lead', members)
  const overdue = isOverdue(p)
  const soon = isDueSoon(p)
  const days = p.endDate ? daysUntil(p.endDate) : null
  const progress = Math.max(0, Math.min(100, Number(p.progress) || 0))
  return (
    <div className="project-card" style={{ '--pc': color.bar, '--pc-bg': color.bg, '--pc-fg': color.fg }} onClick={() => onOpen(p.id)}>
      <div className="pc-head">
        <RingProgress value={progress} color={color.bar} />
        <div className="pc-ident">
          <h3 title={p.name}>{p.name}</h3>
          <div className="pc-meta"><span className="mono">{p.id}</span>{p.client && <span>· {p.client}</span>}</div>
          <div className="pc-tags">
            <Badge color={p.type === 'direct' ? 'green' : 'purple'} dot={false}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge>
            <StatusBadge status={p.status} />
            {p.priority === '高' && <Badge color="red" dot={false}>高优先级</Badge>}
          </div>
        </div>
      </div>
      <div className="pc-stage">{getStage(progress)} · 进度 {progress}%</div>
      <div className="pc-timeline">
        <div className="pc-dates"><span>{p.startDate || '—'}</span><span>{p.endDate || '—'}</span></div>
        <div className="pc-track"><i style={{ width: `${progress}%`, background: color.bar }} /></div>
        {overdue && <div className="pc-warning danger">已逾期 {Math.abs(days)} 天</div>}
        {soon && !overdue && <div className="pc-warning warn">{days} 天后到期</div>}
      </div>
      <div className="pc-people">
        <div className="pc-person">
          <PersonAvatar name={leadName} tone="blue" />
          <span className="pc-role">负责人</span><b>{leadName}</b>
        </div>
        <div className="pc-person">
          <span className="pc-avatars">
            {designers.length ? designers.map((n) => <PersonAvatar key={n} name={n} tone="purple" />) : <PersonAvatar name="待分配" tone="gray" />}
          </span>
          <span className="pc-role">设计师</span><b>{designers.length ? designers.join('、') : '待分配'}</b>
        </div>
      </div>
      <div className="pc-foot">
        <span className="pc-open">查看详情 →</span>
      </div>
    </div>
  )
}

function emptyProject(id) {
  return {
    id,
    name: '', client: '', type: 'direct',
    startDate: todayStr(), endDate: '', createdDate: todayStr(),
    status: '未开始', priority: '中', progress: 0,
    requirement: '', note: '',
    lead: '', designerIds: [], designer: '', planner: '', executor: '', crossRoleApproved: false,
    budget: 0, quote: 0, dealAmount: 0, dealDate: '', dealStatus: '待确认',
    paymentStatus: '未回款', paidAmount: 0,
    pitchResult: '比稿进行中',
    nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否',
    estimatedHours: 40, taskCount: 0,
  }
}

export function ProjectsView({ onOpenProject, initialEditId, onEditHandled }) {
  const { state, generateProjectId, addProject, updateProject, deleteProject } = useStore()
  const { projects, members, leaders, planners, executors } = state
  const [filters, setFilters] = useState({ month: '', type: '', lead: '', designer: '', planner: '', executor: '', status: '' })
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const [viewMode, setViewMode] = useState('graph')
  const [sortBy, setSortBy] = useState('endDate')

  useEffect(() => {
    if (initialEditId) {
      const target = projects.find((p) => p.id === initialEditId)
      if (target) {
        const clean = { ...target }
        delete clean._isNew
        delete clean._key
        setEditing(clean)
      }
      onEditHandled?.()
    }
  }, [initialEditId])

  // 设计师：仅从固定岗位为设计师的 6 位成员中选择（记录数据，计入统计）
  const designerMembers = useMemo(() => members.filter((m) => m.role === '设计师'), [members])
  const designerFilterOptions = useMemo(() => [
    { value: '', label: '全部' },
    ...designerMembers.map((m) => ({ value: m.id, label: m.name })),
  ], [designerMembers])
  // 负责人 / 策划 / 执行：各自独立人名名录，仅显示人名不记录数据
  const nameFilterOptions = (list) => [{ value: '', label: '全部' }, ...list.map((n) => ({ value: n, label: n }))]

  const filtered = useMemo(() => projects.filter((p) => {
    if (filters.month) {
      const ym = filters.month
      const [y, m] = ym.split('-').map(Number)
      const last = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
      if (!p.startDate || !p.endDate || p.startDate > last || p.endDate < `${ym}-01`) return false
    }
    if (filters.type && p.type !== filters.type) return false
    if (filters.status && p.status !== filters.status) return false
    if (filters.lead && p.lead !== filters.lead) return false
    if (filters.designer && !getDesignerIds(p).includes(filters.designer)) return false
    if (filters.planner && p.planner !== filters.planner) return false
    if (filters.executor && p.executor !== filters.executor) return false
    return true
  }), [projects, filters])

  const projectColors = useMemo(() => buildProjectColors(projects), [projects])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'progress') return (Number(b.progress) || 0) - (Number(a.progress) || 0)
    if (sortBy === 'amount') return (Number(b.dealAmount) || 0) - (Number(a.dealAmount) || 0)
    if (sortBy === 'startDate') return String(a.startDate || '').localeCompare(String(b.startDate || ''))
    if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
    return String(b.endDate || '').localeCompare(String(a.endDate || ''))
  }), [filtered, sortBy])

  // 状态分布数据：用于图形化概览
  const statusStats = useMemo(() => PROJECT_STATUS.map((s) => ({
    label: s,
    value: filtered.filter((p) => p.status === s).length,
    color: { '未开始': '#9fb0c4', '进行中': '#4a90e2', '待审核': '#eda75f', '已完成': '#5fb87e', '已暂停': '#eda75f', '已取消': '#e27593' }[s],
  })).filter((x) => x.value > 0), [filtered])

  const columns = [
    { title: '编号', key: 'id', sortable: true, render: (p) => <span className="mono">{p.id}</span> },
    { title: '项目名称', key: 'name', sortable: true, render: (p) => <b>{p.name}</b> },
    { title: '类型', render: (p) => <Badge color={p.type === 'direct' ? 'green' : 'purple'}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge> },
    { title: '负责人', render: (p) => roleDisplayName(p, 'lead', members) },
    { title: '开始', key: 'startDate', sortable: true },
    { title: '结束', key: 'endDate', sortable: true, render: (p) => <span className={isOverdue(p) ? 'text-danger' : isDueSoon(p) ? 'text-amber' : ''}>{p.endDate || '—'}</span> },
    { title: '状态', render: (p) => <StatusBadge status={p.status} /> },
    { title: '进度', key: 'progress', sortable: true, render: (p) => <ProgressBar value={p.progress} /> },
    { title: '成交金额', key: 'dealAmount', sortable: true, render: (p) => p.dealStatus === '已成交' ? formatMoney(p.dealAmount) : <span className="muted">—</span> },
  ]

  const handleCreate = () => {
    const id = generateProjectId()
    setEditing({ ...emptyProject(id), _isNew: true })
    setCreating(true)
  }

  const handleSave = (project, isNew) => {
    // 剥离表单内部标记，避免 _isNew 等被写入项目数据，导致后续编辑被误判为新增
    const clean = { ...project }
    delete clean._isNew
    delete clean._key
    if (isNew) {
      const res = addProject(clean)
      if (res?.error) { setToast(res.error); return }
      setToast(`项目 ${project.id} 已创建`)
    } else {
      updateProject(clean.id, clean)
      setToast(`项目 ${project.id} 已更新`)
    }
    setEditing(null)
    setCreating(false)
  }

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      项目编号: p.id, 项目名称: p.name, 客户名称: p.client,
      项目类型: p.type === 'direct' ? '直接成交项目' : '比稿项目',
      项目负责人: roleDisplayName(p, 'lead', members),
      设计师: roleDisplayName(p, 'designer', members),
      策划: roleDisplayName(p, 'planner', members),
      执行: roleDisplayName(p, 'executor', members),
      开始日期: p.startDate, 结束日期: p.endDate, 状态: p.status,
      进度: `${p.progress}%`, 成交状态: p.dealStatus,
      实际成交金额: p.dealStatus === '已成交' ? p.dealAmount : 0,
      成交日期: p.dealDate, 比稿结果: p.type === 'pitch' ? p.pitchResult : '',
    }))
    exportCSV(rows, `项目明细_${todayStr()}.csv`)
  }

  return (
    <div className="page">
      {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
      <div className="page-head">
        <div>
          <h1>项目管理</h1>
          <p>统一项目数据库 · 所有统计由项目数据自动计算 · 当前共 {projects.length} 个项目</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline" onClick={handleExport}>导出 CSV</button>
          <button className="btn btn-primary" onClick={handleCreate}>+ 新增项目</button>
        </div>
      </div>

      <div className="overview-strip">
        <div className="overview-item">
          <span>筛选结果</span>
          <b>{filtered.length}</b>
          <small>个项目</small>
        </div>
        <div className="overview-item overview-status">
          <span>状态分布</span>
          <div className="status-bars">
            {statusStats.length === 0 && <em className="muted">暂无数据</em>}
            {statusStats.map((s) => (
              <div className="status-seg" key={s.label} title={`${s.label} ${s.value} 个`} style={{ flex: s.value, background: s.color }}>
                <span>{s.label} {s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="overview-item">
          <span>平均进度</span>
          <b>{filtered.length ? Math.round(filtered.reduce((s, p) => s + (Number(p.progress) || 0), 0) / filtered.length) : 0}%</b>
          <small>按项目进度</small>
        </div>
        <div className="overview-item">
          <span>已成交金额</span>
          <b className="money">{formatMoney(filtered.filter((p) => p.dealStatus === '已成交').reduce((s, p) => s + (Number(p.dealAmount) || 0), 0))}</b>
          <small>按实际成交</small>
        </div>
      </div>

      <Card
        title="项目列表"
        subtitle="图形卡片直观呈现项目进度、人员与周期；点击卡片可查看详情与更新进度"
        extra={
          <FilterBar>
            <FilterItem label="月份"><Input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></FilterItem>
            <FilterItem label="类型"><Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={[{ value: '', label: '全部' }, ...PROJECT_TYPES]} /></FilterItem>
            <FilterItem label="状态"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[{ value: '', label: '全部' }, ...PROJECT_STATUS]} /></FilterItem>
            <FilterItem label="负责人"><Select value={filters.lead} onChange={(e) => setFilters({ ...filters, lead: e.target.value })} options={nameFilterOptions(leaders)} /></FilterItem>
            <FilterItem label="设计师"><Select value={filters.designer} onChange={(e) => setFilters({ ...filters, designer: e.target.value })} options={designerFilterOptions} /></FilterItem>
            <FilterItem label="策划"><Select value={filters.planner} onChange={(e) => setFilters({ ...filters, planner: e.target.value })} options={nameFilterOptions(planners)} /></FilterItem>
            <FilterItem label="执行"><Select value={filters.executor} onChange={(e) => setFilters({ ...filters, executor: e.target.value })} options={nameFilterOptions(executors)} /></FilterItem>
          </FilterBar>
        }
      >
        <div className="view-toolbar">
          <div className="view-switch" role="tablist" aria-label="视图切换">
            <button className={viewMode === 'graph' ? 'active' : ''} onClick={() => setViewMode('graph')}>🗂️ 图形视图</button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>📋 表格视图</button>
          </div>
          <label className="sort-control">
            <span>排序</span>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} options={[
              { value: 'endDate', label: '结束日期（近→远）' },
              { value: 'startDate', label: '开始日期（早→晚）' },
              { value: 'progress', label: '进度（高→低）' },
              { value: 'amount', label: '成交金额（高→低）' },
              { value: 'name', label: '项目名称' },
            ]} />
          </label>
        </div>
        {viewMode === 'graph' ? (
          sorted.length === 0 ? (
            <EmptyState text="暂无项目。点击右上角「新增项目」录入第一个项目。" />
          ) : (
            <div className="project-card-grid">
              {sorted.map((p) => (
                <ProjectCard key={p.id} project={p} color={projectColors[p.id] || PROJECT_PALETTE[0]} members={members} onOpen={onOpenProject} />
              ))}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            rows={sorted.map((p) => ({ ...p, _key: p.id }))}
            onRowClick={(p) => onOpenProject(p.id)}
            emptyText="暂无项目。点击右上角「新增项目」录入第一个项目。"
          />
        )}
      </Card>

      {editing && (
        <ProjectFormModal
          project={editing}
          isNew={!!editing._isNew}
          members={members}
          leaders={leaders}
          planners={planners}
          executors={executors}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="删除项目"
          message={`确定删除项目「${deleting.name}」（${deleting.id}）吗？此操作不可撤销，相关统计将同步更新。`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => { deleteProject(deleting.id); setDeleting(null); setToast('项目已删除') }}
        />
      )}
    </div>
  )
}

/* ============ 项目表单 ============ */

function ProjectFormModal({ project, isNew, members, leaders, planners, executors, onClose, onSave }) {
  const [form, setForm] = useState({ ...project, designerIds: getDesignerIds(project) })
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // 设计师可多选：仅从固定岗位为设计师的成员中选择，存成员 ID 数组并记录统计
  const designerMembers = members.filter((m) => m.role === '设计师')
  const selectedDesigners = form.designerIds || []
  const toggleDesigner = (id) => {
    const next = selectedDesigners.includes(id)
      ? selectedDesigners.filter((x) => x !== id)
      : [...selectedDesigners, id]
    set('designerIds', next)
  }
  // 其他三类为纯人名名录，仅显示人名
  const renderNameField = (field, roster) => {
    const listId = `roster-${field}`
    return (
      <>
        <Input list={listId} value={form[field] || ''} onChange={(e) => set(field, e.target.value)} placeholder="输入姓名" />
        <datalist id={listId}>{roster.map((n) => <option key={n} value={n} />)}</datalist>
      </>
    )
  }

  const handleTypeChange = (t) => {
    setForm((f) => ({ ...f, type: t, pitchResult: t === 'pitch' ? '比稿进行中' : f.pitchResult }))
  }

  const handlePitchResult = (r) => {
    setForm((f) => ({ ...f, pitchResult: r, dealStatus: r === '已中标' ? '已成交' : f.dealStatus === '已成交' && r !== '已中标' ? '待确认' : f.dealStatus }))
  }

  const save = () => {
    if (!form.name.trim()) { setError('请填写项目名称'); return }
    if (!form.id.trim()) { setError('请填写项目编号'); return }
    if (form.endDate && form.startDate && form.endDate < form.startDate) { setError('结束日期不能早于开始日期'); return }
    if (form.dealStatus === '已成交' && !form.dealDate) { setError('已成交项目必须填写成交日期（用于归属成交月份）'); return }
    if (Number(form.paidAmount) > Number(form.dealAmount || 0)) { setError('已回款金额不能大于实际成交金额'); return }
    setError('')
    const designerIds = form.designerIds || []
    onSave({
      ...form,
      designerIds,
      designer: designerIds[0] || '',
      name: form.name.trim(),
      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
      budget: Number(form.budget) || 0,
      quote: Number(form.quote) || 0,
      dealAmount: Number(form.dealAmount) || 0,
      paidAmount: Number(form.paidAmount) || 0,
      estimatedHours: Number(form.estimatedHours) || 40,
      taskCount: Number(form.taskCount) || 0,
    }, isNew)
  }

  return (
    <Modal
      title={isNew ? '新增项目' : `编辑项目 · ${project.id}`}
      subtitle="项目编号唯一；设计师仅从 6 位成员中选择，负责人/策划/执行按各自名录填写姓名；成交与回款金额分别记录"
      onClose={onClose}
      footer={
        <>
          {error && <span className="form-error">{error}</span>}
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save}>保存项目</button>
        </>
      }
    >
      <SectionTitle>基本信息</SectionTitle>
      <div className="form-grid">
        <Field label="项目编号" required hint="唯一编号，不可重复"><Input value={form.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} /></Field>
        <Field label="项目名称" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="请输入项目名称" /></Field>
        <Field label="客户名称"><Input value={form.client} onChange={(e) => set('client', e.target.value)} /></Field>
        <Field label="项目类型"><Select value={form.type} onChange={(e) => handleTypeChange(e.target.value)} options={PROJECT_TYPES} /></Field>
        <Field label="开始日期"><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="结束日期"><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="创建日期"><Input type="date" value={form.createdDate} onChange={(e) => set('createdDate', e.target.value)} /></Field>
        <Field label="项目状态"><Select value={form.status} onChange={(e) => set('status', e.target.value)} options={PROJECT_STATUS} /></Field>
        <Field label="项目优先级"><Select value={form.priority} onChange={(e) => set('priority', e.target.value)} options={PRIORITIES} /></Field>
        <Field label="完成进度 (%)"><Input type="number" min="0" max="100" value={form.progress} onChange={(e) => set('progress', e.target.value)} /></Field>
        <Field label="需求描述" wide><Textarea value={form.requirement} onChange={(e) => set('requirement', e.target.value)} placeholder="项目需求与交付内容" /></Field>
        <Field label="项目备注" wide><Textarea value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
      </div>

      <SectionTitle>人员分工</SectionTitle>
      <div className="form-grid">
        <Field label="项目负责人" hint="从负责人名录中填写姓名，仅显示人名，不参与成员统计">
          {renderNameField('lead', leaders)}
        </Field>
        <Field label="设计师（可多选）" wide hint="可勾选多位设计师协作；仅从固定岗位为设计师的成员中选择，参与工作负荷与统计">
          <div className="designer-multi">
            {designerMembers.length === 0 && <span className="muted">暂无设计师成员，请先在团队成员中设置岗位</span>}
            {designerMembers.map((m) => (
              <label key={m.id} className={`designer-check ${selectedDesigners.includes(m.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={selectedDesigners.includes(m.id)} onChange={() => toggleDesigner(m.id)} />
                <span>{m.name}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="策划" hint="从策划名录中填写姓名，仅显示人名，不参与成员统计">
          {renderNameField('planner', planners)}
        </Field>
        <Field label="执行" hint="从执行名录中填写姓名，仅显示人名，不参与成员统计">
          {renderNameField('executor', executors)}
        </Field>
        <Field label="跨岗位协作" wide hint="如分配的人员固定岗位与项目角色不一致，需管理者确认后才允许例外">
          <label className="check-line">
            <input type="checkbox" checked={!!form.crossRoleApproved} onChange={(e) => set('crossRoleApproved', e.target.checked)} />
            已确认跨岗位例外分配
          </label>
        </Field>
      </div>

      <SectionTitle>财务信息（人民币）</SectionTitle>
      <div className="form-grid">
        <Field label="项目预算"><Input type="number" min="0" value={form.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
        <Field label="项目报价"><Input type="number" min="0" value={form.quote} onChange={(e) => set('quote', e.target.value)} /></Field>
        <Field label="实际成交金额"><Input type="number" min="0" value={form.dealAmount} onChange={(e) => set('dealAmount', e.target.value)} /></Field>
        <Field label="成交状态"><Select value={form.dealStatus} onChange={(e) => set('dealStatus', e.target.value)} options={DEAL_STATUS} /></Field>
        <Field label="成交日期" hint="按实际成交日期归属成交月份"><Input type="date" value={form.dealDate} onChange={(e) => set('dealDate', e.target.value)} /></Field>
        <Field label="回款状态"><Select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} options={PAYMENT_STATUS} /></Field>
        <Field label="已回款金额"><Input type="number" min="0" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} /></Field>
        <Field label="未回款金额"><Input value={formatMoney(Math.max(0, Number(form.dealAmount) - Number(form.paidAmount)))} disabled /></Field>
      </div>

      {form.type === 'pitch' && (
        <>
          <SectionTitle>比稿信息</SectionTitle>
          <div className="form-grid">
            <Field label="比稿结果" hint="中标后成交状态自动设为已成交，来源仍为比稿项目">
              <Select value={form.pitchResult} onChange={(e) => handlePitchResult(e.target.value)} options={PITCH_RESULTS} />
            </Field>
            <Field label="比稿截止日期" hint="如与项目结束日期一致可留空"><Input type="date" value={form.pitchDeadline || ''} onChange={(e) => set('pitchDeadline', e.target.value)} /></Field>
          </div>
        </>
      )}

      <SectionTitle>进度与工时</SectionTitle>
      <div className="form-grid">
        <Field label="下一步工作"><Input value={form.nextStep} onChange={(e) => set('nextStep', e.target.value)} /></Field>
        <Field label="计划完成时间"><Input type="date" value={form.endDate} disabled /></Field>
        <Field label="实际完成时间"><Input type="date" value={form.actualCompleteDate || ''} onChange={(e) => set('actualCompleteDate', e.target.value)} /></Field>
        <Field label="延期风险"><Select value={form.delayRisk || '否'} onChange={(e) => set('delayRisk', e.target.value)} options={['否', '是']} /></Field>
        <Field label="预计投入工时"><Input type="number" min="0" value={form.estimatedHours} onChange={(e) => set('estimatedHours', e.target.value)} /></Field>
        <Field label="任务数量"><Input type="number" min="0" value={form.taskCount} onChange={(e) => set('taskCount', e.target.value)} /></Field>
        <Field label="当前存在的问题" wide><Textarea value={form.issue} onChange={(e) => set('issue', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/* ============ 项目详情 / 进度管理 ============ */

export function ProjectDetailView({ projectId, onBack, onEdit }) {
  const { state, updateProject, deleteProject } = useStore()
  const { projects, members } = state
  const project = projects.find((p) => p.id === projectId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [quickProgress, setQuickProgress] = useState(project?.progress || 0)

  if (!project) return <div className="page"><EmptyState text="未找到该项目" action={<button className="btn btn-primary" onClick={onBack}>返回</button>} /></div>

  const nameOf = (k) => roleDisplayName(project, k, members)
  const missing = getMissingRoles(project)
  const mismatch = getRoleMismatch(project, members)
  const today = todayStr()

  const quickUpdate = () => {
    const patch = { progress: Math.max(0, Math.min(100, Number(quickProgress) || 0)) }
    if (patch.progress === 100 && !project.actualCompleteDate) patch.actualCompleteDate = today
    updateProject(project.id, patch)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>← 返回项目列表</button>
          <h1>{project.name}</h1>
          <p><span className="mono">{project.id}</span> · {project.client || '未填写客户'} · {project.type === 'direct' ? '直接成交项目' : '比稿项目'}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline" onClick={() => setConfirmDelete(true)}>删除</button>
          <button className="btn btn-primary" onClick={() => onEdit(project.id)}>编辑项目</button>
        </div>
      </div>

      {isOverdue(project, today) && <div className="banner banner-danger">该项目已逾期 {Math.abs(daysUntil(project.endDate, today))} 天，当前进度 {project.progress}%。</div>}
      {isDueSoon(project, today) && !isOverdue(project, today) && <div className="banner banner-warn">项目将在 {daysUntil(project.endDate, today)} 天后到期，请关注交付准备。</div>}
      {missing.length > 0 && <div className="banner banner-danger">缺少角色：{missing.join('、')}。请在编辑项目中补齐人员分工。</div>}
      {mismatch.length > 0 && !project.crossRoleApproved && <div className="banner banner-warn">存在跨岗位分配且未获管理者确认：{mismatch.map((x) => `${x.member}(${x.memberRole})承担${x.role}`).join('；')}</div>}

      <div className="grid-4">
        <Card title="当前进度" pad={false}>
          <div className="detail-stat"><ProgressBar value={project.progress} /></div>
          <div className="detail-stat"><span>当前阶段</span><b>{getStage(project.progress)}</b></div>
        </Card>
        <Card title="时间安排" pad={false}>
          <div className="detail-stat"><span>开始日期</span><b>{project.startDate || '—'}</b></div>
          <div className="detail-stat"><span>计划完成</span><b>{project.endDate || '—'}</b></div>
        </Card>
        <Card title="人员分工" pad={false}>
          {ROLE_KEYS.map((k) => (
            <div className="detail-stat" key={k}><span>{ROLE_LABELS[k]}</span><b>{nameOf(k)}</b></div>
          ))}
        </Card>
        <Card title="财务概览" pad={false}>
          <div className="detail-stat"><span>成交状态</span><b>{project.dealStatus}</b></div>
        </Card>
      </div>

      <div className="two-col">
        <Card title="更新项目进度" subtitle="进度阶段：0% 未开始 · 1-30% 前期准备 · 31-60% 方案设计 · 61-90% 深化与执行 · 91-99% 交付准备 · 100% 已完成">
          <div className="progress-editor">
            <div className="row-between"><span>当前值：{project.progress}%（{getStage(project.progress)}）</span><b>{quickProgress}%</b></div>
            <input type="range" min="0" max="100" value={quickProgress} onChange={(e) => setQuickProgress(Number(e.target.value))} className="range-input" />
            <div className="quick-row">
              <button className="btn btn-outline btn-sm" onClick={() => setQuickProgress(0)}>0% 未开始</button>
              <button className="btn btn-outline btn-sm" onClick={() => setQuickProgress(30)}>30% 前期准备</button>
              <button className="btn btn-outline btn-sm" onClick={() => setQuickProgress(60)}>60% 方案设计</button>
              <button className="btn btn-outline btn-sm" onClick={() => setQuickProgress(90)}>90% 深化执行</button>
              <button className="btn btn-outline btn-sm" onClick={() => setQuickProgress(100)}>100% 已完成</button>
            </div>
            <button className="btn btn-primary" onClick={quickUpdate}>保存进度</button>
          </div>
        </Card>
        <Card title="执行信息">
          <div className="detail-list">
            <div><span>项目负责人</span><b>{nameOf('lead')}</b></div>
            <div><span>状态</span><b>{project.status}</b></div>
          </div>
        </Card>
      </div>

      <Card title="需求与备注">
        <div className="detail-list">
          <div><span>需求描述</span><b>{project.requirement || '未填写'}</b></div>
          <div><span>项目备注</span><b>{project.note || '未填写'}</b></div>
        </div>
      </Card>

      {confirmDelete && (
        <ConfirmDialog
          title="删除项目"
          message={`确定删除项目「${project.name}」吗？此操作不可撤销。`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { deleteProject(project.id); setConfirmDelete(false); onBack() }}
        />
      )}
    </div>
  )
}
