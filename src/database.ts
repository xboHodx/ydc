import { Context, Field } from 'koishi'

declare module 'koishi' {
    // 为 Koishi 数据库扩展插件表定义。
    interface Tables {
        dc_table: DCTable,
        pending_dc_table: DCTable,
        dc_king: DCKingTable,
    }
}

// 单条大餐记录的数据结构。
export interface DCTable {
    id: number
    user: string
    channelId: string
    stamp: Date
    url: string
    path: string
}

// 大餐王统计结果的数据结构。
export interface DCKing {
    monthly_king: {
        id: string,
        times: number,
        start: Date,
        end: Date
    }
    weekly_king: {
        id:string,
        times: number,
        start: Date,
        end: Date
    }
}

// 大餐王表的数据库行结构。
export interface DCKingTable {
    guild_id: string
    content: DCKing
}

// 注册插件依赖的三张数据表。
export function create_dc_tables(ctx: Context){
    const dc_model:Field.MapField = {
        id: {
            type: 'unsigned',
            length: 8,
        },
        user: {
            type: 'string',
            length: 128
        },
        channelId: {
            type: 'string',
            length: 128,
        },
        stamp: {
            type: "timestamp"
        },
        url: {
            type: "string",
            length: 2048
        },
        path: {
            type: "string",
            length: 512
        },
    };
    const dc_config = {
        autoInc: true,
    };
    ctx.model.extend('dc_table',dc_model, dc_config);
    ctx.model.extend('pending_dc_table',dc_model, dc_config);

    const dc_king_model:Field.MapField = {
        guild_id: "string",
        content: "json"
    }
    ctx.model.extend('dc_king',dc_king_model, {primary: "guild_id"});
}
