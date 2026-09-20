import { h } from 'koishi'

// 只接受单独存在的一段 @ 提及。
export function extractSingleAtId(input: string) {
    const elements = h.parse(input)
    if (elements.length !== 1 || elements[0].type !== 'at') {
        return
    }
    const id = elements[0].attrs.id
    if (typeof id !== 'string') {
        return
    }
    return id
}

// 如果存在多张图片，则返回最后一张。
export function extractLastImageSource(content: string) {
    let result: { src: string; file: string } | undefined
    for (const element of h.parse(content)) {
        if (element.type !== 'img') {
            continue
        }
        const src = element.attrs.src
        const file = element.attrs.file
        if (typeof src !== 'string' || typeof file !== 'string') {
            continue
        }
        result = { src, file }
    }
    return result
}
