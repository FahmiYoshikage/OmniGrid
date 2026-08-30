import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'ssh2';
import { nodesRepo, type NodeRow } from '@/lib/db/repos/nodes';
import { buildAuth } from '@/lib/ssh/manager';
import { createHostVerifier } from '@/lib/ssh/host-verifier';

export const runtime = 'nodejs';

const execAsync = promisify(exec);

async function execSsh(node: NodeRow, command: string, workspaceId: string, actor: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const client = new Client();
        let stdout = '';

        let auth;
        try {
            auth = buildAuth(node, workspaceId);
        } catch (e) {
            return reject(e);
        }

        const { methodLabel: _methodLabel, ...connectAuth } = auth;
        void _methodLabel;

        client.on('ready', () => {
            client.exec(command, (err, stream) => {
                if (err) {
                    client.end();
                    return reject(err);
                }
                stream.on('data', (data: Buffer) => {
                    stdout += data.toString('utf8');
                });
                stream.on('close', () => {
                    client.end();
                    resolve(stdout);
                });
            });
        });

        client.on('error', (err) => {
            client.end();
            reject(err);
        });

        client.connect({
            host: node.hostname,
            port: node.ssh_port,
            hostHash: 'sha256',
            hostVerifier: createHostVerifier(workspaceId, node.id, actor),
            readyTimeout: 10000,
            ...connectAuth,
        });
    });
}

export async function GET() {
    const { user, response } = await requireApiPermission("containers.manage");
    if (response) return response;

    const allContainers: unknown[] = [];

    // 1. Scan Local Host
    try {
        const { stdout } = await execAsync(
            `docker ps --filter network=omnigrid-net --format '{{json .}}'`,
            { timeout: 5000 }
        );
        const localContainers = parseDockerOutput(stdout, 'Local Server');
        allContainers.push(...localContainers);
    } catch (err: unknown) {
        console.error(
            '[uptime] docker discover local failed (ignoring):',
            err instanceof Error ? err.message : String(err)
        );
    }

    // 2. Scan all managed nodes via SSH
    let nodes: ReturnType<typeof nodesRepo.list> = [];
    try {
        nodes = nodesRepo.list(user.workspaceId);
    } catch (err: unknown) {
        console.error('[uptime] failed to list nodes:', err instanceof Error ? err.message : String(err));
    }

    const scanPromises = nodes.map(async (node) => {
        try {
            const stdout = await execSsh(
                node,
                `docker ps --filter network=omnigrid-net --format '{{json .}}'`,
                user.workspaceId,
                user.username,
            );
            const nodeContainers = parseDockerOutput(stdout, node.name);
            allContainers.push(...nodeContainers);
        } catch (err: unknown) {
            console.error(
                `[uptime] docker discover on node ${node.name} failed (ignoring):`,
                err instanceof Error ? err.message : String(err)
            );
        }
    });

    await Promise.allSettled(scanPromises);

    return NextResponse.json({ containers: allContainers });
}

function parseDockerOutput(stdout: string, sourceName: string) {
    return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            try {
                const parsed = JSON.parse(line);
                return {
                    id: parsed.ID,
                    name: parsed.Names,
                    image: parsed.Image,
                    state: parsed.State,
                    status: parsed.Status,
                    ports: parsed.Ports,
                    source: sourceName,
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}
