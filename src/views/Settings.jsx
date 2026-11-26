import React, { useRef, useState } from 'react'
import { useStore, exportJSON } from '../store.js'
import { Card, SectionTitle, Badge, EmptyState, Field, Textarea } from '../components.jsx'

export function SettingsView({ onReset, onImport }) {
  const { state, updateLeaders, updatePlanners, updateExecutors, sync, syncNow } = useStore()
  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [leaderText, setLeaderText] = useState((state.leaders || []).join('\n'))
  const [plannerText, setPlannerText] = useState((state.planners || []).join('\n'))
  const [executorText, setExecutorText] = useState((state.executors || []).join('\n'))
  const parseNames = (text) => text.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.members)) throw new Error('格式不正确')
        onImport(parsed)
        const ot = parsed.overtime || {}
        const otCount = (Array.isArray(ot.records) ? ot.records.length : 0) + (Array.isArray(ot.comp) ? ot.comp.length : 0)
        setMsg(`已导入 ${parsed.projects.length} 个项目、${parsed.members.length} 位成员、${Array.isArray(parsed.todos) ? parsed.todos.length : 0} 条待办、${otCount} 条加班/调休记录`)
      } catch (err) {
        setMsg(`导入失败：${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>数据管理</h1>
          <p>统一云端数据库 · 多电脑自动同步 · 支持备份与恢复</p>
        </div>
      </div>

      {msg && <div className="banner banner-info">{msg}</div>}

      <Card title="云端同步" subtitle="同一链接的所有电脑共用一份数据">
        <div className="cloud-sync">
          <div className="cloud-sync-row">
            <span className={`sync-chip sync-${sync.status}`}>
              {sync.status === 'connecting' ? '☁️ 正在连接云端' : sync.status === 'saving' ? '☁️ 正在同步' : sync.status === 'offline' ? '☁️ 云端未连接' : '☁️ 已同步到云端'}
            </span>
            <span className="muted">
              {sync.message || (sync.lastAt ? `最近同步 ${new Date(sync.lastAt).toLocaleTimeString('zh-CN')}` : '数据自动保存在云端')}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => syncNow()}>立即同步</button>
          </div>
          <div className="cloud-steps">
            <div><b>其他电脑怎么用</b><span>在任意电脑打开同一个工作台链接即可，无需导入导出。页面会自动从云端拉取最新数据，任何改动也会自动上传。项目、成员名录、首页「待办事项」与「加班时长」记录都共用这一份云端数据。</span></div>
            <div><b>首次上线注意</b><span>请先在存有完整数据的那台电脑打开链接，让它把本机数据作为云端基准。若顺序反了，可在有完整数据的电脑用「导入备份」重新导入一次，云端会随之更新。</span></div>
            <div><b>安全边界</b><span>当前为团队共享模式：拿到链接的人都能查看和修改数据，没有账号与权限区分。如需「只有指定成员可修改」，可再加登录功能。</span></div>
            <div><b>同时编辑</b><span>多人同时修改时以最后一次保存为准。页面每 20 秒及切回窗口时自动刷新；建议避免两台电脑同时编辑同一项目。</span></div>
          </div>
        </div>
      </Card>

      <div className="two-col">
        <Card title="数据备份与恢复">
          <div className="setting-block">
            <h4>导出完整备份</h4>
            <p className="muted">导出包含 6 位成员档案、全部项目数据、全部待办事项与全部加班/调休记录的 JSON 文件，可用于迁移或归档。</p>
            <button className="btn btn-primary" onClick={() => exportJSON(state, `素来有调数据备份_${new Date().toISOString().slice(0, 10)}.json`)}>导出 JSON 备份</button>
          </div>
          <div className="setting-block">
            <h4>导入备份</h4>
            <p className="muted">导入将覆盖当前全部数据，并同步覆盖云端（所有电脑都会更新），请先备份。导入文件需为本工作台导出的 JSON 格式。</p>
            <input ref={fileRef} type="file" accept="application/json" onChange={handleFile} style={{ display: 'none' }} />
            <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>选择 JSON 文件导入</button>
          </div>
          <div className="setting-block danger-zone">
            <h4>重置数据</h4>
            <p className="muted">清空所有项目、全部待办事项、全部加班与调休记录，成员恢复为初始状态（刘琼、冯嘉灵、曾少练、刘佳胜、李福文、杨贵玲，固定岗位均为设计师）。此操作会同步清空云端，所有电脑都会一起被清空。</p>
            <button className="btn btn-danger" onClick={onReset}>重置全部数据</button>
          </div>
          <div className="setting-block">
            <h4>项目负责人名录（独立工种）</h4>
            <p className="muted">每行一位姓名，仅用于人名记录，不纳入成员档案与任何统计。</p>
            <Field label="姓名列表" wide>
              <Textarea value={leaderText} onChange={(e) => setLeaderText(e.target.value)} placeholder={'肖镇逵\n陈明生\n邢益铭\n林丹雄\n盛玲玲'} />
            </Field>
            <button className="btn btn-outline mt-sm" onClick={() => {
              const names = parseNames(leaderText)
              updateLeaders(names); setLeaderText(names.join('\n')); setMsg(`负责人名录已保存（${names.length} 人）`)
            }}>保存名录</button>
          </div>
          <div className="setting-block">
            <h4>策划人员名录（独立工种）</h4>
            <p className="muted">每行一位姓名，仅用于人名记录，不纳入成员档案、工作负荷或任何统计。</p>
            <Field label="姓名列表" wide>
              <Textarea value={plannerText} onChange={(e) => setPlannerText(e.target.value)} placeholder={'陈偲韵\n李舒婷\n余颖'} />
            </Field>
            <button className="btn btn-outline mt-sm" onClick={() => {
              const names = parseNames(plannerText)
              updatePlanners(names); setPlannerText(names.join('\n')); setMsg(`策划人员名录已保存（${names.length} 人）`)
            }}>保存名录</button>
          </div>
          <div className="setting-block">
            <h4>执行人员名录（独立工种）</h4>
            <p className="muted">每行一位姓名，仅用于人名记录，不纳入成员档案与任何统计。</p>
            <Field label="姓名列表" wide>
              <Textarea value={executorText} onChange={(e) => setExecutorText(e.target.value)} placeholder={'邱文浩\n毛志旭\n林扬濠'} />
            </Field>
            <button className="btn btn-outline mt-sm" onClick={() => {
              const names = parseNames(executorText)
              updateExecutors(names); setExecutorText(names.join('\n')); setMsg(`执行人员名录已保存（${names.length} 人）`)
            }}>保存名录</button>
          </div>
        </Card>

        <Card title="数据与统计规则说明">
          <div className="rules-list">
            <div><b>存储方式</b><span>数据保存在云端共享数据库，同一链接的所有电脑自动同步；本机浏览器同时保留一份缓存，断网时仍可查看编辑，恢复连接后自动补传。清除浏览器数据不会丢失云端数据，但仍建议定期导出备份。</span></div>
            <div><b>成员档案</b><span>固定 6 位成员：刘琼、冯嘉灵、曾少练、刘佳胜、李福文、杨贵玲，固定岗位均为设计师。<b>仅设计师与项目数据关联并计入统计</b>。项目存的是设计师成员 ID，修改姓名后所有关联项目自动同步显示。</span></div>
            <div><b>负责人 / 策划 / 执行</b><span>三类均为独立工种，只记录姓名，不纳入 6 位成员档案、工作负荷、人员统计或预警。在「数据管理」中维护各自名录，项目表单中按姓名填写或选择。初始名录：负责人 肖镇逵、陈明生、邢益铭、林丹雄、盛玲玲；策划 陈偲韵、李舒婷、余颖；执行 邱文浩、毛志旭、林扬濠。</span></div>
            <div><b>项目编号</b><span>唯一编号，新增时自动生成，不允许重复。</span></div>
            <div><b>项目来源</b><span>直接成交 / 比稿为来源分类；成交状态独立记录。比稿中标后来源仍为比稿，成交状态改为已成交，并计入成交金额。</span></div>
            <div><b>月度项目数</b><span>开始日期 ≤ 当月最后一天且结束日期 ≥ 当月第一天，按唯一项目编号只计一次。</span></div>
            <div><b>成交金额</b><span>仅已成交项目按实际成交日期归属月份，未成交项目不计入；回款金额单独统计。</span></div>
            <div><b>比稿中标率</b><span>已中标 ÷（已中标 + 未中标 + 已放弃），进行中的比稿不计入分母。</span></div>
            <div><b>工作负荷</b><span>Σ（优先级权重 × 人均工时/40 ×（1+任务数/20）× 角色权重），4 个标准单位视为满负荷 100%。</span></div>
            <div><b>加班时长</b><span>仅记录刘琼设计师。加班记录按「结束时间 − 开始时间」自动算小时数（跨夜自动 +24 小时），并按每日 8 小时折算天数；调休按小时数登记，剩余可结算加班 = 总加班小时 − 已调休小时。</span></div>
          </div>
        </Card>
      </div>

      <Card title="平台能力边界">
        <div className="capability-grid">
          <div><Badge color="green">已实现</Badge><span>项目/成员 CRUD、筛选排序、月度统计、比稿转化、负荷分析、预警、日历、甘特图、加班时长与调休、CSV/JSON 导出、自动联动、云端多设备同步</span></div>
          <div><Badge color="amber">有限制</Badge><span>当前为团队共享模式，无账号体系与权限管理（拿到链接即可查看和修改）；多人同时编辑时以最后一次保存为准</span></div>
          <div><Badge color="gray">未实现</Badge><span>邮件/消息推送提醒（仅在页面内展示提醒）、附件上传、审批流、自动任务拆分</span></div>
        </div>
      </Card>
    </div>
  )
}
