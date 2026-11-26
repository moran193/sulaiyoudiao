import React, { useMemo, useState } from 'react'
import {
  useStore, getMonthlyStats, monthNow, monthBounds, PROJECT_TYPES, PROJECT_STATUS,
  formatMoney, exportCSV, roleDisplayName, getDesignerIds
} from '../store.js'
import {
  Card, StatCard, SectionTitle, Badge, StatusBadge, ProgressBar, EmptyState,
  Field, Input, Select, DataTable, FilterBar, FilterItem, BarChart, HBarList
} from '../components.jsx'

export function MonthlyView() {
  const { state } = useStore()
  const { projects, members, leaders, planners, executors } = state
  const [ym, setYm] = useState(monthNow())
  const [filters, setFilters] = useState({ type: '', lead: '', designer: '', planner: '', executor: '', status: '' })
  const stats = useMemo(() => getMonthlyStats(projects, ym), [projects, ym])

  const nameOf = (p, k) => roleDisplayName(p, k, members)
  const listOptions = (list) => [{ value: '', label: '全部' }, ...list.map((n) => ({ value: n, label: n }))]

  const filteredDetail = useMemo(() => stats.inMonthProjects.filter((p) => {
    if (filters.type && p.type !== filters.type) return false
    if (filters.status && p.status !== filters.status) return false
    if (filters.lead && p.lead !== filters.lead) return false
    if (filters.designer && !getDesignerIds(p).includes(filters.designer)) return false
    if (filters.planner && p.planner !== filters.planner) return false
    if (filters.executor && p.executor !== filters.executor) return false
    return true
  }), [stats, filters])

  const designerMembers = members.filter((m) => m.role === '设计师')
  const designerOptions = [{ value: '', label: '全部' }, ...designerMembers.map((m) => ({ value: m.id, label: m.name }))]

  const exportDetail = () => {
    exportCSV(filteredDetail.map((p) => ({
      项目编号: p.id, 项目名称: p.name,
      项目类型: p.type === 'direct' ? '直接成交项目' : '比稿项目',
      项目负责人: nameOf(p, 'lead'), 设计师: nameOf(p, 'designer'), 策划: nameOf(p, 'planner'), 执行: nameOf(p, 'executor'),
      开始日期: p.startDate, 结束日期: p.endDate, 状态: p.status, 完成进度: `${p.progress}%`,
      实际成交金额: p.dealStatus === '已成交' ? p.dealAmount : 0,
    })), `月度项目明细_${ym}.csv`)
  }

  const detailColumns = [
    { title: '编号', key: 'id', sortable: true, render: (p) => <span className="mono">{p.id}</span> },
    { title: '项目名称', key: 'name', sortable: true, render: (p) => <b>{p.name}</b> },
    { title: '类型', render: (p) => <Badge color={p.type === 'direct' ? 'green' : 'purple'}>{p.type === 'direct' ? '直接成交' : '比稿'}</Badge> },
    { title: '负责人', render: (p) => nameOf(p, 'lead') },
    { title: '设计师', render: (p) => nameOf(p, 'designer') },
    { title: '策划', render: (p) => nameOf(p, 'planner') },
    { title: '执行', render: (p) => nameOf(p, 'executor') },
    { title: '开始日期', key: 'startDate', sortable: true },
    { title: '结束日期', key: 'endDate', sortable: true },
    { title: '状态', render: (p) => <StatusBadge status={p.status} /> },
    { title: '进度', key: 'progress', sortable: true, render: (p) => <ProgressBar value={p.progress} /> },
    { title: '实际成交金额', key: 'dealAmount', sortable: true, render: (p) => p.dealStatus === '已成交' ? formatMoney(p.dealAmount) : '—' },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>月度经营统计</h1>
          <p>所有指标由统一项目数据库自动计算 · 项目按编号唯一计入 · 成交金额按成交日期归属月份</p>
        </div>
        <div className="head-actions">
          <Field label="选择月份">
            <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          </Field>
        </div>
      </div>

      <SectionTitle hint={`统计月份 ${ym} · 自然月 ${monthBounds(ym).first} 至 ${monthBounds(ym).last}`}>{ym} 月度总览</SectionTitle>
      <div className="grid-4">
        <StatCard label="本月项目总数" value={stats.total} tone="blue" hint="开始≤月末 且 结束≥月初" />
        <StatCard label="本月新增" value={stats.newCount} tone="cyan" hint="按项目创建日期" />
        <StatCard label="本月结束" value={stats.endedCount} tone="purple" hint="按项目结束日期" />
        <StatCard label="本月进行中" value={stats.inProgress} tone="blue" />
        <StatCard label="本月已完成" value={stats.completed} tone="green" />
        <StatCard label="本月逾期" value={stats.overdue} tone={stats.overdue ? 'red' : 'gray'} />
      </div>

      <div className="two-col mt">
        <Card title="项目类型统计" subtitle="来源与成交结果分开记录，避免统计错误">
          <div className="type-stats">
            <div className="type-row"><span>直接成交项目</span><b>{stats.directCount}</b><em>{stats.directRatio}%</em></div>
            <div className="type-row"><span>比稿项目</span><b>{stats.pitchCount}</b><em>{stats.pitchRatio}%</em></div>
            <div className="type-row"><span>比稿中标</span><b className="text-green">{stats.pitchWon}</b></div>
            <div className="type-row"><span>比稿未中标</span><b>{stats.pitchLost}</b></div>
            <div className="type-row"><span>比稿进行中</span><b>{stats.pitchRunning}</b></div>
            <div className="type-row"><span>比稿已放弃</span><b>{stats.pitchAbandoned}</b></div>
            <div className="type-row highlight"><span>比稿中标率</span><b>{stats.winRate}%</b><em>已中标 ÷ 有结果比稿</em></div>
          </div>
          <p className="muted mt">仍在进行中的比稿不计入中标率分母。</p>
        </Card>
        <Card title="成交金额统计" subtitle="已成交项目按实际成交日期计入，未成交项目不计入">
          <div className="money-grid">
            <div><span>本月实际成交金额</span><b className="big-money">{formatMoney(stats.dealTotal)}</b></div>
            <div><span>直接成交项目金额</span><b>{formatMoney(stats.directDealTotal)}</b></div>
            <div><span>比稿中标项目金额</span><b>{formatMoney(stats.pitchDealTotal)}</b></div>
            <div><span>本月成交项目数量</span><b>{stats.dealCount} 个</b></div>
            <div><span>单个项目平均成交金额</span><b>{formatMoney(stats.avgDeal)}</b></div>
          </div>
        </Card>
      </div>

      <Card title="各项目成交金额明细" subtitle="成交日期归属本月的项目">
        {stats.deals.length === 0 ? <EmptyState text="本月暂无成交项目" /> : (
          <DataTable
            columns={[
              { title: '编号', key: 'id', render: (p) => <span className="mono">{p.id}</span> },
              { title: '项目名称', key: 'name', render: (p) => <b>{p.name}</b> },
              { title: '来源', render: (p) => <Badge color={p.type === 'direct' ? 'green' : 'purple'}>{p.type === 'direct' ? '直接成交' : '比稿中标'}</Badge> },
              { title: '负责人', render: (p) => nameOf(p, 'lead') },
              { title: '成交日期', key: 'dealDate' },
              { title: '成交金额', key: 'dealAmount', render: (p) => <b className="text-green">{formatMoney(p.dealAmount)}</b> },
              { title: '回款', render: (p) => `${formatMoney(p.paidAmount)} / 未回款 ${formatMoney(Math.max(0, p.dealAmount - p.paidAmount))}` },
            ]}
            rows={stats.deals.map((p) => ({ ...p, _key: p.id }))}
          />
        )}
      </Card>

      <Card
        title={`月度项目明细表 · ${filteredDetail.length} 个项目`}
        subtitle="自动更新 · 支持按月、类型、负责人、设计师、策划、执行、状态筛选"
        extra={<button className="btn btn-outline btn-sm" onClick={exportDetail}>导出明细 CSV</button>}
      >
        <FilterBar>
          <FilterItem label="项目类型"><Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={[{ value: '', label: '全部' }, ...PROJECT_TYPES]} /></FilterItem>
          <FilterItem label="状态"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[{ value: '', label: '全部' }, ...PROJECT_STATUS]} /></FilterItem>
          <FilterItem label="负责人"><Select value={filters.lead} onChange={(e) => setFilters({ ...filters, lead: e.target.value })} options={listOptions(leaders)} /></FilterItem>
          <FilterItem label="设计师"><Select value={filters.designer} onChange={(e) => setFilters({ ...filters, designer: e.target.value })} options={designerOptions} /></FilterItem>
          <FilterItem label="策划"><Select value={filters.planner} onChange={(e) => setFilters({ ...filters, planner: e.target.value })} options={listOptions(planners)} /></FilterItem>
          <FilterItem label="执行"><Select value={filters.executor} onChange={(e) => setFilters({ ...filters, executor: e.target.value })} options={listOptions(executors)} /></FilterItem>
        </FilterBar>
        <DataTable columns={detailColumns} rows={filteredDetail.map((p) => ({ ...p, _key: p.id }))} emptyText="本月暂无符合筛选条件的项目" />
      </Card>
    </div>
  )
}
