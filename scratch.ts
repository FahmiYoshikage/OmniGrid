import { prep, getDb } from './src/lib/db/client';
import { nodesRepo } from './src/lib/db/repos/nodes';
import { buildAuth } from './src/lib/ssh/manager';

const nodes = nodesRepo.list();
console.log('Nodes:', nodes.length);
for (const node of nodes) {
    try {
        const auth = buildAuth(node);
        console.log(node.name, 'Auth OK');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(node.name, 'Auth error:', message);
    }
}
