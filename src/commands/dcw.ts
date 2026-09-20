import { Context, h } from 'koishi'

import type { DCKingTable } from '../database'
import type { GuildCountMap } from '../types'
import type { RuntimeContext } from '../runtime'

import { ensureSession, getOption } from '../utils/argv'
import { getGuildLock, setGuildLock } from '../runtime'

// 统计并查询每周、每月大餐王。
export function registerDcwCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config

    ctx.command('dcw', '查看上一赛季的大餐王')
        .option('new', '评选新的大餐王', { hidden: true })
        .action(async (argv) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            const isNew = !!getOption(argv, 'new')
            if (isNew) {
                if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                    return h.at(userId) + ' 你不能那么做'
                }
                const lockKey = session.guildId ?? '__global__'
                const day = 1000 * 60 * 60 * 24
                const stamp = session.event.timestamp
                const lastWeek = new Date(stamp - day * 7)
                const lastMonth = new Date(stamp - day * 30)
                const now = new Date(stamp)
                const guildCounts: Record<string, GuildCountMap> = {}
                if (getGuildLock(runtime.state.locks.dckingGen, lockKey)) {
                    return '大餐王正在统计中...'
                }
                setGuildLock(runtime.state.locks.dckingGen, lockKey, true)

                void (async () => {
                    try {
                        const dcRecords = await ctx.database.get('dc_table', {
                            stamp: { $gt: lastMonth },
                        })
                        for (const record of dcRecords) {
                            if (!guildCounts[record.channelId]) {
                                guildCounts[record.channelId] = { weekly: {}, monthly: {} }
                            }
                            const monthlyCounts = guildCounts[record.channelId].monthly
                            if (!monthlyCounts[record.user]) {
                                monthlyCounts[record.user] = 0
                            }
                            monthlyCounts[record.user] += 1

                            if (record.stamp < lastWeek) {
                                continue
                            }
                            const weeklyCounts = guildCounts[record.channelId].weekly
                            if (!weeklyCounts[record.user]) {
                                weeklyCounts[record.user] = 0
                            }
                            weeklyCounts[record.user] += 1
                        }

                        const dcKingTables: DCKingTable[] = []
                        for (const [guildId, guildCount] of Object.entries(guildCounts)) {
                            let weeklyWinnerCount = 0
                            let weeklyWinnerId = ''
                            let monthlyWinnerCount = 0
                            let monthlyWinnerId = ''

                            for (const [uid, times] of Object.entries(guildCount.weekly)) {
                                if (times > weeklyWinnerCount) {
                                    weeklyWinnerId = uid
                                    weeklyWinnerCount = times
                                }
                            }
                            for (const [uid, times] of Object.entries(guildCount.monthly)) {
                                if (times > monthlyWinnerCount) {
                                    monthlyWinnerId = uid
                                    monthlyWinnerCount = times
                                }
                            }

                            if (weeklyWinnerId.length > 0 && monthlyWinnerId.length > 0) {
                                dcKingTables.push({
                                    guild_id: guildId,
                                    content: {
                                        weekly_king: {
                                            start: lastWeek,
                                            end: now,
                                            id: weeklyWinnerId,
                                            times: weeklyWinnerCount,
                                        },
                                        monthly_king: {
                                            start: lastMonth,
                                            end: now,
                                            id: monthlyWinnerId,
                                            times: monthlyWinnerCount,
                                        },
                                    },
                                })
                            }
                        }

                        await ctx.database.upsert('dc_king', dcKingTables)
                        await session.send('新的大餐王已诞生')
                    } catch {
                        await session.send('大餐王统计失败')
                    } finally {
                        setGuildLock(runtime.state.locks.dckingGen, lockKey, false)
                    }
                })()

                return '生成本月大餐王...'
            } else {
                const guildId = session.guildId
                if (guildId == null) {
                    return '只能在群聊中使用'
                }
                const result = await ctx.database.get('dc_king', { guild_id: guildId })
                if (result.length === 0) {
                    return '大餐王待统计...'
                }
                const weeklyKing = result[0].content.weekly_king
                const monthlyKing = result[0].content.monthly_king
                const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
                const locale = 'zh-CN'
                return h('template', [
                    `一周大餐王(${new Date(weeklyKing.start).toLocaleDateString(locale, options)}~${new Date(weeklyKing.end).toLocaleDateString(locale, options)}):`, h('br'),
                    h.at(weeklyKing.id), ` 大餐${weeklyKing.times}次`, h('br'),
                    h('br'),
                    `一月大餐王(${new Date(monthlyKing.start).toLocaleDateString(locale, options)}~${new Date(monthlyKing.end).toLocaleDateString(locale, options)}):`, h('br'),
                    h.at(monthlyKing.id), ` 大餐${monthlyKing.times}次`,
                ])
            }
        })
}
