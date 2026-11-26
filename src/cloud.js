import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import { publicConfig } from './cloudConfig.js'

// 全团队共用一条状态记录：任何设备打开同一链接，读写的都是这一条。
export const STATE_ROW_ID = 'main'

// 整个应用只初始化一次客户端，所有模块复用这个实例。
export const cloud = createWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
})

export function isValidState(s) {
  return !!s && typeof s === 'object' && Array.isArray(s.projects) && Array.isArray(s.members)
}

// 读取云端共享状态；云端还没有记录时返回 null。
export async function fetchCloudState() {
  const { data, error } = await cloud.database
    .from('workbench_state')
    .select('id, data, rev, writer, updated_at')
    .eq('id', STATE_ROW_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    state: data.data,
    rev: Number(data.rev) || 1,
    writer: data.writer || '',
    updatedAt: data.updated_at,
  }
}

// 把整份工作台状态写入云端共享记录（存在则更新）。
export async function saveCloudState(state, rev, writer) {
  const { data, error } = await cloud.database
    .from('workbench_state')
    .upsert(
      {
        id: STATE_ROW_ID,
        data: state,
        rev,
        writer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, rev')
  if (error) throw error
  // 写入被访问策略拦截时不会报错，只会返回空数组，必须显式识别。
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('云端未接受写入（访问策略未放行）')
  }
  return true
}
