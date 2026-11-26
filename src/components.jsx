import React, { useState } from 'react'
import { STATUS_COLORS } from './store.js'

/* ============ 基础容器 ============ */

export function Card({ title, subtitle, extra, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {extra && <div className="card-extra">{extra}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, hint, tone = 'blue', icon, onClick }) {
  return (
    <div
      className={`stat-card tone-${tone} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
      {onClick && <div className="stat-more">查看明细项目 →</div>}
    </div>
  )
}

export function SectionTitle({ children, hint, extra }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {hint && <span>{hint}</span>}
      {extra && <div className="section-title-extra">{extra}</div>}
    </div>
  )
}

export function EmptyState({ text = '暂无数据', action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">🍃</div>
      <p>{text}</p>
      {action}
    </div>
  )
}

/* ============ 标记 ============ */

export function Badge({ children, color = 'gray', dot = true }) {
  return (
    <span className={`badge badge-${color}`}>
      {dot && <i />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  return <Badge color={STATUS_COLORS[status] || 'gray'}>{status}</Badge>
}

export function PriorityBadge({ priority }) {
  const map = { 高: 'red', 中: 'amber', 低: 'gray' }
  return <Badge color={map[priority] || 'gray'}>{priority || '—'}</Badge>
}

export function ProgressBar({ value, showText = true, color }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const barColor = color || (v === 100 ? '#5fb87e' : v >= 61 ? '#4a90e2' : v >= 31 ? '#9d8fd8' : '#55b1c4')
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${v}%`, background: barColor }} />
      </div>
      {showText && <span className="progress-text">{v}%</span>}
    </div>
  )
}

export function LoadBar({ percent }) {
  const p = Math.max(0, Number(percent) || 0)
  let color = '#5fb87e'
  if (p >= 100) color = '#e27593'
  else if (p >= 70) color = '#eda75f'
  else if (p >= 30) color = '#4a90e2'
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, p)}%`, background: color }} />
      </div>
      <span className="progress-text">{p}%</span>
    </div>
  )
}

/* ============ 表单 ============ */

export function Field({ label, children, hint, required, wide }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span className="field-label">
        {label}
        {required && <em>*</em>}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function Input(props) {
  return <input className="input" {...props} />
}

export function Select({ options, ...props }) {
  return (
    <select className="input" {...props}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return (
          <option key={v} value={v}>
            {l}
          </option>
        )
      })}
    </select>
  )
}

export function Textarea(props) {
  return <textarea className="input" rows={3} {...props} />
}

export function Modal({ title, subtitle, onClose, children, footer, width = '860px' }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      width="440px"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>确认删除</button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.7 }}>{message}</p>
    </Modal>
  )
}

/* ============ 表格 ============ */

export function DataTable({ columns, rows, emptyText = '暂无数据', onRowClick, compact }) {
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const sorted = React.useMemo(() => {
    if (!sort.key) return rows
    return [...rows].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
      return String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN') * sort.dir
    })
  }, [rows, sort])

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))

  return (
    <div className={`table-wrap ${compact ? 'compact' : ''}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.title} onClick={c.sortable ? () => toggle(c.key) : undefined} className={c.sortable ? 'sortable' : ''}>
                {c.title}
                {sort.key === c.key && <span className="sort-mark">{sort.dir === 1 ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length}><EmptyState text={emptyText} /></td></tr>
          ) : (
            sorted.map((r, i) => (
              <tr key={r._key || r.id || i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'clickable' : ''}>
                {columns.map((c) => (
                  <td key={c.key || c.title}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ============ 筛选栏 ============ */

export function FilterBar({ children }) {
  return <div className="filter-bar">{children}</div>
}

export function FilterItem({ label, children }) {
  return (
    <label className="filter-item">
      <span>{label}</span>
      {children}
    </label>
  )
}

/* ============ 轻量 SVG 图表 ============ */

const CHART_COLORS = ['#4a90e2', '#5fb87e', '#eda75f', '#9d8fd8', '#55b1c4', '#e27593']

export function LineChart({ data, series, height = 240, yFormat = (v) => v }) {
  const W = 720
  const H = height
  const pad = { l: 56, r: 20, t: 18, b: 34 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const allValues = series.flatMap((s) => data.map((d) => Number(d[s.key]) || 0))
  const max = Math.max(1, ...allValues)
  const niceMax = Math.ceil(max / 5) * 5 || 5
  const x = (i) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => pad.t + ih - ((Number(v) || 0) / niceMax) * ih

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const gy = pad.t + ih * t
          const val = niceMax * (1 - t)
          return (
            <g key={t}>
              <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} stroke="#e2edf8" strokeWidth="1" />
              <text x={pad.l - 8} y={gy + 4} textAnchor="end" fontSize="11" fill="#92a3ba">{yFormat(Math.round(val))}</text>
            </g>
          )
        })}
        {data.map((d, i) => (
          <text key={d.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#92a3ba">{d.label}</text>
        ))}
        {series.map((s, si) => {
          const color = s.color || CHART_COLORS[si % CHART_COLORS.length]
          const pts = data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')
          return (
            <g key={s.key}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d[s.key])} r="3.5" fill="#ffffff" stroke={color} strokeWidth="2" />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s, si) => (
          <span key={s.key}>
            <i style={{ background: s.color || CHART_COLORS[si % CHART_COLORS.length] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ data, series, height = 240, yFormat = (v) => v, stacked = false }) {
  const W = 720
  const H = height
  const pad = { l: 56, r: 20, t: 18, b: 40 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const totals = data.map((d) => series.reduce((s, se) => s + (Number(d[se.key]) || 0), 0))
  const max = Math.max(1, ...(stacked ? totals : series.flatMap((se) => data.map((d) => Number(d[se.key]) || 0))))
  const niceMax = Math.ceil(max / 5) * 5 || 5
  const y = (v) => pad.t + ih - (v / niceMax) * ih
  const groupW = iw / Math.max(1, data.length)
  const barW = Math.min(28, (groupW * 0.62) / (stacked ? 1 : series.length))

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const gy = pad.t + ih * t
          return (
            <g key={t}>
              <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} stroke="#e2edf8" strokeWidth="1" />
              <text x={pad.l - 8} y={gy + 4} textAnchor="end" fontSize="11" fill="#92a3ba">{yFormat(Math.round(niceMax * (1 - t)))}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const cx = pad.l + groupW * (i + 0.5)
          let stackY = pad.t + ih
          return (
            <g key={d.label}>
              {series.map((se, si) => {
                const v = Number(d[se.key]) || 0
                const h = (v / niceMax) * ih
                const bx = stacked ? cx - barW / 2 : cx - (series.length * barW) / 2 + si * barW
                const by = stacked ? stackY - h : y(v)
                if (stacked) stackY -= h
                return <rect key={se.key} x={bx} y={by} width={barW - 2} height={Math.max(0, h)} rx="3" fill={se.color || CHART_COLORS[si % CHART_COLORS.length]} />
              })}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#92a3ba">{d.label}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s, si) => (
          <span key={s.key}>
            <i style={{ background: s.color || CHART_COLORS[si % CHART_COLORS.length] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const PIE_COLORS = ['#4a90e2', '#5fb87e', '#eda75f', '#9d8fd8', '#55b1c4', '#e27593', '#9fb0c4', '#e8825e']

function polarPoint(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

function donutPath(cx, cy, R, r, a0, a1) {
  // 单一扇区占满整圈时，用两段弧拼出圆环，避免起止点重合导致路径失效
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    return [
      `M ${cx} ${cy - R}`,
      `A ${R} ${R} 0 1 1 ${cx} ${cy + R}`,
      `A ${R} ${R} 0 1 1 ${cx} ${cy - R}`,
      `M ${cx} ${cy - r}`,
      `A ${r} ${r} 0 1 0 ${cx} ${cy + r}`,
      `A ${r} ${r} 0 1 0 ${cx} ${cy - r}`,
      'Z',
    ].join(' ')
  }
  const [x0, y0] = polarPoint(cx, cy, R, a0)
  const [x1, y1] = polarPoint(cx, cy, R, a1)
  const [x2, y2] = polarPoint(cx, cy, r, a1)
  const [x3, y3] = polarPoint(cx, cy, r, a0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`
}

export function PieChart({ data, height = 260, valueFormat = (v) => v, colors = PIE_COLORS, centerLabel = '合计' }) {
  const items = (data || []).filter((d) => (Number(d.value) || 0) > 0)
  const total = items.reduce((s, d) => s + Number(d.value), 0)
  const W = 720
  const H = height
  const cx = W / 2
  const cy = H / 2
  const R = Math.min(H / 2 - 24, 104)
  const r = R * 0.58

  if (!total) return <EmptyState text="暂无可展示的数据" />

  let angle = -Math.PI / 2
  const slices = items.map((d, i) => {
    const sweep = (Number(d.value) / total) * Math.PI * 2
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    return { ...d, color: d.color || colors[i % colors.length], a0, a1, pct: (Number(d.value) / total) * 100 }
  })

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="chart-svg">
        {slices.map((s, i) => (
          <path key={`${s.label}-${i}`} d={donutPath(cx, cy, R, r, s.a0, s.a1)} fill={s.color} fillRule="evenodd" stroke="#ffffff" strokeWidth="2">
            <title>{`${s.label}：${valueFormat(s.value)}（${s.pct.toFixed(1)}%）`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fontWeight="700" fill="#33465e">{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill="#92a3ba">{centerLabel}</text>
      </svg>
      <div className="chart-legend">
        {slices.map((s, i) => (
          <span key={`${s.label}-${i}`}><i style={{ background: s.color }} />{s.label} {s.pct.toFixed(1)}%</span>
        ))}
      </div>
    </div>
  )
}

export function HBarList({ items, format = (v) => v, max }) {
  const m = max || Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="hbar-list">
      {items.length === 0 && <EmptyState text="暂无数据" />}
      {items.map((it) => (
        <div className="hbar-row" key={it.label}>
          <span className="hbar-label" title={it.label}>{it.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(it.value / m) * 100}%`, background: it.color || '#4a90e2' }} /></div>
          <span className="hbar-value">{format(it.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function AlertRow({ alert }) {
  return (
    <div className={`alert-row alert-${alert.level}`}>
      <span className="alert-dot" />
      <div className="alert-content">
        <div className="alert-title">{alert.title}</div>
        <div className="alert-detail">{alert.detail}</div>
      </div>
      <span className="alert-cat">{alert.category}</span>
    </div>
  )
}
