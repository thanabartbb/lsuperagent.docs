import test from 'node:test';
import assert from 'node:assert/strict';
import { githubProposal } from '../src/index.js';

test('chat exposes only supported GitHub proposals and parses arguments for user approval', () => {
  const args = { name: 'demo', description: 'starter repository' };
  assert.deepEqual(githubProposal({ output: [{ type: 'function_call', name: 'create_repository', arguments: JSON.stringify(args) }] }), { name: 'create_repository', arguments: args });
  assert.equal(githubProposal({ output: [{ type: 'function_call', name: 'delete_repository', arguments: '{}' }] }), null);
  assert.equal(githubProposal({ output: [{ type: 'function_call', name: 'commit_files', arguments: '{bad json' }] }), null);
});
