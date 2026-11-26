import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { fetchCloudState, saveCloudState, isValidState } from './cloud.js'

/* ============================================================
   常量定义
   ============================================================ */

const STORAGE_KEY = 'design-team-workbench-v1'

export const PROJECT_TYPES = [
  { value: 'direct', label: '直接成交项目' },
  { value: 'pitch', label: '比稿项目' },
]

export const PROJECT_STATUS = ['未开始', '进行中', '待审核', '已完成', '已暂停', '已取消']
export const PRIORITIES = ['高', '中', '低']
export const DEAL_STATUS = ['待确认', '已成交', '未成交']
export const PAYMENT_STATUS = ['未回款', '部分回款', '已全部回款']
export const PITCH_RESULTS = ['比稿进行中', '已中标', '未中标', '已放弃']
export const MEMBER_STATUS = ['在岗', '休假', '暂停分配']

export const DEFAULT_PLANNERS = ['陈偲韵', '李舒婷', '余颖']
// 负责人、策划、执行均为独立工种名录：仅记录姓名，不参与成员档案与任何统计
export const DEFAULT_LEADERS = ['肖镇逵', '陈明生', '邢益铭', '林丹雄', '盛玲玲']
export const DEFAULT_EXECUTORS = ['邱文浩', '毛志旭', '林扬濠']

export const ROLE_KEYS = ['lead', 'designer', 'planner', 'executor']
export const ROLE_LABELS = {
  lead: '项目负责人',
  designer: '设计师',
  planner: '策划',
  executor: '执行',
}
// 仅设计师与 6 位成员档案关联并计入统计；负责人/策划/执行为独立工种的人名记录
export const EXPECTED_ROLE = {
  designer: '设计师',
}

export const STATUS_COLORS = {
  '未开始': 'gray',
  '进行中': 'blue',
  '待审核': 'amber',
  '已完成': 'green',
  '已暂停': 'orange',
  '已取消': 'red',
}

/* ============================================================
   日期工具
   ============================================================ */

export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthNow() {
  return todayStr().slice(0, 7)
}

export function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  const first = `${ym}-01`
  const lastDate = new Date(y, m, 0).getDate()
  const last = `${ym}-${String(lastDate).padStart(2, '0')}`
  return { first, last }
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysUntil(dateStr, from = todayStr()) {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(dateStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function formatMoney(n) {
  const v = Number(n) || 0
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(s) {
  return s || '—'
}

/* ============ 加班时长计算 ============ */
// 由「几点到几点」自动算小时数；结束早于开始按跨夜处理（+24h）
export function calcOvertimeHours(start, end) {
  const m = /^(\d{1,2}):(\d{2})$/
  const a = m.exec(String(start || '').trim())
  const b = m.exec(String(end || '').trim())
  if (!a || !b) return 0
  const sh = Number(a[1]), sm = Number(a[2]), eh = Number(b[1]), em = Number(b[2])
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return 0
  let minutes = (eh * 60 + em) - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 100) / 100
}

/* 跨日期时间段计算（加班记录 / 调休登记通用）：
   - 开始、结束各选自己的日期，可跨任意天数；
   - 按自然日拆分逐段累计，每天若时段完整覆盖 12:00–13:00 午休则扣 1 小时，
     因此 9:00–18:00 记 8 小时（符合每日标准工时 8 小时）；
   - 同一天且结束时刻早于开始时刻仍按跨夜处理（兼容旧记录）；
   - 同一天起止时刻相同、或结束日期早于开始日期，视为无效返回 0。 */
export function calcRangeHours(startDate, startTime, endDate, endTime) {
  const t = /^(\d{1,2}):(\d{2})$/
  const a = t.exec(String(startTime || '').trim())
  const b = t.exec(String(endTime || '').trim())
  const ds = String(startDate || '').trim()
  const de = String(endDate || '').trim() || ds
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!a || !b || !dateRe.test(ds) || !dateRe.test(de)) return 0
  const sh = Number(a[1]), sm = Number(a[2]), eh = Number(b[1]), em = Number(b[2])
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return 0
  const startDay = new Date(`${ds}T00:00:00`)
  const endDay = new Date(`${de}T00:00:00`)
  if (Number.isNaN(startDay.getTime()) || Number.isNaN(endDay.getTime())) return 0
  let days = Math.round((endDay - startDay) / 86400000)
  if (days < 0) return 0
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  if (days === 0) {
    if (endMin === startMin) return 0
    if (endMin < startMin) days = 1
  }
  const LUNCH_A = 12 * 60, LUNCH_B = 13 * 60
  let total = 0
  for (let d = 0; d <= days; d += 1) {
    const from = d === 0 ? startMin : 0
    const to = d === days ? endMin : 24 * 60
    if (to <= from) continue
    let mins = to - from
    if (from <= LUNCH_A && to >= LUNCH_B) mins -= 60
    total += mins
  }
  return Math.round((total / 60) * 100) / 100
}

// 小时数显示：整数不带小数，最多两位且去掉末尾 0
export function formatHours(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : String(v).replace(/(\.\d)0$/, '$1')
}

// 按每日 8 小时折算成天数
export function hoursToDays(hours) {
  return Math.round(((Number(hours) || 0) / 8) * 100) / 100
}

/* ============================================================
   项目派生计算
   ============================================================ */

export function getStage(progress) {
  const p = Number(progress) || 0
  if (p === 0) return '未开始'
  if (p <= 30) return '前期准备'
  if (p <= 60) return '方案设计'
  if (p <= 90) return '深化与执行'
  if (p < 100) return '交付准备'
  return '已完成'
}

export function isActive(p) {
  return p.status !== '已完成' && p.status !== '已取消'
}

export function isOverdue(p, today = todayStr()) {
  return isActive(p) && !!p.endDate && p.endDate < today
}

export function isDueSoon(p, today = todayStr(), days = 3) {
  if (!isActive(p) || !p.endDate) return false
  const d = daysUntil(p.endDate, today)
  return d >= 0 && d <= days
}

// 设计师可为多人。统一读取为成员 ID 数组，兼容旧的单例字符串 designer 字段。
export function getDesignerIds(p) {
  if (Array.isArray(p.designerIds)) return [...new Set(p.designerIds.filter((v) => typeof v === 'string' && v))]
  if (Array.isArray(p.designer)) return [...new Set(p.designer.filter((v) => typeof v === 'string' && v))]
  if (typeof p.designer === 'string' && p.designer) return [p.designer]
  return []
}

export function getInvolvedMembers(p) {
  // 仅设计师属于 6 位成员档案并计入负荷统计；负责人/策划/执行为人名记录
  return getDesignerIds(p).filter((id) => /^M\d+$/.test(id))
}

export function memberInProject(p, memberId) {
  // 成员只通过「设计师」角色与项目关联，其他角色不计入成员统计；支持多位设计师
  return getDesignerIds(p).includes(memberId)
}

// 角色显示名：仅设计师存的是成员 ID（解析为姓名，可多人）；
// 负责人/策划/执行均为独立工种人名，原样显示，绝不解析成成员姓名
export function roleDisplayName(p, key, members) {
  if (key === 'designer') {
    const ids = getDesignerIds(p)
    if (ids.length === 0) return '待分配'
    return ids.map((id) => members.find((x) => x.id === id)?.name || id).join('、')
  }
  const v = p[key]
  if (!v) return '待分配'
  return String(v)
}

// 旧数据迁移：早期版本 designer 存的是单个成员 ID 字符串，统一转成 designerIds 数组。
// designer 字段保留为首位设计师以兼容旧引用。
function migrateDesignerArray(projects) {
  return projects.map((p) => {
    if (Array.isArray(p.designerIds)) return p
    const ids = getDesignerIds(p)
    return { ...p, designerIds: ids, designer: ids[0] || '' }
  })
}

// 旧数据迁移：早期版本负责人/策划/执行可能存的是成员 ID（M1-M6），
// 会错误显示为设计师姓名。按成员档案转成纯人名，使其归属对应工种名录。
function migrateRoleNames(projects, members) {
  return projects.map((p) => {
    let changed = false
    const next = { ...p }
    for (const key of ['lead', 'planner', 'executor']) {
      if (typeof p[key] === 'string' && /^M\d+$/.test(p[key])) {
        const m = members.find((x) => x.id === p[key])
        if (m) { next[key] = m.name; changed = true }
        else { next[key] = ''; changed = true }
      }
    }
    return changed ? next : p
  })
}

export function getUnpaidAmount(p) {
  return Math.max(0, (Number(p.dealAmount) || 0) - (Number(p.paidAmount) || 0))
}

/* 工作负荷：综合项目数、优先级、任务数量、预计投入工时
   贡献值 = 优先级权重 × (人均工时/40) × (1+任务数/20) × 角色权重
   4 个标准单位 = 满负荷 100% */
const PRIORITY_WEIGHT = { 高: 1.5, 中: 1.0, 低: 0.6 }
const ROLE_WEIGHT = { lead: 1.1, designer: 1.0, planner: 0.95, executor: 0.9 }
const CAPACITY_UNITS = 4

export function getWorkloadDetails(memberId, projects, today = todayStr()) {
  const active = projects.filter((p) => isActive(p) && memberInProject(p, memberId))
  let score = 0
  let hours = 0
  active.forEach((p) => {
    const involved = getInvolvedMembers(p).length || 1
    const perPersonHours = (Number(p.estimatedHours) || 40) / involved
    // 项目只通过设计师角色关联成员，权重固定取设计师；工时按参与设计师人数均摊
    const roleWeight = ROLE_WEIGHT.designer || 1
    const contribution =
      (PRIORITY_WEIGHT[p.priority] || 1) *
      (perPersonHours / 40) *
      (1 + (Number(p.taskCount) || 0) / 20) *
      roleWeight
    score += contribution
    hours += perPersonHours
  })
  const percent = Math.round((score / CAPACITY_UNITS) * 100)
  let level = '空闲'
  if (percent >= 100) level = '超载'
  else if (percent >= 70) level = '繁忙'
  else if (percent >= 30) level = '适中'
  return { active, score, hours: Math.round(hours), percent, level }
}

export function getMemberStats(member, projects, today = todayStr()) {
  const all = projects.filter((p) => memberInProject(p, member.id))
  const active = all.filter((p) => isActive(p))
  const wl = getWorkloadDetails(member.id, projects, today)
  // 负责人为纯人名记录，按姓名匹配统计「负责项目」，不建立成员 ID 关联
  const leading = projects.filter((p) => isActive(p) && p.lead === member.name).length
  return {
    participating: active.length,
    leading,
    completed: all.filter((p) => p.status === '已完成').length,
    dueSoon: active.filter((p) => p.endDate && daysUntil(p.endDate, today) >= 0 && daysUntil(p.endDate, today) <= 30).length,
    overdue: all.filter((p) => isOverdue(p, today)).length,
    estimatedHours: wl.hours,
    workload: wl.percent,
    workloadLevel: wl.level,
    activeProjects: active,
    allProjects: all,
  }
}

/* ============================================================
   月度统计
   ============================================================ */

export function getMonthlyStats(projects, ym, today = todayStr()) {
  const { first, last } = monthBounds(ym)
  const inMonth = projects.filter(
    (p) => p.startDate && p.endDate && p.startDate <= last && p.endDate >= first
  )
  const direct = inMonth.filter((p) => p.type === 'direct')
  const pitch = inMonth.filter((p) => p.type === 'pitch')
  const pitchFinal = pitch.filter((p) => p.pitchResult && p.pitchResult !== '比稿进行中')
  const won = pitch.filter((p) => p.pitchResult === '已中标')
  const lost = pitch.filter((p) => p.pitchResult === '未中标')
  const abandoned = pitch.filter((p) => p.pitchResult === '已放弃')

  const deals = projects.filter(
    (p) => p.dealStatus === '已成交' && p.dealDate && p.dealDate >= first && p.dealDate <= last
  )
  const dealTotal = deals.reduce((s, p) => s + (Number(p.dealAmount) || 0), 0)
  const directDealTotal = deals.filter((p) => p.type === 'direct').reduce((s, p) => s + (Number(p.dealAmount) || 0), 0)
  const pitchDealTotal = deals.filter((p) => p.type === 'pitch').reduce((s, p) => s + (Number(p.dealAmount) || 0), 0)

  return {
    ym,
    total: inMonth.length,
    newCount: projects.filter((p) => p.createdDate && p.createdDate >= first && p.createdDate <= last).length,
    endedCount: projects.filter((p) => p.endDate && p.endDate >= first && p.endDate <= last).length,
    inProgress: inMonth.filter((p) => p.status === '进行中').length,
    completed: projects.filter(
      (p) => p.status === '已完成' && (p.actualCompleteDate || p.endDate) >= first && (p.actualCompleteDate || p.endDate) <= last
    ).length,
    overdue: inMonth.filter((p) => isOverdue(p, today)).length,
    directCount: direct.length,
    pitchCount: pitch.length,
    pitchWon: won.length,
    pitchLost: lost.length,
    pitchAbandoned: abandoned.length,
    pitchRunning: pitch.filter((p) => !p.pitchResult || p.pitchResult === '比稿进行中').length,
    directRatio: inMonth.length ? Math.round((direct.length / inMonth.length) * 100) : 0,
    pitchRatio: inMonth.length ? Math.round((pitch.length / inMonth.length) * 100) : 0,
    winRate: pitchFinal.length ? Math.round((won.length / pitchFinal.length) * 100) : 0,
    dealTotal,
    directDealTotal,
    pitchDealTotal,
    dealCount: deals.length,
    avgDeal: deals.length ? Math.round(dealTotal / deals.length) : 0,
    deals,
    inMonthProjects: inMonth,
  }
}

/* 近 N 个月的月度趋势 */
export function getMonthlyTrend(projects, months = 6, endYM = monthNow()) {
  const [y, m] = endYM.split('-').map(Number)
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const s = getMonthlyStats(projects, ym)
    result.push({
      ym,
      label: `${d.getMonth() + 1}月`,
      total: s.total,
      direct: s.directCount,
      pitch: s.pitchCount,
      dealTotal: s.dealTotal,
      winRate: s.winRate,
    })
  }
  return result
}

/* ============================================================
   岗位匹配与预警
   ============================================================ */

export function getRoleMismatch(p, members) {
  const issues = []
  // 设计师可能有多位，逐一校验岗位匹配
  getDesignerIds(p).forEach((id) => {
    const m = members.find((x) => x.id === id)
    if (m && m.role !== EXPECTED_ROLE.designer && m.role !== '待配置') {
      issues.push({ role: 'designer', member: m.name, memberRole: m.role, expected: EXPECTED_ROLE.designer })
    }
  })
  // 其余角色为独立工种人名，不作成员岗位校验
  return issues
}

export function getMissingRoles(p) {
  const missing = []
  if (getDesignerIds(p).length === 0) missing.push(ROLE_LABELS.designer)
  if (!p.lead) missing.push(ROLE_LABELS.lead)
  if (!p.planner) missing.push(ROLE_LABELS.planner)
  if (!p.executor) missing.push(ROLE_LABELS.executor)
  return missing
}

export function getAlerts(state, today = todayStr()) {
  const { projects, members } = state
  const alerts = []

  // 1. 同一成员多个项目时间重叠
  members.forEach((m) => {
    const active = projects.filter((p) => isActive(p) && memberInProject(p, m.id) && p.startDate && p.endDate)
    if (active.length >= 2) {
      alerts.push({
        id: `overlap-${m.id}`,
        level: 'warn',
        category: '人员调配',
        title: `${m.name} 同时承担 ${active.length} 个重叠项目`,
        detail: active.map((p) => p.name).join('、'),
      })
    }
  })

  // 2. 短期内多个交付
  members.forEach((m) => {
    const soon = projects.filter((p) => {
      if (!isActive(p) || !memberInProject(p, m.id) || !p.endDate) return false
      const d = daysUntil(p.endDate, today)
      return d >= 0 && d <= 14
    })
    if (soon.length >= 2) {
      alerts.push({
        id: `delivery-${m.id}`,
        level: 'warn',
        category: '交付高峰',
        title: `${m.name} 未来 14 天有 ${soon.length} 个项目交付`,
        detail: soon.map((p) => `${p.name}(${p.endDate})`).join('、'),
      })
    }
  })

  // 3/4. 固定岗位人员负荷
  members.forEach((m) => {
    if (m.role === '待配置') return
    const wl = getWorkloadDetails(m.id, projects, today)
    if (wl.percent >= 100) {
      alerts.push({
        id: `overload-${m.id}`,
        level: 'danger',
        category: '岗位负荷',
        title: `${m.name}（${m.role}）工作负荷超载 ${wl.percent}%`,
        detail: `当前承担 ${wl.active.length} 个进行中项目，建议暂停分配新任务。`,
      })
    } else if (wl.active.length === 0) {
      alerts.push({
        id: `idle-${m.id}`,
        level: 'info',
        category: '岗位闲置',
        title: `${m.name}（${m.role}）暂无项目安排`,
        detail: '可优先分配新项目。',
      })
    }
  })

  // 5. 项目缺少角色
  projects.filter(isActive).forEach((p) => {
    const missing = getMissingRoles(p)
    if (missing.length) {
      alerts.push({
        id: `missing-${p.id}`,
        level: 'danger',
        category: '人员缺失',
        title: `${p.name} 缺少：${missing.join('、')}`,
        detail: '请补齐项目人员分工。',
      })
    }
  })

  // 跨岗位待确认
  projects.filter(isActive).forEach((p) => {
    const mismatches = getRoleMismatch(p, members)
    if (mismatches.length && !p.crossRoleApproved) {
      alerts.push({
        id: `cross-${p.id}`,
        level: 'warn',
        category: '跨岗位',
        title: `${p.name} 存在跨岗位分配，待管理者确认`,
        detail: mismatches.map((x) => `${x.member}(${x.memberRole})承担${ROLE_LABELS[x.role]}`).join('；'),
      })
    }
  })

  // 逾期项目
  projects.filter((p) => isOverdue(p, today)).forEach((p) => {
    alerts.push({
      id: `overdue-${p.id}`,
      level: 'danger',
      category: '项目逾期',
      title: `${p.name} 已逾期 ${Math.abs(daysUntil(p.endDate, today))} 天`,
      detail: `截止日期 ${p.endDate}，当前进度 ${p.progress || 0}%。`,
    })
  })

  return alerts
}

/* ============================================================
   默认数据与持久化
   ============================================================ */

const REAL_MEMBERS = [
  { name: '刘琼', role: '设计师' },
  { name: '冯嘉灵', role: '设计师' },
  { name: '曾少练', role: '设计师' },
  { name: '刘佳胜', role: '设计师' },
  { name: '李福文', role: '设计师' },
  { name: '杨贵玲', role: '设计师' },
]

const LEGACY_NAMES = ['成员1', '成员2', '成员3', '成员4', '成员5', '成员6']

// 预置的 8 个真实项目：部署到公网后，所有新访客打开链接即可看到同一份初始数据。
// 已在自己浏览器录入过数据的访客不会被覆盖（仅在尚未初始化且项目为空时注入）。
const SEED_PROJECTS = [
  { id: 'P20261125-008', name: '白云雅高美爵酒店 开业', client: '白云雅高美爵酒店', type: 'direct', startDate: '2026-11-03', endDate: '2026-11-29', createdDate: '2026-11-25', status: '进行中', priority: '中', progress: 80, requirement: '', note: '', lead: '肖长杰', designerIds: ['M2', 'M6'], designer: 'M2', planner: '陈偲韵', executor: '林扬濠', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '2026-11-11', dealStatus: '已成交', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-007', name: '米果年会', client: '米果', type: 'pitch', startDate: '2026-11-09', endDate: '2027-01-22', createdDate: '2026-11-25', status: '进行中', priority: '中', progress: 0, requirement: '', note: '', lead: '肖镇逵', designerIds: ['M3', 'M4'], designer: 'M3', planner: '李舒婷', executor: '邱文浩', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '', dealStatus: '待确认', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-006', name: '旗锋货运&香格里拉', client: '旗锋货运', type: 'direct', startDate: '2026-11-09', endDate: '2026-12-05', createdDate: '2026-11-25', status: '未开始', priority: '中', progress: 90, requirement: '', note: '', lead: '邢益铭', designerIds: ['M3', 'M5'], designer: 'M3', planner: '李舒婷', executor: '邱文浩', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '2026-11-25', dealStatus: '已成交', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-005', name: '广西商务厅&东方宾馆', client: '广西商务厅', type: 'direct', startDate: '2026-11-17', endDate: '2026-12-02', createdDate: '2026-11-25', status: '进行中', priority: '中', progress: 0, requirement: '', note: '', lead: '肖镇逵', designerIds: ['M2'], designer: 'M2', planner: '', executor: '林扬濠', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '2026-11-17', dealStatus: '已成交', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-004', name: '康怡年会', client: '康怡雪糕', type: 'pitch', startDate: '2026-10-25', endDate: '2026-12-15', createdDate: '2026-11-25', status: '进行中', priority: '中', progress: 30, requirement: '', note: '第一轮比稿已提交', lead: '陈明生', designerIds: ['M1', 'M3', 'M5'], designer: 'M1', planner: '陈偲韵', executor: '林扬濠', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '', dealStatus: '待确认', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-003', name: '拉芳&杭州', client: '拉芳', type: 'direct', startDate: '2026-11-04', endDate: '2026-12-05', createdDate: '2026-11-25', status: '进行中', priority: '高', progress: 80, requirement: '', note: '基本定稿，出下单文件中', lead: '罗敏仪', designerIds: ['M2', 'M6'], designer: 'M2', planner: '李舒婷', executor: '毛志旭', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '2026-11-04', dealStatus: '已成交', paymentStatus: '部分回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '2026-12-05', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-002', name: '蒙娜丽莎瓷砖2027营销峰会', client: '蒙娜丽莎瓷砖', type: 'pitch', startDate: '2026-11-19', endDate: '2027-01-04', createdDate: '2026-11-25', status: '进行中', priority: '中', progress: 0, requirement: '', note: '第一轮方案已提交，比价中', lead: '林丹雄', designerIds: ['M1', 'M5'], designer: 'M1', planner: '陈偲韵', executor: '邱文浩', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '', dealStatus: '未成交', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
  { id: 'P20261125-001', name: '黄埔南方电网', client: '南方电网', type: 'direct', startDate: '2026-11-25', endDate: '2026-12-08', createdDate: '2026-11-25', status: '进行中', priority: '高', progress: 0, requirement: '', note: '', lead: '盛玲玲', designerIds: ['M1', 'M3', 'M6'], designer: 'M1', planner: '陈偲韵', executor: '邱文浩', crossRoleApproved: false, budget: 0, quote: 0, dealAmount: 0, dealDate: '2026-11-25', dealStatus: '已成交', paymentStatus: '未回款', paidAmount: 0, pitchResult: '比稿进行中', nextStep: '', actualCompleteDate: '', issue: '', delayRisk: '否', estimatedHours: 40, taskCount: 0 },
]

function makeSeedProjects() {
  return SEED_PROJECTS.map((p) => ({ ...p, designerIds: [...p.designerIds] }))
}

function makeMembers() {
  return REAL_MEMBERS.map((r, i) => ({
    id: `M${i + 1}`,
    name: r.name,
    role: r.role,
    duties: '',
    status: '在岗',
    note: '',
  }))
}

/* 加班时长数据：仅记录刘琼设计师；records 为加班记录，comp 为调休记录，
   baseHours 为「手动调整总加班时长」的差额（可为负），随全量 state 云端同步。
   总加班时长 = 加班记录合计 + baseHours。 */
export function normalizeOvertime(v) {
  const o = v && typeof v === 'object' ? v : {}
  const base = Number(o.baseHours)
  return {
    records: Array.isArray(o.records) ? o.records : [],
    comp: Array.isArray(o.comp) ? o.comp : [],
    baseHours: Number.isFinite(base) ? Math.round(base * 100) / 100 : 0,
  }
}

function emptyOvertime() {
  return { records: [], comp: [], baseHours: 0 }
}

function defaultState() {
  return {
    members: makeMembers(),
    leaders: [...DEFAULT_LEADERS],
    planners: [...DEFAULT_PLANNERS],
    executors: [...DEFAULT_EXECUTORS],
    projects: makeSeedProjects(),
    todos: [],
    overtime: emptyOvertime(),
    memberNamesMigrated: true,
    rosterMigrationV2: true,
    roleNamesMigrated: true,
    rosterMigrationV3: true,
    formFlagsCleaned: true,
    designerArrayMigrated: true,
    seedProjectsMigrated: true,
  }
}

function migrateMembers(members) {
  return members.map((m, i) => {
    if (m.id === `M${i + 1}` && (m.name === LEGACY_NAMES[i] || !m.name)) {
      return { ...m, name: REAL_MEMBERS[i].name, role: '设计师' }
    }
    return m
  })
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.projects)) return defaultState()
    // 确保 6 位成员存在
    let members = parsed.members.length === 6 ? parsed.members : makeMembers()
    // 一次性迁移：仅替换仍为默认姓名/岗位的成员，保留项目数据、成员 ID 与其他字段
    if (!parsed.memberNamesMigrated) {
      members = migrateMembers(members)
    }
    let leaders = Array.isArray(parsed.leaders) ? parsed.leaders : [...DEFAULT_LEADERS]
    let planners = Array.isArray(parsed.planners) ? parsed.planners : [...DEFAULT_PLANNERS]
    let executors = Array.isArray(parsed.executors) ? parsed.executors : [...DEFAULT_EXECUTORS]
    // 一次性迁移：早期版本的负责人/执行名录为空，补入初始名单；用户之后手动清空不受影响
    if (!parsed.rosterMigrationV2) {
      if (leaders.length === 0) leaders = [...DEFAULT_LEADERS]
      if (executors.length === 0) executors = [...DEFAULT_EXECUTORS]
    }
    // 一次性迁移：把负责人/策划/执行里残留的成员 ID 转成纯人名
    let projects = parsed.roleNamesMigrated ? parsed.projects : migrateRoleNames(parsed.projects, members)
    // 一次性清洗：移除项目里残留的表单内部标记（_isNew/_key），
    // 否则编辑旧项目时会被误判为新增，保存时报「编号已存在」
    if (!parsed.formFlagsCleaned) {
      projects = projects.map((p) => {
        const clean = { ...p }
        delete clean._isNew
        delete clean._key
        return clean
      })
    }
    // 一次性迁移：设计师单例字段转数组，支持多位设计师协作
    if (!parsed.designerArrayMigrated) {
      projects = migrateDesignerArray(projects)
    }
    // 强制同步名录到已录入的正式名单：早期版本可能已打过迁移标记但名录仍为空，
    // 导致下拉无选项。此处按最新正式名单覆盖一次，之后用户手动修改不受影响。
    if (!parsed.rosterMigrationV3) {
      leaders = [...DEFAULT_LEADERS]
      planners = [...DEFAULT_PLANNERS]
      executors = [...DEFAULT_EXECUTORS]
    }
    // 一次性注入预置的真实项目：仅在本地从未录入过任何项目时执行。
    // 已有项目（哪怕只有 1 个）一律保留，绝不覆盖用户自己的数据。
    if (!parsed.seedProjectsMigrated && projects.length === 0) {
      projects = makeSeedProjects()
    }
    const todos = Array.isArray(parsed.todos) ? parsed.todos : []
    const overtime = normalizeOvertime(parsed.overtime)
    return { ...parsed, members, leaders, planners, executors, projects, todos, overtime, memberNamesMigrated: true, rosterMigrationV2: true, roleNamesMigrated: true, rosterMigrationV3: true, formFlagsCleaned: true, designerArrayMigrated: true, seedProjectsMigrated: true }
  } catch {
    return defaultState()
  }
}

/* ============================================================
   状态规范化：云端旧记录可能缺少较新的字段（如 todos、overtime），统一补齐
   ============================================================ */

export function normalizeState(s) {
  if (!s || typeof s !== 'object') return s
  return {
    ...s,
    projects: Array.isArray(s.projects) ? s.projects : [],
    members: Array.isArray(s.members) ? s.members : [],
    todos: Array.isArray(s.todos) ? s.todos : [],
    overtime: normalizeOvertime(s.overtime),
  }
}

/* ============================================================
   Store Provider
   ============================================================ */

const StoreContext = createContext(null)

/* ============================================================
   云端共享同步辅助
   ============================================================ */

function makeClientId() {
  try {
    let id = sessionStorage.getItem('workbench-client-id')
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      sessionStorage.setItem('workbench-client-id', id)
    }
    return id
  } catch {
    return 'c_' + Math.random().toString(36).slice(2, 12)
  }
}

function friendlySyncError(e) {
  const msg = String(e?.message || e || '')
  if (/fetch|network|Failed to fetch|NetworkError|load failed|timeout/i.test(msg)) return '网络未连接，数据暂存在本机'
  if (/401|403|42501|origin|jwt|credential|permission|策略/i.test(msg)) return '云端鉴权未通过，请通过正式链接访问'
  if (/42P01/.test(msg)) return '云端数据表未就绪'
  return '云端暂不可用：' + msg.slice(0, 50)
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [sync, setSync] = useState({ status: 'connecting', lastAt: null, message: '' })

  const stateRef = useRef(state)
  const revRef = useRef(0)
  const writerRef = useRef(makeClientId())
  const hydratedRef = useRef(false)   // 是否已完成首次云端对齐
  const dirtyRef = useRef(false)      // 是否有待上传的本地改动
  const applyingRef = useRef(false)   // 正在把云端数据写回本地（不应触发回传）
  const savingRef = useRef(false)
  const timerRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => () => { aliveRef.current = false; clearTimeout(timerRef.current) }, [])

  // 上传：先读云端最新版本号再写，避免两台电脑各自从旧版本递增
  const pushCloud = useCallback(async () => {
    if (savingRef.current || !hydratedRef.current || !dirtyRef.current) return
    savingRef.current = true
    setSync({ status: 'saving', lastAt: null, message: '' })
    try {
      const snapshot = stateRef.current
      const current = await fetchCloudState()
      const nextRev = (current?.rev || 0) + 1
      await saveCloudState(snapshot, nextRev, writerRef.current)
      revRef.current = nextRev
      if (stateRef.current === snapshot) dirtyRef.current = false
      if (aliveRef.current) setSync({ status: 'synced', lastAt: Date.now(), message: '' })
    } catch (e) {
      if (aliveRef.current) setSync({ status: 'offline', lastAt: null, message: friendlySyncError(e) })
    } finally {
      savingRef.current = false
      if (dirtyRef.current && aliveRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => pushCloud(), 1200)
      }
    }
  }, [])

  // 拉取：仅在本地没有待上传改动时采用云端数据，避免打断正在进行的编辑
  const pullCloud = useCallback(async (force = false) => {
    if (savingRef.current) return
    if (!force && dirtyRef.current) return
    if (!force) {
      const ae = document.activeElement
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return
    }
    try {
      const row = await fetchCloudState()
      if (!aliveRef.current) return
      if (!row || !isValidState(row.state)) {
        // 云端还没有记录：把本机数据作为第一份基准上传
        hydratedRef.current = true
        dirtyRef.current = true
        await pushCloud()
        return
      }
      hydratedRef.current = true
      if (!force && row.writer === writerRef.current) {
        revRef.current = Math.max(revRef.current, row.rev)
        return
      }
      if (force || row.rev > revRef.current) {
        revRef.current = row.rev
        applyingRef.current = true
        setState(normalizeState(row.state))
      }
      if (aliveRef.current) setSync({ status: 'synced', lastAt: Date.now(), message: '' })
    } catch (e) {
      hydratedRef.current = true
      if (aliveRef.current) setSync({ status: 'offline', lastAt: null, message: friendlySyncError(e) })
    }
  }, [pushCloud])

  // 启动时先与云端对齐（云端数据为准）
  useEffect(() => { pullCloud(true) }, [pullCloud])

  // 本地缓存始终写入，作为离线兜底；有改动则防抖上传云端
  useEffect(() => {
    stateRef.current = state
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
    if (applyingRef.current) { applyingRef.current = false; return }
    if (!hydratedRef.current) return
    dirtyRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => pushCloud(), 800)
  }, [state, pushCloud])

  // 其他电脑的改动：每 20 秒轮询，窗口重新获得焦点时立即刷新
  useEffect(() => {
    const id = window.setInterval(() => pullCloud(false), 20000)
    const onFocus = () => pullCloud(false)
    const onVis = () => { if (!document.hidden) pullCloud(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [pullCloud])

  // 手动「立即同步」：先提交本机改动，再强制与云端对齐
  const syncNow = useCallback(async () => {
    clearTimeout(timerRef.current)
    if (dirtyRef.current) await pushCloud()
    await pullCloud(true)
  }, [pushCloud, pullCloud])

  const generateProjectId = useCallback(() => {
    const prefix = 'P' + todayStr().replace(/-/g, '')
    let n = 1
    let id = `${prefix}-${String(n).padStart(3, '0')}`
    while (state.projects.some((p) => p.id === id)) {
      n += 1
      id = `${prefix}-${String(n).padStart(3, '0')}`
    }
    return id
  }, [state.projects])

  const addProject = useCallback((project) => {
    let result = null
    setState((s) => {
      if (s.projects.some((p) => p.id === project.id)) {
        result = { error: '项目编号已存在' }
        return s
      }
      result = { ok: true }
      return { ...s, projects: [project, ...s.projects] }
    })
    return result
  }, [])

  const updateProject = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const deleteProject = useCallback((id) => {
    setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }))
  }, [])

  /* ---- 待办事项（随全量 state 一起云端同步） ---- */

  const generateTodoId = useCallback(() => {
    const prefix = 'T' + todayStr().replace(/-/g, '')
    let n = 1
    let id = `${prefix}-${String(n).padStart(3, '0')}`
    while ((state.todos || []).some((t) => t.id === id)) {
      n += 1
      id = `${prefix}-${String(n).padStart(3, '0')}`
    }
    return id
  }, [state.todos])

  const addTodo = useCallback((todo) => {
    setState((s) => ({ ...s, todos: [todo, ...(s.todos || [])] }))
  }, [])

  const updateTodo = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      todos: (s.todos || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const deleteTodo = useCallback((id) => {
    setState((s) => ({ ...s, todos: (s.todos || []).filter((t) => t.id !== id) }))
  }, [])

  const toggleTodo = useCallback((id) => {
    setState((s) => ({
      ...s,
      todos: (s.todos || []).map((t) => (t.id === id
        ? { ...t, done: !t.done, doneAt: !t.done ? todayStr() : '' }
        : t)),
    }))
  }, [])

  /* ---- 加班时长（仅刘琼设计师；随全量 state 一起云端同步） ---- */

  const generateOvertimeId = useCallback(() => {
    const o = normalizeOvertime(state.overtime)
    const used = new Set([...o.records, ...o.comp].map((r) => r.id))
    const prefix = 'OT' + todayStr().replace(/-/g, '')
    let n = 1
    let id = `${prefix}-${String(n).padStart(3, '0')}`
    while (used.has(id)) {
      n += 1
      id = `${prefix}-${String(n).padStart(3, '0')}`
    }
    return id
  }, [state.overtime])

  const mutateOvertime = useCallback((kind, fn) => {
    setState((s) => {
      const o = normalizeOvertime(s.overtime)
      return { ...s, overtime: { ...o, [kind]: fn(o[kind]) } }
    })
  }, [])

  const addOvertimeRecord = useCallback((record) => mutateOvertime('records', (list) => [record, ...list]), [mutateOvertime])
  const updateOvertimeRecord = useCallback((id, patch) => mutateOvertime('records', (list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))), [mutateOvertime])
  const deleteOvertimeRecord = useCallback((id) => mutateOvertime('records', (list) => list.filter((r) => r.id !== id)), [mutateOvertime])
  const addCompRecord = useCallback((record) => mutateOvertime('comp', (list) => [record, ...list]), [mutateOvertime])
  const updateCompRecord = useCallback((id, patch) => mutateOvertime('comp', (list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))), [mutateOvertime])
  const deleteCompRecord = useCallback((id) => mutateOvertime('comp', (list) => list.filter((r) => r.id !== id)), [mutateOvertime])

  // 手动调整总加班时长：传入「调整差额」，总时长 = 记录合计 + 差额
  const setOvertimeBase = useCallback((hours) => {
    const v = Math.round((Number(hours) || 0) * 100) / 100
    setState((s) => {
      const o = normalizeOvertime(s.overtime)
      return { ...s, overtime: { ...o, baseHours: v } }
    })
  }, [])

  const updateMember = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }, [])

  const updatePlanners = useCallback((names) => {
    setState((s) => ({ ...s, planners: names }))
  }, [])

  const updateLeaders = useCallback((names) => {
    setState((s) => ({ ...s, leaders: names }))
  }, [])

  const updateExecutors = useCallback((names) => {
    setState((s) => ({ ...s, executors: names }))
  }, [])

  const replaceState = useCallback((next) => {
    let members = Array.isArray(next.members) && next.members.length === 6 ? next.members : makeMembers()
    if (!next.memberNamesMigrated) members = migrateMembers(members)
    const planners = Array.isArray(next.planners) ? next.planners : [...DEFAULT_PLANNERS]
    const leaders = Array.isArray(next.leaders) ? next.leaders : [...DEFAULT_LEADERS]
    const executors = Array.isArray(next.executors) ? next.executors : [...DEFAULT_EXECUTORS]
    setState({
      members,
      leaders,
      planners,
      executors,
      projects: Array.isArray(next.projects) ? migrateDesignerArray(migrateRoleNames(next.projects, members)) : [],
      todos: Array.isArray(next.todos) ? next.todos : [],
      overtime: normalizeOvertime(next.overtime),
      memberNamesMigrated: true,
      rosterMigrationV2: true,
      roleNamesMigrated: true,
      rosterMigrationV3: true,
      formFlagsCleaned: true,
      designerArrayMigrated: true,
      seedProjectsMigrated: true,
    })
  }, [])

  // 重置仍为「清空所有项目」：显式标记预置数据已处理，避免刷新后被重新注入
  const resetAll = useCallback(() => setState({ ...defaultState(), projects: [], seedProjectsMigrated: true }), [])

  const value = useMemo(
    () => ({
      state,
      sync,
      syncNow,
      generateProjectId,
      addProject,
      updateProject,
      deleteProject,
      generateTodoId,
      addTodo,
      updateTodo,
      deleteTodo,
      toggleTodo,
      generateOvertimeId,
      addOvertimeRecord,
      updateOvertimeRecord,
      deleteOvertimeRecord,
      addCompRecord,
      updateCompRecord,
      deleteCompRecord,
      setOvertimeBase,
      updateMember,
      updatePlanners,
      updateLeaders,
      updateExecutors,
      replaceState,
      resetAll,
    }),
    [state, sync, syncNow, generateProjectId, addProject, updateProject, deleteProject, generateTodoId, addTodo, updateTodo, deleteTodo, toggleTodo, generateOvertimeId, addOvertimeRecord, updateOvertimeRecord, deleteOvertimeRecord, addCompRecord, updateCompRecord, deleteCompRecord, setOvertimeBase, updateMember, updatePlanners, updateLeaders, updateExecutors, replaceState, resetAll]
  )

  return React.createElement(StoreContext.Provider, { value }, children)
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/* ============================================================
   导出工具
   ============================================================ */

export function exportCSV(rows, filename) {
  if (!rows.length) return
  const header = Object.keys(rows[0])
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header.map(esc).join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJSON(state, filename) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
