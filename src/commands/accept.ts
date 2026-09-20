import fs from 'node:fs'
import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, parseAcceptArgs } from '../utils/argv'
import { buildGuildUserDir, buildGuildUserImagePath, buildTempImagePath } from '../utils/files'

// 批量通过待审核记录。
export function registerAcceptCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const rootPath = runtime.state.paths.root
    const tempPath = runtime.state.paths.temp

    ctx.command('accept [...rawArgs:string]', { hidden: true })
        .alias('ac')
        .action(async (argv, ...rawArgs) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                return h.at(userId) + ' 你不能那么做'
            }
            if (rawArgs.length === 0) {
                return
            }

            const { values: ids, errorMessage } = parseAcceptArgs(rawArgs)
            if (ids.length === 0) {
                return errorMessage.trimStart() || '没有有效序号'
            }

            let inserted = 0
            const items = await ctx.database.get('pending_dc_table', { id: ids })
            for (const item of items) {
                const guildUserDir = buildGuildUserDir(rootPath, item.channelId, item.user)
                if (!fs.existsSync(guildUserDir)) {
                    fs.mkdirSync(guildUserDir, { recursive: true })
                }
                fs.copyFileSync(
                    buildTempImagePath(tempPath, item.path),
                    buildGuildUserImagePath(rootPath, item.channelId, item.user, item.path),
                )
            }
            const result = await ctx.database.upsert('dc_table', items)
            inserted = (result.inserted ?? 0) + (result.modified ?? 0)
            await ctx.database.remove('pending_dc_table', { id: ids })
            return session.send(`${inserted}/${ids.length}条大餐记录已加入${errorMessage}`)
        })
}
