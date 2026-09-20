import path from 'node:path'

// 根据文件扩展名推断图片 MIME。
export function qqImageMime(filename: string) {
    const ext = path.extname(filename).toLowerCase()
    if (ext === '.png') {
        return 'image/png'
    }
    if (ext === '.bmp') {
        return 'image/bmp'
    }
    return 'image/jpeg'
}

// 生成某个群成员的大餐目录路径。
export function buildGuildUserDir(rootPath: string, guildId: string, userId: string) {
    return path.join(rootPath, guildId, userId)
}

// 生成某个群成员的大餐图片路径。
export function buildGuildUserImagePath(rootPath: string, guildId: string, userId: string, filename: string) {
    return path.join(buildGuildUserDir(rootPath, guildId, userId), filename)
}

// 生成临时图片路径。
export function buildTempImagePath(tempPath: string, filename: string) {
    return path.join(tempPath, filename)
}
