import { Schema } from 'koishi'

export type CsmScope = 'guild' | 'global'

// 插件的用户可配置项。
export interface Config {
    master: string
    self: string
    readers: string[]
    dataDir: string
    smallReply: boolean
    csmScopeDefault: CsmScope
}

export const ConfigSchema: Schema<Config> = Schema.object({
    master: Schema.string().default("").comment("主人"),
    self: Schema.string().default("").comment("机器人账号"),
    readers: Schema.array(Schema.string().required().role("link")).description("其他审核人"),
    dataDir: Schema.string().default("ydc_files").comment("本地储存路径"),
    smallReply: Schema.boolean().default(false).comment("是否启用小图回复模式"),
    csmScopeDefault: Schema.union(['guild', 'global']).default('guild').description('csm 默认查找范围')
})

export const Config = ConfigSchema
