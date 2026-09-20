import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession } from '../utils/argv'

// 批量拒绝待审核记录。
export function registerDenyCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config

    ctx.command('deny [...args:number]', { hidden: true })
        .alias('dn')
        .action(async (argv, ...args) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                return h.at(userId) + ' 你不能那么做'
            }
            if (args.length === 0) {
                return
            }
            const result = await ctx.database.remove('pending_dc_table', { id: args })
            return session.send(`${result.removed}/${args.length}条大餐记录已拒绝`)
        })
}
