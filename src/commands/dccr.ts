import fs from 'node:fs'
import { $, Context, Random, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, getOption } from '../utils/argv'
import { buildGuildUserImagePath, qqImageMime } from '../utils/files'
import { extractSingleAtId } from '../utils/message'

// 查询某人的历史大餐罪证。
export function registerDccrCommand(ctx: Context, runtime: RuntimeContext) {
    const rootPath = runtime.state.paths.root

    ctx.command('dccr <arg0:string>', '大餐criminal record')
        .option('noramdom', '-nr')
        .usage('dccr @罪人 ')
        .action(async (argv, arg0) => {
            const session = ensureSession(argv)
            if (!arg0) {
                return '错误用法'
            }
            const rand = !getOption(argv, 'noramdom')
            const guildId = session.guildId
            if (guildId == null) {
                return '只能在群聊中使用'
            }
            const userId = extractSingleAtId(arg0)
            if (!userId) {
                return '错误用法'
            }

            const records = await ctx.database.select('dc_table')
                .where(row => $.and($.eq(row.user, userId), $.eq(row.channelId, guildId)))
                .orderBy(row => row.stamp, 'desc')
                .execute()

            if (records.length == 0) {
                return h('p', h.at(userId), '无罪')
            }

            let record = records[0]
            if (rand) {
                record = Random.pick(records)
            }
            const buffer = fs.readFileSync(buildGuildUserImagePath(rootPath, guildId, userId, record.path))
            const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
            const locale = 'zh-CN'
            const otherGuilt = records.length === 1
                ? '除此之外是清白的，暂时'
                : `除此之外还有${records.length - 1}条罪证`
            return h('p', h.at(userId), `于${new Date(record.stamp).toLocaleDateString(locale, options)}`, '的罪证在此:', h.image(buffer, qqImageMime(record.path)), otherGuilt)
        })
}
