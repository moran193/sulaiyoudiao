import React, { useState, useEffect, useRef } from 'react'
import { StoreProvider, useStore, exportJSON } from './store.js'
import { DashboardView } from './views/Dashboard.jsx'
import { MembersView, MemberDetailView } from './views/Members.jsx'
import { ProjectsView, ProjectDetailView } from './views/Projects.jsx'
import { MonthlyView } from './views/Monthly.jsx'
import { ResourcesView } from './views/Resources.jsx'
import { ScheduleView } from './views/Schedule.jsx'
import { MemberStatsView } from './views/MemberStats.jsx'
import { OvertimeView } from './views/Overtime.jsx'
import { SettingsView } from './views/Settings.jsx'
import { ConfirmDialog } from './components.jsx'

const NAV = [
  { key: 'dashboard', label: '首页', icon: '🏡', group: '总览' },
  { key: 'projects', label: '项目管理', icon: '📋', group: '业务管理' },
  { key: 'schedule', label: '项目排期', icon: '🗓️', group: '业务管理' },
  { key: 'memberStats', label: '成员统计', icon: '📊', group: '业务管理' },
  { key: 'overtime', label: '加班时长', icon: '⏰', group: '业务管理' },
  { key: 'members', label: '团队成员', icon: '👥', group: '业务管理', hidden: true },
  { key: 'monthly', label: '月度经营统计', icon: '📈', group: '业务管理', hidden: true },
  { key: 'resources', label: '团队资源调配', icon: '🧩', group: '业务管理', hidden: true },
  { key: 'settings', label: '数据管理', icon: '🗂️', group: '系统' },
]

function syncLabel(sync) {
  if (sync.status === 'connecting') return '正在连接云端…'
  if (sync.status === 'saving') return '正在同步到云端…'
  if (sync.status === 'offline') return sync.message || '云端未连接 · 仅本机保存'
  return '已同步到云端 · 多设备共用'
}

function AppInner() {
  const { state, replaceState, resetAll, sync, syncNow } = useStore()
  const [page, setPage] = useState('dashboard')
  const [memberId, setMemberId] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const [editProjectId, setEditProjectId] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3200)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.members)) throw new Error('文件格式不正确')
        replaceState(parsed)
        const ot = parsed.overtime || {}
        const otCount = (Array.isArray(ot.records) ? ot.records.length : 0) + (Array.isArray(ot.comp) ? ot.comp.length : 0)
        showToast(`导入成功：${parsed.projects.length} 个项目、${parsed.members.length} 位成员、${Array.isArray(parsed.todos) ? parsed.todos.length : 0} 条待办、${otCount} 条加班/调休记录`)
      } catch (err) {
        showToast(`导入失败：${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const navigate = (key) => {
    setPage(key)
    setMemberId(null)
    setProjectId(null)
    setEditProjectId(null)
    setSidebarOpen(false)
  }

  const openMember = (id) => { setMemberId(id); setProjectId(null); setPage('members') }
  const openProject = (id) => { setProjectId(id); setMemberId(null); setPage('projects') }
  const editProject = (id) => { setEditProjectId(id); setMemberId(null); setProjectId(null); setPage('projects') }

  const groups = [...new Set(NAV.map((n) => n.group))]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><img src="./avatar.jpg" alt="素来有调" /></div>
          <div>
            <h1>素来有调</h1>
            <span>SU LAI YOU DIAO</span>
          </div>
        </div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g}>
              <div className="nav-group-label">{g}</div>
              {NAV.filter((n) => n.group === g && !n.hidden).map((n) => (
                <button key={n.key} className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => navigate(n.key)}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="side-status">
            <span className={`pulse ${sync.status === 'offline' ? 'offline' : ''}`} />
            {syncLabel(sync)}
          </div>
          <div className="side-meta">{state.projects.length} 个项目 · 6 位成员</div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-title">{NAV.find((n) => n.key === page)?.label || '工作台'}</div>
          <div className="topbar-right">
            <span className="topbar-date">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
            <button
              className={`sync-chip sync-${sync.status}`}
              title={sync.message || '点击立即与云端同步'}
              onClick={() => syncNow()}
            >
              {sync.status === 'connecting' ? '☁️ 连接中' : sync.status === 'saving' ? '☁️ 同步中' : sync.status === 'offline' ? '☁️ 未连接' : '☁️ 已同步'}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>导入数据</button>
            <button className="btn btn-outline btn-sm" onClick={() => exportJSON(state, `素来有调数据备份_${new Date().toISOString().slice(0, 10)}.json`)}>导出数据</button>
          </div>
        </header>

        <div className="content">
          {page === 'dashboard' && <DashboardView onOpenProject={openProject} onOpenMember={openMember} onNavigate={navigate} />}
          {page === 'members' && (memberId
            ? <MemberDetailView memberId={memberId} onBack={() => setMemberId(null)} />
            : <MembersView onOpenMember={openMember} />)}
          {page === 'projects' && (projectId
            ? <ProjectDetailView projectId={projectId} onBack={() => setProjectId(null)} onEdit={editProject} />
            : <ProjectsView onOpenProject={openProject} initialEditId={editProjectId} onEditHandled={() => setEditProjectId(null)} />)}
          {page === 'monthly' && <MonthlyView />}
          {page === 'resources' && <ResourcesView onOpenMember={openMember} />}
          {page === 'schedule' && <ScheduleView onOpenProject={openProject} />}
          {page === 'memberStats' && <MemberStatsView onOpenProject={openProject} />}
          {page === 'overtime' && <OvertimeView />}
          {page === 'settings' && <SettingsView onReset={() => setConfirmReset(true)} onImport={replaceState} />}
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}

      {confirmReset && (
        <ConfirmDialog
          title="重置全部数据"
          message="将清空所有项目数据、全部待办事项、全部加班与调休记录，并把 6 位成员恢复为初始状态（刘琼、冯嘉灵、曾少练、刘佳胜、李福文、杨贵玲，固定岗位均为设计师）。此操作会同步清空云端，所有电脑上的工作台都会一起被清空，且不可撤销，请先导出备份。"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { resetAll(); setConfirmReset(false); navigate('dashboard') }}
        />
      )}
    </div>
  )
}

export default function App() {
  return <StoreProvider><AppInner /></StoreProvider>
}
