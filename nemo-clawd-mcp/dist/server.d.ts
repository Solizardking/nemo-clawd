/**
 * nemoclawd MCP Server
 *
 * xAI Grok powered Solana agentic tools with 32 MCP tools.
 * Connects to Helius RPC/DAS and xAI Grok API for autonomous trading.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export declare const SERVER_NAME: string;
export declare const SERVER_VERSION = "0.1.0";
export declare const TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            token: {
                type: string;
                description: string;
            };
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            address: {
                type: string;
                description: string;
            };
            token?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            address: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            token?: undefined;
            query?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            id: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            url: {
                type: string;
                description: string;
            };
            address: {
                type: string;
                description: string;
            };
            token?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            task: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            tier: {
                type: string;
                enum: string[];
                description: string;
            };
            token?: undefined;
            address?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            content: {
                type: string;
                description: string;
            };
            tier: {
                type: string;
                enum: string[];
                description: string;
            };
            source: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            mint: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            mint: {
                type: string;
                description: string;
            };
            amount: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sort: {
                type: string;
                enum: string[];
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            limit: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            message: {
                type: string;
                description: string;
            };
            system: {
                type: string;
                description: string;
            };
            stream: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            imageUrl: {
                type: string;
                description: string;
            };
            question: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            prompt: {
                type: string;
                description: string;
            };
            n: {
                type: string;
                description: string;
            };
            token?: undefined;
            address?: undefined;
            query?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            mode?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            mode: {
                type: string;
                enum: string[];
                description: string;
            };
            token?: undefined;
            address?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            agentCount?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            agentCount: {
                type: string;
                enum: number[];
                description: string;
            };
            token?: undefined;
            address?: undefined;
            type?: undefined;
            limit?: undefined;
            id?: undefined;
            url?: undefined;
            task?: undefined;
            tier?: undefined;
            content?: undefined;
            source?: undefined;
            mint?: undefined;
            amount?: undefined;
            sort?: undefined;
            message?: undefined;
            system?: undefined;
            stream?: undefined;
            imageUrl?: undefined;
            question?: undefined;
            prompt?: undefined;
            n?: undefined;
            mode?: undefined;
        };
        required: string[];
    };
})[];
export declare function createNemoclawdMcpServer(): Server;
//# sourceMappingURL=server.d.ts.map