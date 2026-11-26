import React, { useMemo, useState } from 'react'
import {
  useStore, getMemberStats, getWorkloadDetails,
  daysUntil, isActive, isOverdue, isDueSoon, todayStr,
  MEMBER_STATUS, formatMoney
} from '../store.js'
import {
  Card, StatCard, SectionTitle, Badge, ProgressBar, LoadBar, EmptyState,
  Field, Input, Select, Textarea, Modal, DataTable, FilterBar, FilterItem
} from '../components.jsx'

export function MembersView({ onOpenMember }) {
  const { state, updateMember } = useStore()
  const { members, projects, leaders, planners, executors } = state
  const [editing, setEditing] = useState(null)

  const stats = useMemo(
    () => members.map((m) => ({ member: m, ...getMemberStats(m, projects) })),
    [members, projects]
  )

  const configured = members.filter((m) => m.role !== '待配置').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>团队成员</h1>
          <p>6 位固定成员档案 · 固定岗位由管理者配置，系统不会自动修改或分配岗位</p>
        </div>
        <div className="head-actions">
          <Badge color={configured === 6 ? 'green' : 'amber'}>
            岗位已配置 {configured}/6
          </Badge>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="成员总数" value={members.length} tone="blue" />
        <StatCard label="已配置岗位" value={configured} tone="green" />
        <StatCard label="在岗成员" value={members.filter((m) => m.status === '在岗').length} tone="cyan" />
        <StatCard label="工作超载成员" value={stats.filter((s) => s.workloadLevel === '超载').length} tone="red" />
      </div>

      <Card
        title="成员档案"
        subtitle="点击成员卡片查看个人工作页面，点击编辑填写固定岗位与职责"
        extra={<span className="muted">工作负荷：4 个标准项目单位 = 100%（综合优先级 / 任务数 / 工时）</span>}
      >
        <div className="member-grid">
          {stats.map((s) => (
            <div className="member-card" key={s.member.id}>
              <div className="member-card-top">
                <div className="avatar">{s.member.name.slice(-1)}</div>
                <div className="member-ident">
                  <h3>{s.member.name}</h3>
                  <span className="muted">
                    {s.member.role === '待配置' ? (
                      <Badge color="amber">固定岗位待配置</Badge>
                    ) : (
                      <Badge color="blue">{s.member.role}</Badge>
                    )}
                  </span>
                </div>
                <Badge color={s.member.status === '在岗' ? 'green' : s.member.status === '休假' ? 'amber' : 'gray'}>
                  {s.member.status}
                </Badge>
              </div>

              <div className="member-metrics">
                <div><span>参与项目</span><b>{s.participating}</b></div>
                <div><span>负责项目</span><b>{s.leading}</b></div>
                <div><span>已完成</span><b>{s.completed}</b></div>
                <div><span>30天内到期</span><b>{s.dueSoon}</b></div>
              </div>

              <div className="member-load">
                <div className="row-between">
                  <span className="muted">工作负荷 · 预计投入 {s.estimatedHours}h</span>
                  <Badge color={s.workloadLevel === '超载' ? 'red' : s.workloadLevel === '繁忙' ? 'amber' : s.workloadLevel === '适中' ? 'blue' : 'gray'}>
                    {s.workloadLevel}
                  </Badge>
                </div>
                <LoadBar percent={s.workload} />
              </div>

              {s.member.note && <p className="member-note">备注：{s.member.note}</p>}

              <div className="member-card-foot">
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenMember(s.member.id)}>查看工作页</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(s.member)}>编辑档案</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="独立工种名录" subtitle="负责人 / 策划 / 执行仅记录姓名，不纳入 6 位成员档案、工作负荷或任何统计 · 可在「数据管理」中编辑">
        <div className="roster-groups">
          {[
            { label: '负责人', tag: '负', list: leaders },
            { label: '策划', tag: '策', list: planners },
            { label: '执行', tag: '执', list: executors },
          ].map((group) => (
            <div className="roster-group" key={group.label}>
              <h4>{group.label} · {group.list.length} 人</h4>
              <div className="planner-roster">
                {group.list.map((n, i) => (
                  <div className="planner-chip" key={`${group.label}-${n}-${i}`}>
                    <span className="planner-avatar">{group.tag}</span>
                    <span>{n}</span>
                  </div>
                ))}
                {group.list.length === 0 && <span className="muted">暂未录入</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {editing && (
        <MemberEditModal
          member={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { updateMember(editing.id, patch); setEditing(null) }}
        />
      )}
    </div>
  )
}

function MemberEditModal({ member, onClose, onSave }) {
  const [form, setForm] = useState({ ...member })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal
      title={`编辑成员档案 · ${member.name}`}
      subtitle="固定岗位仅可由管理者手动填写，系统不会自动修改"
      width="560px"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>保存</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="成员姓名" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="请输入姓名" />
        </Field>
        <Field label="固定岗位" hint="请填写实际岗位，例如：设计师 / 策划 / 执行">
          <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="待配置" />
        </Field>
        <Field label="当前状态">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)} options={MEMBER_STATUS} />
        </Field>
        <Field label="岗位职责" wide>
          <Textarea value={form.duties} onChange={(e) => set('duties', e.target.value)} placeholder="描述该岗位的主要职责" />
        </Field>
        <Field label="个人备注" wide>
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="其他需要记录的信息" />
        </Field>
      </div>
    </Modal>
  )
}

/* ============ 成员个人工作页面 ============ */

export function MemberDetailView({ memberId, onBack }) {
  const { state } = useStore()
  const { members, projects } = state
  const member = members.find((m) => m.id === memberId)
  const [filter, setFilter] = useState('all')

  const stats = useMemo(() => member ? getMemberStats(member, projects) : null, [member, projects])
  if (!member || !stats) return <div className="page"><EmptyState text="未找到该成员" action={<button className="btn btn-primary" onClick={onBack}>返回</button>} /></div>

  const today = todayStr()
  const active = stats.allProjects.filter(isActive)
  const within = (days) => active.filter((p) => p.endDate && daysUntil(p.endDate, today) >= 0 && daysUntil(p.endDate, today) <= days)
  const filtered = filter === 'all' ? stats.allProjects : filter === 'active' ? active : filter === 'completed' ? stats.allProjects.filter((p) => p.status === '已完成') : filter === 'd7' ? within(7) : within(30)

  const columns = [
    { title: '项目名称', key: 'name', sortable: true, render: (p) => <b>{p.name}</b> },
    { title: '承担角色', render: () => (
      <div className="role-tags"><span className="role-tag lead">设计师</span></div>
    ) },
    { title: '项目状态', render: (p) => <Badge color={p.status === '已完成' ? 'green' : p.status === '进行中' ? 'blue' : 'gray'}>{p.status}</Badge> },
    { title: '进度', key: 'progress', sortable: true, render: (p) => <ProgressBar value={p.progress} /> },
    { title: '开始日期', key: 'startDate', sortable: true },
    { title: '结束日期', key: 'endDate', sortable: true, render: (p) => (
      <span className={isOverdue(p, today) ? 'text-danger' : isDueSoon(p, today) ? 'text-amber' : ''}>
        {p.endDate}{isOverdue(p, today) ? ' 逾期' : ''}
      </span>
    ) },
    { title: '优先级', render: (p) => <Badge color={p.priority === '高' ? 'red' : p.priority === '中' ? 'amber' : 'gray'}>{p.priority}</Badge> },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>← 返回团队列表</button>
          <h1>{member.name} · 个人工作页</h1>
          <p>固定岗位：{member.role} · 状态：{member.status}{member.duties ? ` · 职责：${member.duties}` : ''}</p>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="参与项目" value={stats.participating} tone="blue" />
        <StatCard label="负责项目" value={stats.leading} tone="purple" />
        <StatCard label="已完成项目" value={stats.completed} tone="green" />
        <StatCard label="逾期项目" value={stats.overdue} tone={stats.overdue ? 'red' : 'gray'} />
      </div>

      <div className="two-col">
        <Card title="工作负荷分析" subtitle="综合优先级、任务数量与预计投入时间">
          <div className="load-detail">
            <div className="row-between"><span>负荷指数</span><b>{stats.workload}% · {stats.workloadLevel}</b></div>
            <LoadBar percent={stats.workload} />
            <div className="row-between mt"><span>预计投入工时（进行中项目人均分摊）</span><b>{stats.estimatedHours} 小时</b></div>
            <div className="row-between mt"><span>进行中项目数</span><b>{stats.activeProjects.length}</b></div>
            <p className="muted mt">计算规则：Σ（优先级权重 × 人均工时/40 ×（1+任务数/20）× 角色权重），4 个标准单位视为满负荷。</p>
          </div>
        </Card>
        <Card title="交付提醒">
          <div className="reminder-list">
            <div className="reminder-item"><span>未来 7 天交付</span><b className="text-amber">{within(7).length} 个</b></div>
            <div className="reminder-item"><span>未来 30 天交付</span><b>{within(30).length} 个</b></div>
            <div className="reminder-item"><span>当前待完成项目</span><b>{active.length} 个</b></div>
            {member.note && <div className="member-note">个人备注：{member.note}</div>}
          </div>
        </Card>
      </div>

      <Card
        title={`项目清单 · ${filtered.length} 个`}
        extra={
          <FilterBar>
            <FilterItem label="范围">
              <Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[
                { value: 'all', label: '全部项目' },
                { value: 'active', label: '进行中项目' },
                { value: 'completed', label: '已完成项目' },
                { value: 'd7', label: '未来7天交付' },
                { value: 'd30', label: '未来30天交付' },
              ]} />
            </FilterItem>
          </FilterBar>
        }
      >
        <DataTable columns={columns} rows={filtered.map((p) => ({ ...p, _key: p.id }))} emptyText="该范围内暂无项目" />
      </Card>
    </div>
  )
}
