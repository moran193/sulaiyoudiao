import React, { useMemo, useState } from 'react'
import {
  useStore, todayStr, calcRangeHours, formatHours, hoursToDays, normalizeOvertime
} from '../store.js'
import {
  Card, StatCard, SectionTitle, Badge, EmptyState, Field, Input, Textarea, Modal, ConfirmDialog
} from '../components.jsx'

/* 加班时长：仅记录刘琼设计师。
   - 加班与调休均可填「开始日期 + 时间 → 结束日期 + 时间」，支持跨日期自动计算；
   - 按自然日逐段累计，每天 12:00–13:00 午休 1 小时不计入，故 9:00–18:00 记 8 小时；
   - 也可直接手填小时数覆盖自动计算（单条记录）；
   - 总加班时长可在概览里手动调整（差额存 baseHours），剩余 = 总加班 − 已调休。 */

const TIME_FIELDS = { date: '', endDate: '', start: '', end: '', hours: '', note: '' }
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export function OvertimeView() {
  const {
    state, generateOvertimeId,
    addOvertimeRecord, updateOvertimeRecord, deleteOvertimeRecord,
    addCompRecord, updateCompRecord, deleteCompRecord,
    setOvertimeBase,
  } = useStore()

  const { records, comp, baseHours } = normalizeOvertime(state.overtime)
  const today = todayStr()

  const sumHours = (list) => round2(list.reduce((s, r) => s + (Number(r.hours) || 0), 0))
  const recordHours = useMemo(() => sumHours(records), [records])
  const compHours = useMemo(() => sumHours(comp), [comp])
  const totalHours = round2(recordHours + baseHours)
  const remainHours = round2(totalHours - compHours)
  const totalDays = hoursToDays(totalHours)
  const remainDays = hoursToDays(remainHours)

  const sortByDate = (list) => [...list].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')) ||
    String(b.id || '').localeCompare(String(a.id || ''))
  )
  const sortedRecords = useMemo(() => sortByDate(records), [records])
  const sortedComp = useMemo(() => sortByDate(comp), [comp])

  const [editor, setEditor] = useState(null)   // null | { type:'ot'|'comp', mode:'new'|'edit', item }
  const [form, setForm] = useState(TIME_FIELDS)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)  // { type, item }

  // 手动调整「总加班时长」
  const [totalOpen, setTotalOpen] = useState(false)
  const [totalInput, setTotalInput] = useState('')
  const [totalError, setTotalError] = useState('')

  const openNew = (type) => {
    setForm({ ...TIME_FIELDS, date: today, endDate: today })
    setError('')
    setEditor({ type, mode: 'new' })
  }
  const openEdit = (type, item) => {
    // 自动计算过的记录留空小时数，编辑时间段时会重新自动换算；
    // 手动填写（没有时间段）的记录则把小时数带回输入框。
    const isManual = item.manual === true || !(item.start && item.end)
    setForm({
      date: item.date || today,
      endDate: item.endDate || item.date || today,
      start: item.start || '',
      end: item.end || '',
      hours: isManual && item.hours != null ? String(item.hours) : '',
      note: item.note || '',
    })
    setError('')
    setEditor({ type, mode: 'edit', item })
  }
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const rangeHours = editor
    ? calcRangeHours(form.date, form.start, form.endDate || form.date, form.end)
    : 0
  const manualVal = Number(form.hours)
  const usingManual = form.hours !== '' && Number.isFinite(manualVal) && manualVal > 0
  const previewHours = usingManual ? round2(manualVal) : rangeHours
  const previewSource = usingManual ? '手动填写' : (rangeHours > 0 ? '按时间段自动计算' : '')
  const crossDay = !!(editor && form.endDate && form.date && form.endDate !== form.date)

  const save = () => {
    if (!form.date) { setError('请选择开始日期'); return }
    if (form.endDate && form.endDate < form.date) { setError('结束日期不能早于开始日期'); return }
    if (!(previewHours > 0)) {
      setError(usingManual
        ? '请填写大于 0 的小时数'
        : '时间段无效：请填写完整的开始/结束日期与时间；结束时间需晚于开始时间，跨夜请把结束日期选到次日')
      return
    }
    const payload = {
      date: form.date,
      endDate: form.endDate || form.date,
      start: form.start || '',
      end: form.end || '',
      hours: previewHours,
      manual: usingManual,
      note: form.note.trim(),
    }
    if (editor.mode === 'new') {
      const record = { id: generateOvertimeId(), ...payload, createdAt: today }
      if (editor.type === 'ot') addOvertimeRecord(record)
      else addCompRecord(record)
    } else if (editor.type === 'ot') {
      updateOvertimeRecord(editor.item.id, payload)
    } else {
      updateCompRecord(editor.item.id, payload)
    }
    setEditor(null)
  }

  const openTotal = () => {
    setTotalInput(formatHours(totalHours))
    setTotalError('')
    setTotalOpen(true)
  }
  const saveTotal = () => {
    const v = Number(totalInput)
    if (!Number.isFinite(v) || v < 0) { setTotalError('请输入不小于 0 的小时数'); return }
    setOvertimeBase(round2(v - recordHours))
    setTotalOpen(false)
  }
  const resetTotal = () => { setOvertimeBase(0); setTotalOpen(false) }

  const doDelete = () => {
    if (!confirmDel) return
    if (confirmDel.type === 'ot') deleteOvertimeRecord(confirmDel.item.id)
    else deleteCompRecord(confirmDel.item.id)
    setConfirmDel(null)
  }

  const rangeLabel = (r, type) => {
    if (r.start && r.end) {
      const cross = r.endDate && r.date && r.endDate !== r.date
      return `${r.start} → ${cross ? r.endDate.slice(5) + ' ' : ''}${r.end}`
    }
    return r.manual ? '手动填写' : (type === 'comp' ? '按小时登记' : '—')
  }

  const renderRow = (r, type) => (
    <div className="ot-row" key={r.id}>
      <div className="ot-date">{r.date || '—'}</div>
      <div className="ot-time">
        {rangeLabel(r, type)}
        {r.manual && <em className="ot-manual-tag">手动</em>}
      </div>
      <div className="ot-hours"><b>{formatHours(r.hours)}</b> 小时</div>
      <div className="ot-days">≈ {formatHours(hoursToDays(r.hours))} 天</div>
      <div className="ot-note">{r.note || '—'}</div>
      <div className="ot-ops">
        <button className="icon-btn" title="编辑" onClick={() => openEdit(type, r)}>✎</button>
        <button className="icon-btn ot-del" title="删除" onClick={() => setConfirmDel({ type, item: r })}>🗑️</button>
      </div>
    </div>
  )

  return (
    <div className="page ot-page">
      <div className="page-head">
        <div>
          <h1>加班时长</h1>
          <p>仅记录刘琼设计师 · 起止可跨日期自动算时长 · 9:00–18:00 记 8 小时 · 总时长可手动调整 · 数据随云端同步</p>
        </div>
        <div className="head-actions">
          <Badge color="blue" dot={false}>{records.length} 条加班 · {comp.length} 笔调休</Badge>
        </div>
      </div>

      <div className="ot-owner">
        <span className="ot-avatar">刘</span>
        <div className="ot-owner-name">
          <b>刘琼</b>
          <span className="muted"> · 设计师 · 本模块只记录该成员的加班与调休</span>
        </div>
        <span className="ot-owner-tip">⏰ 每日标准工时 8 小时 · 9:00–18:00 记 8 小时</span>
      </div>

      <SectionTitle
        hint="总加班时长可手动调整，并自动减去已调休的小时数"
        extra={<button className="btn btn-outline btn-sm" onClick={openTotal}>✎ 手动调整总时长</button>}
      >加班概览</SectionTitle>
      <div className="ot-kpi-grid">
        <StatCard
          label="总加班时长"
          value={<>{formatHours(totalHours)}<span className="ot-unit">小时</span></>}
          tone="blue"
          hint={baseHours !== 0
            ? `记录 ${recordHours} 小时 · 手动调整 ${baseHours > 0 ? '+' : ''}${formatHours(baseHours)} 小时`
            : `共 ${records.length} 条加班记录 · 支持手动调整总时长`}
        />
        <StatCard
          label="折算加班天数"
          value={<>{formatHours(totalDays)}<span className="ot-unit">天</span></>}
          tone="purple"
          hint="按每日 8 小时换算"
        />
        <StatCard
          label="已调休"
          value={<>{formatHours(compHours)}<span className="ot-unit">小时</span></>}
          tone="amber"
          hint={`共 ${comp.length} 笔调休登记`}
        />
        <StatCard
          label="剩余可结算加班"
          value={<>{formatHours(remainHours)}<span className="ot-unit">小时</span></>}
          tone="green"
          hint={`≈ ${formatHours(remainDays)} 天 · 总加班 − 已调休`}
        />
        <StatCard
          label="剩余加班天数"
          value={<>{formatHours(remainDays)}<span className="ot-unit">天</span></>}
          tone="cyan"
          hint="剩余可结算加班 ÷ 8 小时"
        />
      </div>

      {remainHours < 0 && (
        <div className="ot-notice">⚠️ 已调休小时数超过累计加班时长，剩余可结算加班为负值，请核对调休记录。</div>
      )}

      <Card
        title="加班记录"
        subtitle="分别填写开始/结束日期与时间，系统自动计算加班小时数与折算天数，支持跨日期"
        extra={<button className="btn btn-primary btn-sm" onClick={() => openNew('ot')}>＋ 新增加班</button>}
      >
        <div className="ot-calc-note">
          ⏱️ 计算口径：开始、结束可各选日期（例如 11-26 22:00 → 11-27 02:00），按自然日逐段累计；每天 12:00–13:00 午休 1 小时不计入，因此 9:00–18:00 记 8 小时；折算天数 = 加班小时 ÷ 8。也可直接手填小时数覆盖自动计算。
        </div>
        {sortedRecords.length === 0
          ? <EmptyState text="还没有加班记录，点右上角「＋ 新增加班」开始记录" />
          : <div className="ot-list">{sortedRecords.map((r) => renderRow(r, 'ot'))}</div>}
      </Card>

      <Card
        title="调休登记"
        subtitle="可填起止日期时间自动换算小时数（支持跨日期），或直接填写调休小时数"
        extra={<button className="btn btn-outline btn-sm" onClick={() => openNew('comp')}>＋ 登记调休</button>}
      >
        <div className="ot-comp-sum">
          已调休合计 <b>{formatHours(compHours)}</b> 小时（≈ {formatHours(hoursToDays(compHours))} 天）· 剩余可结算加班 <b>{formatHours(remainHours)}</b> 小时
        </div>
        {sortedComp.length === 0
          ? <EmptyState text="还没有调休记录，点「＋ 登记调休」即可扣减" />
          : <div className="ot-list comp">{sortedComp.map((r) => renderRow(r, 'comp'))}</div>}
      </Card>

      <p className="ot-foot">
        口径说明：本模块仅记录刘琼设计师；加班与调休均可按起止日期时间自动计算小时数并支持跨日期，每天 12:00–13:00 午休 1 小时不计入（9:00–18:00 记 8 小时），按每日 8 小时折算天数；总加班时长可在概览中手动调整，剩余可结算加班 = 总加班小时 − 已调休小时。所有记录随云端共享数据库自动同步，其他电脑打开同一链接即可看到。
      </p>

      {editor && (
        <Modal
          title={editor.mode === 'new'
            ? (editor.type === 'ot' ? '新增加班记录' : '登记调休')
            : (editor.type === 'ot' ? '编辑加班记录' : '编辑调休记录')}
          subtitle="可分别选开始/结束日期与时间（支持跨日期）自动计算；也可直接手填小时数"
          width="560px"
          onClose={() => setEditor(null)}
          footer={
            <>
              {editor.mode === 'edit' && (
                <button
                  className="btn btn-danger btn-sm ot-footer-del"
                  onClick={() => { setConfirmDel({ type: editor.type, item: editor.item }); setEditor(null) }}
                >删除</button>
              )}
              <button className="btn btn-ghost" onClick={() => setEditor(null)}>取消</button>
              <button className="btn btn-primary" onClick={save}>保存</button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="开始日期" required>
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label="开始时间" hint="例如 09:00 或 18:30">
              <Input type="time" value={form.start} onChange={set('start')} />
            </Field>
            <Field label="结束日期" hint="可与开始日期不同，跨夜选次日">
              <Input type="date" value={form.endDate} onChange={set('endDate')} />
            </Field>
            <Field label="结束时间" hint="例如 18:00；9:00–18:00 自动记 8 小时">
              <Input type="time" value={form.end} onChange={set('end')} />
            </Field>
            <Field
              label={editor.type === 'ot' ? '加班小时数（可选）' : '调休小时数（可选）'}
              hint="填写后优先于时间段自动计算；留空则按上方时间段计算"
            >
              <Input type="number" min="0" step="0.25" placeholder="留空自动计算" value={form.hours} onChange={set('hours')} />
            </Field>
            <Field label="备注" hint="可选，例如加班事由" wide>
              <Textarea value={form.note} placeholder="例如：康怡年会提案赶稿" onChange={set('note')} />
            </Field>
          </div>

          <div className="ot-preview">
            <span>本次{editor.type === 'ot' ? '加班' : '调休'}</span>
            <b>{formatHours(previewHours)} 小时</b>
            <span>≈ {formatHours(hoursToDays(previewHours))} 天</span>
            {previewSource && <em>{crossDay && !usingManual ? '跨日期 · ' : ''}{previewSource}</em>}
          </div>
          {error && <div className="ot-error">{error}</div>}
        </Modal>
      )}

      {totalOpen && (
        <Modal
          title="手动调整总加班时长"
          subtitle="填写期望的总加班小时数，系统自动换算调整差额；之后新增加班记录仍会自动累加"
          width="480px"
          onClose={() => setTotalOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost btn-sm ot-footer-del" onClick={resetTotal}>恢复自动汇总</button>
              <button className="btn btn-ghost" onClick={() => setTotalOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveTotal}>保存</button>
            </>
          }
        >
          <div className="ot-base-info">
            <div><span>加班记录合计</span><b>{formatHours(recordHours)} 小时</b></div>
            <div><span>当前手动调整</span><b>{baseHours > 0 ? '+' : ''}{formatHours(baseHours)} 小时</b></div>
            <div><span>当前总加班时长</span><b>{formatHours(totalHours)} 小时</b></div>
          </div>
          <div className="form-grid">
            <Field label="总加班时长（小时）" required hint="可填 0 或任意不小于 0 的数值，支持小数" wide>
              <Input type="number" min="0" step="0.25" value={totalInput} onChange={(e) => setTotalInput(e.target.value)} />
            </Field>
          </div>
          <p className="ot-foot">调整差额 = 填写的总时长 − 加班记录合计；调整值与加班记录一同随云端同步，其他设备打开同一链接即可看到。</p>
          {totalError && <div className="ot-error">{totalError}</div>}
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          title={confirmDel.type === 'ot' ? '删除加班记录' : '删除调休记录'}
          message={`确定删除 ${confirmDel.item.date}${confirmDel.item.start && confirmDel.item.end
            ? ` ${confirmDel.item.start} → ${confirmDel.item.endDate && confirmDel.item.endDate !== confirmDel.item.date ? confirmDel.item.endDate + ' ' : ''}${confirmDel.item.end}`
            : ''} 的这条${confirmDel.type === 'ot' ? '加班' : '调休'}记录（${formatHours(confirmDel.item.hours)} 小时）吗？删除后上方汇总会自动重新计算。`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  )
}
