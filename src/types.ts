import type { Buffer } from 'node:buffer'
import type { Dict } from 'koishi'

// 直接引用远程图片时的消息载荷。
type ImageMessageTextPayload = [data: string, attrs?: Dict]

// 发送本地图片缓冲区时的消息载荷。
type ImageMessageBinaryPayload = [data: ArrayBuffer | Buffer | ArrayBufferView, type: string, attrs?: Dict]

// 大餐图片消息可用的统一载荷类型。
export type ImageMessagePayload = ImageMessageTextPayload | ImageMessageBinaryPayload
