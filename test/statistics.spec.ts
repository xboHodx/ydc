import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { h } from 'koishi'
import sharp from 'sharp'

import { registerCommands } from '../src/commands'
import { createRuntime } from '../src/runtime'
import { buildGuildUserImagePath } from '../src/utils/files'
import { resolveCsmScope } from '../src/utils/argv'

type RegisteredCommand = {
  action?: (...args: any[]) => any
}

function createCommandContext() {
  const commands = new Map<string, RegisteredCommand>()

  const ctx: any = {
    command(definition: string) {
      const name = definition.trim().split(' ')[0]
      const command: RegisteredCommand = {}
      commands.set(name, command)
      return {
        option() {
          return this
        },
        alias(aliasName: string) {
          commands.set(aliasName, command)
          return this
        },
        usage() {
          return this
        },
        action(handler: (...args: any[]) => any) {
          command.action = handler
          return this
        },
      }
    },
    database: {},
    sleep: async () => {},
    on() {},
  }

  return { ctx, commands }
}

function createSession(overrides: Record<string, any> = {}) {
  const sentMessages: string[] = []
  return {
    session: {
      userId: 'master',
      guildId: 'guild-1',
      messageId: 'msg-1',
      event: { timestamp: Date.now() },
      bot: {
        getGuildMember: async () => ({}),
      },
      send: async (message: string) => {
        sentMessages.push(message)
      },
      ...overrides,
    },
    sent: sentMessages,
  }
}

test('csm returns a friendly message when the guild has no records', async () => {
  const { ctx, commands } = createCommandContext()
  let selectCalls = 0
  ctx.database.select = () => ({
    where() {
      return this
    },
    orderBy() {
      return this
    },
    offset() {
      return this
    },
    limit() {
      return this
    },
    async execute() {
      selectCalls += 1
      return selectCalls === 1 ? 0 : []
    },
  })

  registerCommands(ctx, createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  }))

  const command = commands.get('csm')
  assert.ok(command?.action)

  const { session } = createSession()
  const result = await command.action({ session })

  assert.equal(selectCalls, 1)
  assert.match(String(result), /还没有|暂无/)
})

test('dcw new reports failure instead of success when generation throws', async () => {
  const { ctx, commands } = createCommandContext()
  ctx.database.get = async () => {
    throw new Error('boom')
  }
  ctx.database.upsert = async () => ({ inserted: 0, modified: 0 })

  registerCommands(ctx, createRuntime({
    master: 'master',
    self: 'self',
    readers: ['reader'],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  }))

  const command = commands.get('dcw')
  assert.ok(command?.action)

  const { session, sent } = createSession()
  const result = await command.action({
    session,
    options: { new: true },
  })

  await new Promise(resolve => setTimeout(resolve, 0))

  assert.match(String(result), /生成|统计/)
  assert.equal(sent.some(message => message.includes('新的大餐王已诞生')), false)
  assert.equal(sent.some(message => message.includes('失败')), true)
})

test('dcstatistics reports counts for the current guild only', async () => {
  const { ctx, commands } = createCommandContext()
  ctx.database.select = (table: string) => ({
    where() {
      return this
    },
    async execute() {
      return table === 'dc_table' ? 3 : 1
    },
  })

  registerCommands(ctx, createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  }))

  const command = commands.get('dcstatistics')
  assert.ok(command?.action)

  const { session } = createSession()
  const result = await command.action({ session })

  assert.equal(result, '本群共有3条已保存大餐记录和1条待审核大餐记录')
})

test('dcw returns a template fragment for guild king summary', async () => {
  const { ctx, commands } = createCommandContext()
  ctx.database.get = async () => [{
    guild_id: 'guild-1',
    content: {
      weekly_king: {
        id: 'user-weekly',
        times: 2,
        start: new Date('2026-04-01T00:00:00.000Z'),
        end: new Date('2026-04-08T00:00:00.000Z'),
      },
      monthly_king: {
        id: 'user-monthly',
        times: 6,
        start: new Date('2026-03-10T00:00:00.000Z'),
        end: new Date('2026-04-08T00:00:00.000Z'),
      },
    },
  }]

  registerCommands(ctx, createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  }))

  const command = commands.get('dcw')
  assert.ok(command?.action)

  const { session } = createSession()
  const result = await command.action({ session, options: {} })
  const normalized = h.normalize(result).map(String).join('')

  assert.equal(h.normalize(result)[0]?.type, 'template')
  assert.match(normalized, /user-weekly/)
  assert.match(normalized, /user-monthly/)
  assert.match(normalized, /<br\/>/)
})

test('csm fallback returns a template fragment instead of a string literal', async () => {
  const { ctx, commands } = createCommandContext()
  let selectCalls = 0
  ctx.database.select = () => ({
    where() {
      return this
    },
    orderBy() {
      return this
    },
    offset() {
      return this
    },
    limit() {
      return this
    },
    async execute() {
      selectCalls += 1
      return selectCalls === 1 ? 1 : []
    },
  })

  registerCommands(ctx, createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir: 'ydc_files',
    smallReply: false,
    csmScopeDefault: 'guild',
    recordImageMode: 'last',
  }))

  const command = commands.get('csm')
  assert.ok(command?.action)

  const { session } = createSession()
  const result = await command.action({ session })
  const normalized = h.normalize(result).map(String).join('')

  assert.equal(h.normalize(result)[0]?.type, 'template')
  assert.match(normalized, /<at id="master"\/>/)
  assert.match(normalized, /发生了一些事，只能摸了/)
})

test('resolveCsmScope uses config by default and options override it', () => {
  assert.equal(resolveCsmScope('guild', false, false).scope, 'guild')
  assert.equal(resolveCsmScope('global', false, false).scope, 'global')
  assert.equal(resolveCsmScope('global', true, false).scope, 'guild')
  assert.equal(resolveCsmScope('guild', false, true).scope, 'global')
  assert.match(resolveCsmScope('guild', true, true).errorMessage ?? '', /不能同时/)
})

test('csm uses global scope from config and labels out-of-guild records plainly', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ydc-csm-'))
  const externalRecord = {
    id: 1,
    user: 'user-outside',
    channelId: 'guild-2',
    stamp: new Date('2026-04-10T00:00:00.000Z'),
    url: 'https://example.com/image.jpg',
    path: 'sample.jpg',
  }
  const { ctx, commands } = createCommandContext()
  let whereCalls = 0
  ctx.database.select = () => {
    const rows = [externalRecord]
    let filtered = rows
    let offset = 0
    return {
      where() {
        whereCalls += 1
        filtered = rows.filter(row => row.channelId === 'guild-1')
        return this
      },
      orderBy() {
        return this
      },
      offset(value: number) {
        offset = value
        return this
      },
      limit() {
        return this
      },
      async execute(countSelector?: unknown) {
        if (countSelector) {
          return filtered.length
        }
        return filtered.slice(offset, offset + 1)
      },
    }
  }

  const runtime = createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir,
    smallReply: false,
    csmScopeDefault: 'global',
    recordImageMode: 'last',
  })
  const imagePath = buildGuildUserImagePath(runtime.state.paths.root, externalRecord.channelId, externalRecord.user, externalRecord.path)
  await fs.mkdir(path.dirname(imagePath), { recursive: true })
  await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  }).jpeg().toFile(imagePath)

  registerCommands(ctx, runtime)

  const command = commands.get('csm')
  assert.ok(command?.action)

  const { session, sent } = createSession({
    bot: {
      getGuildMember: async () => {
        throw new Error('not in current guild')
      },
    },
  })
  await command.action({ session, options: {} })

  assert.equal(whereCalls, 0)
  assert.equal(sent.length, 1)
  const normalized = h.normalize(sent[0]).map(String).join('')
  assert.doesNotMatch(normalized, /<at id="user-outside"\/>/)
  assert.match(normalized, /其他群的群友/)
  assert.match(normalized, /他的大餐将一直陪伴着我们/)

  await fs.rm(dataDir, { recursive: true, force: true })
})

test('csm guild option overrides global config and keeps current guild mentions', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ydc-csm-'))
  const localRecord = {
    id: 1,
    user: 'user-inside',
    channelId: 'guild-1',
    stamp: new Date('2026-04-10T00:00:00.000Z'),
    url: 'https://example.com/image.jpg',
    path: 'sample.jpg',
  }
  const { ctx, commands } = createCommandContext()
  let whereCalls = 0
  ctx.database.select = () => {
    const rows = [localRecord]
    let filtered = rows
    let offset = 0
    return {
      where() {
        whereCalls += 1
        filtered = rows.filter(row => row.channelId === 'guild-1')
        return this
      },
      orderBy() {
        return this
      },
      offset(value: number) {
        offset = value
        return this
      },
      limit() {
        return this
      },
      async execute(countSelector?: unknown) {
        if (countSelector) {
          return filtered.length
        }
        return filtered.slice(offset, offset + 1)
      },
    }
  }

  const runtime = createRuntime({
    master: 'master',
    self: 'self',
    readers: [],
    dataDir,
    smallReply: false,
    csmScopeDefault: 'global',
    recordImageMode: 'last',
  })
  const imagePath = buildGuildUserImagePath(runtime.state.paths.root, localRecord.channelId, localRecord.user, localRecord.path)
  await fs.mkdir(path.dirname(imagePath), { recursive: true })
  await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  }).jpeg().toFile(imagePath)

  registerCommands(ctx, runtime)

  const command = commands.get('csm')
  assert.ok(command?.action)

  const { session, sent } = createSession()
  await command.action({ session, options: { guild: true } })

  assert.ok(whereCalls > 0)
  const normalized = h.normalize(sent[0]).map(String).join('')
  assert.match(normalized, /<at id="user-inside"\/>/)

  await fs.rm(dataDir, { recursive: true, force: true })
})
