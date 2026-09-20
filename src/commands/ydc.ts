import fs from 'node:fs'
import { Context, h } from 'koishi'
import sharp from 'sharp'

import type { RuntimeContext } from '../runtime'
import type { ImageMessagePayload } from '../types'

import { ensureSession } from '../utils/argv'
import { buildGuildUserImagePath, buildTempImagePath } from '../utils/files'
import { extractLastImageSource, extractSingleAtId } from '../utils/message'
import { getGuildLock, setGuildLock } from '../runtime'

// 记录一条新的大餐待审核记录。
export function registerYdcCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const rootPath = runtime.state.paths.root
    const tempPath = runtime.state.paths.temp

    ctx.command('ydc [arg0:string]', '记录群友大餐瞬间')
        .alias('ydc?')
        .usage('回复一个包含大餐图片的发言，ydc \n如果这张图不是大餐人发的，可以在后面加上对大餐人的at')
        .action(async (argv, arg0) => {
            const session = ensureSession(argv)
            const guildId = session.guildId
            if (guildId == null) {
                return '只能在群聊中使用'
            }
            const target = session.quote
            if (target == null) {
                return '你必须引用一条大餐'
            }
            const targetUser = target.user
            if (targetUser == null) {
                return '你必须引用一条大餐'
            }

            let dinerId = targetUser.id
            if (arg0) {
                const atId = extractSingleAtId(arg0)
                if (atId) {
                    dinerId = atId
                }
            }

            const stamp = session.event.timestamp
            let url = ''
            let file = ''
            const image = extractLastImageSource(target.content ?? '')
            if (image) {
                url = image.src
                file = image.file
                const metadataFix = file.match(/\.(.+?\..+?)$/)
                if (metadataFix) {
                    file = metadataFix[1]
                }
            }
            if (url.length == 0) {
                return '引用的大餐消息必须包含一张大餐图片'
            }
            if (getGuildLock(runtime.state.locks.ydc, guildId)) {
                return '正在添加大餐记录...， 请重试'
            }

            let om: ImageMessagePayload = [url]
            const result = await ctx.database.get('dc_table', {
                url,
                user: dinerId,
                path: file,
            })
            if (result.length > 0) {
                if (cfg.smallReply) {
                    om = [await sharp(buildGuildUserImagePath(rootPath, guildId, dinerId, file)).resize(200).jpeg().toBuffer(), 'image/jpeg']
                }
                return h('p', h.at(dinerId), '的大餐', h.image(...om), '早就被记录了！')
            }

            setGuildLock(runtime.state.locks.ydc, guildId, true)
            void (async () => {
                try {
                    const pendingRecords = await ctx.database.get('pending_dc_table', {
                        url,
                        user: dinerId,
                        path: file,
                    })
                    if (pendingRecords.length > 0) {
                        if (cfg.smallReply) {
                            om = [await sharp(buildTempImagePath(tempPath, file)).resize(200).jpeg().toBuffer(), 'image/jpeg']
                        }
                        await session.send(h('p', h.at(dinerId), '的大餐', h.image(...om), '早就被记录到待审核了！'))
                        return
                    }

                    const response = await fetch(url)
                    const buffer = await response.arrayBuffer()
                    fs.writeFileSync(buildTempImagePath(tempPath, file), Buffer.from(buffer))
                    await ctx.database.create('pending_dc_table', {
                        channelId: guildId,
                        user: dinerId,
                        url,
                        stamp: new Date(stamp),
                        path: file,
                    })
                    if (cfg.smallReply) {
                        om = [await sharp(buildTempImagePath(tempPath, file)).resize(200).jpeg().toBuffer(), 'image/jpeg']
                    }
                    await session.send(h('p', h.at(dinerId), '的大餐', h.image(...om), '已经被添加到待审核'))
                } finally {
                    setGuildLock(runtime.state.locks.ydc, guildId, false)
                }
            })()
        })
}
