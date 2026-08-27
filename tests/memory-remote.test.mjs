import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { runMemoryCommand } from '../plugins/kstack/scripts/kstack-memory.mjs';

function git(directory, ...args) {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function memoryFixture(options = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-memory-remote-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(path.join(project, '.kstack'), { recursive: true });
  const config = structuredClone(defaultConfig);
  config.project.name = 'memory-remote-fixture';
  config.memory.enabled = true;
  config.memory.bodyDirectory = path.join(parent, options.bodyName || 'body');
  config.memory.indexDirectory = path.join(parent, options.indexName || 'index');
  config.memory.remote = options.remote || path.join(parent, 'remote.git');
  config.memory.namespace = 'memory-remote-fixture';
  const configFile = path.join(project, '.kstack', 'config.json');
  const saveConfig = () => fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  saveConfig();
  return { parent, project, config, configFile, saveConfig };
}

function createBareRemote(parent, name = 'remote.git') {
  const remote = path.join(parent, name);
  fs.mkdirSync(remote, { recursive: true });
  git(remote, 'init', '--bare', '--initial-branch=main');
  return remote;
}

function configureAuthor(repository) {
  git(repository, 'config', 'user.name', 'KStack Test');
  git(repository, 'config', 'user.email', 'kstack-test@example.invalid');
}

function cloneRepository(remote, destination) {
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  git(parent, 'clone', remote, destination);
  configureAuthor(destination);
  return destination;
}

function commitFile(repository, name, content, message) {
  const file = path.join(repository, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  git(repository, 'add', '--all');
  git(repository, 'commit', '-m', message);
  return git(repository, 'rev-parse', 'HEAD');
}

function seedRemote(remote, parent, content = '# Shared memory\n') {
  const writer = path.join(parent, `writer-${path.basename(remote)}`);
  fs.mkdirSync(writer, { recursive: true });
  git(writer, 'init', '-b', 'main');
  configureAuthor(writer);
  git(writer, 'remote', 'add', 'origin', remote);
  const revision = commitFile(writer, 'memory.md', content, 'Seed memory body');
  git(writer, 'push', '-u', 'origin', 'main');
  return { writer, revision };
}

function command(fixture, commandName, approved = [], args = {}) {
  return runMemoryCommand({
    command: commandName,
    config: fixture.configFile,
    ...args,
    approved: new Set(approved)
  });
}

test('connect initializes the body, configures origin, is idempotent, and rejects a mismatched origin', async () => {
  const fixture = memoryFixture();
  createBareRemote(fixture.parent);

  assert.deepEqual(await command(fixture, 'connect'), { status: 'connected', remote: fixture.config.memory.remote });
  assert.ok(fs.existsSync(path.join(fixture.config.memory.bodyDirectory, '.git')));
  assert.equal(git(fixture.config.memory.bodyDirectory, 'remote', 'get-url', 'origin'), fixture.config.memory.remote);
  assert.equal((await command(fixture, 'connect')).status, 'connected');

  git(fixture.config.memory.bodyDirectory, 'remote', 'set-url', 'origin', path.join(fixture.parent, 'other.git'));
  await assert.rejects(command(fixture, 'connect'), /Existing origin does not match memory\.remote/);
});

test('clone copies and validates remote content and refuses a non-empty destination', async () => {
  const fixture = memoryFixture();
  const remote = createBareRemote(fixture.parent);
  seedRemote(remote, fixture.parent, '# Safe remote body\n');

  const cloned = await command(fixture, 'clone', ['clone']);
  assert.equal(cloned.status, 'cloned-and-validated');
  assert.equal(fs.readFileSync(path.join(fixture.config.memory.bodyDirectory, 'memory.md'), 'utf8'), '# Safe remote body\n');

  const occupied = memoryFixture({ remote });
  fs.mkdirSync(occupied.config.memory.bodyDirectory, { recursive: true });
  fs.writeFileSync(path.join(occupied.config.memory.bodyDirectory, 'keep.md'), 'do not overwrite\n');
  await assert.rejects(command(occupied, 'clone', ['clone']), /must be absent or empty before clone/);

  const unsafe = memoryFixture();
  const unsafeRemote = createBareRemote(unsafe.parent);
  seedRemote(unsafeRemote, unsafe.parent, 'api_key=abcdefghijklmnopqrstuvwxyz123456\n');
  await assert.rejects(command(unsafe, 'clone', ['clone']), /rejected by secret scan/);

  // create-private is deliberately outside this suite: it is the external `gh repo create` integration boundary.
});

test('commit stages and commits safe content but blocks secrets present only in the staged snapshot', async () => {
  const fixture = memoryFixture();
  createBareRemote(fixture.parent);
  await command(fixture, 'connect');
  configureAuthor(fixture.config.memory.bodyDirectory);

  fs.writeFileSync(path.join(fixture.config.memory.bodyDirectory, 'decision.md'), '# Safe decision\n');
  const committed = await command(fixture, 'commit', ['commit'], { message: 'Add safe decision' });
  assert.equal(committed.status, 'committed');
  assert.equal(committed.files, 1);
  assert.equal(git(fixture.config.memory.bodyDirectory, 'show', 'HEAD:decision.md'), '# Safe decision');

  const headBefore = git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD');
  const stagedFile = path.join(fixture.config.memory.bodyDirectory, 'staged.md');
  fs.writeFileSync(stagedFile, 'api_key=abcdefghijklmnopqrstuvwxyz123456\n');
  git(fixture.config.memory.bodyDirectory, 'add', 'staged.md');
  fs.writeFileSync(stagedFile, '# Safe working-copy replacement\n');
  git(fixture.config.memory.bodyDirectory, 'update-index', '--assume-unchanged', 'staged.md');
  await assert.rejects(
    command(fixture, 'commit', ['commit'], { message: 'Must not commit secret' }),
    /staged:staged\.md rejected by secret scan/
  );
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD'), headBefore);
  assert.match(git(fixture.config.memory.bodyDirectory, 'show', ':staged.md'), /api_key=/);
});

test('push accepts an ancestor remote and rejects divergence without force-pushing', async () => {
  const fixture = memoryFixture();
  const remote = createBareRemote(fixture.parent);
  seedRemote(remote, fixture.parent);
  await command(fixture, 'clone', ['clone']);
  configureAuthor(fixture.config.memory.bodyDirectory);

  const firstLocalRevision = commitFile(fixture.config.memory.bodyDirectory, 'local.md', '# Local addition\n', 'Local addition');
  const pushed = await command(fixture, 'push', ['fetch', 'push']);
  assert.equal(pushed.status, 'pushed');
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), firstLocalRevision);

  const second = cloneRepository(remote, path.join(fixture.parent, 'second-writer'));
  const remoteRevision = commitFile(second, 'remote.md', '# Remote addition\n', 'Remote addition');
  git(second, 'push', 'origin', 'main');
  commitFile(fixture.config.memory.bodyDirectory, 'divergent.md', '# Divergent local addition\n', 'Divergent local addition');

  await assert.rejects(
    command(fixture, 'push', ['fetch', 'push']),
    /Remote body is not an ancestor of local HEAD/
  );
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), remoteRevision);
});

test('fetch validates without changing the worktree and integrate is clean-worktree, fast-forward-only', async () => {
  const fixture = memoryFixture();
  const remote = createBareRemote(fixture.parent);
  const { writer, revision: baseRevision } = seedRemote(remote, fixture.parent, '# Base\n');
  await command(fixture, 'clone', ['clone']);
  configureAuthor(fixture.config.memory.bodyDirectory);

  const remoteRevision = commitFile(writer, 'memory.md', '# Updated remotely\n', 'Update remote memory');
  git(writer, 'push', 'origin', 'main');
  const fetched = await command(fixture, 'fetch', ['fetch']);
  assert.equal(fetched.status, 'fetched-and-validated');
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD'), baseRevision);
  assert.equal(fs.readFileSync(path.join(fixture.config.memory.bodyDirectory, 'memory.md'), 'utf8'), '# Base\n');
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'FETCH_HEAD'), remoteRevision);

  assert.equal((await command(fixture, 'integrate', ['integrate'])).status, 'fast-forward-integrated');
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD'), remoteRevision);
  assert.equal(fs.readFileSync(path.join(fixture.config.memory.bodyDirectory, 'memory.md'), 'utf8'), '# Updated remotely\n');

  commitFile(writer, 'later.md', '# Later remote content\n', 'Later remote update');
  git(writer, 'push', 'origin', 'main');
  await command(fixture, 'fetch', ['fetch']);
  fs.writeFileSync(path.join(fixture.config.memory.bodyDirectory, 'dirty.md'), '# Dirty local content\n');
  await assert.rejects(command(fixture, 'integrate', ['integrate']), /worktree must be clean/);
});

test('integrate rejects a clean but divergent worktree instead of creating a merge commit', async () => {
  const fixture = memoryFixture();
  const remote = createBareRemote(fixture.parent);
  const { writer } = seedRemote(remote, fixture.parent);
  await command(fixture, 'clone', ['clone']);
  configureAuthor(fixture.config.memory.bodyDirectory);

  commitFile(fixture.config.memory.bodyDirectory, 'local.md', '# Local branch\n', 'Local branch');
  const localRevision = git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD');
  commitFile(writer, 'remote.md', '# Remote branch\n', 'Remote branch');
  git(writer, 'push', 'origin', 'main');
  await command(fixture, 'fetch', ['fetch']);

  await assert.rejects(command(fixture, 'integrate', ['integrate']), /git merge failed/);
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD'), localRevision);
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-list', '--count', 'HEAD'), '2');
});

test('fetch rejects secret-bearing remote content without checking it out', async () => {
  const fixture = memoryFixture();
  const remote = createBareRemote(fixture.parent);
  const { writer, revision: baseRevision } = seedRemote(remote, fixture.parent);
  await command(fixture, 'clone', ['clone']);

  commitFile(writer, 'credentials.md', 'Bearer abcdefghijklmnopqrstuvwxyz123456\n', 'Unsafe remote content');
  git(writer, 'push', 'origin', 'main');
  await assert.rejects(command(fixture, 'fetch', ['fetch']), /FETCH_HEAD:credentials\.md rejected by secret scan/);
  assert.equal(git(fixture.config.memory.bodyDirectory, 'rev-parse', 'HEAD'), baseRevision);
  assert.equal(fs.existsSync(path.join(fixture.config.memory.bodyDirectory, 'credentials.md')), false);
});

test('remote command authority asks for approval and deny cannot be overridden', async (t) => {
  async function authorityFixture(action) {
    const fixture = memoryFixture();
    const remote = createBareRemote(fixture.parent);
    seedRemote(remote, fixture.parent);
    if (action !== 'clone') {
      await command(fixture, 'clone', ['clone']);
      configureAuthor(fixture.config.memory.bodyDirectory);
    }
    return fixture;
  }

  await t.test('clone', async () => {
    const fixture = await authorityFixture('clone');
    await assert.rejects(command(fixture, 'clone'), /memory\.authority\.clone requires explicit approval/);
    assert.equal((await command(fixture, 'clone', ['clone'])).status, 'cloned-and-validated');

    const denied = await authorityFixture('clone');
    denied.config.memory.authority.clone = 'deny';
    denied.saveConfig();
    await assert.rejects(command(denied, 'clone', ['clone']), /memory\.authority\.clone denies this action/);
  });

  await t.test('fetch', async () => {
    const fixture = await authorityFixture('fetch');
    await assert.rejects(command(fixture, 'fetch'), /memory\.authority\.fetch requires explicit approval/);
    assert.equal((await command(fixture, 'fetch', ['fetch'])).status, 'fetched-and-validated');
    fixture.config.memory.authority.fetch = 'deny';
    fixture.saveConfig();
    await assert.rejects(command(fixture, 'fetch', ['fetch']), /memory\.authority\.fetch denies this action/);
  });

  await t.test('integrate', async () => {
    const fixture = await authorityFixture('integrate');
    await command(fixture, 'fetch', ['fetch']);
    await assert.rejects(command(fixture, 'integrate'), /memory\.authority\.integrate requires explicit approval/);
    assert.equal((await command(fixture, 'integrate', ['integrate'])).status, 'fast-forward-integrated');
    fixture.config.memory.authority.integrate = 'deny';
    fixture.saveConfig();
    await assert.rejects(command(fixture, 'integrate', ['integrate']), /memory\.authority\.integrate denies this action/);
  });

  await t.test('commit', async () => {
    const fixture = await authorityFixture('commit');
    fs.writeFileSync(path.join(fixture.config.memory.bodyDirectory, 'authority.md'), '# Authority check\n');
    await assert.rejects(command(fixture, 'commit', [], { message: 'Authority check' }), /memory\.authority\.commit requires explicit approval/);
    assert.equal((await command(fixture, 'commit', ['commit'], { message: 'Authority check' })).status, 'committed');
    fixture.config.memory.authority.commit = 'deny';
    fixture.saveConfig();
    await assert.rejects(command(fixture, 'commit', ['commit'], { message: 'Denied' }), /memory\.authority\.commit denies this action/);
  });

  await t.test('push requires both fetch and push authority', async () => {
    const fixture = await authorityFixture('push');
    await assert.rejects(command(fixture, 'push', ['push']), /memory\.authority\.fetch requires explicit approval/);
    await assert.rejects(command(fixture, 'push', ['fetch']), /memory\.authority\.push requires explicit approval/);
    assert.equal((await command(fixture, 'push', ['fetch', 'push'])).status, 'pushed');

    fixture.config.memory.authority.push = 'deny';
    fixture.saveConfig();
    await assert.rejects(command(fixture, 'push', ['fetch', 'push']), /memory\.authority\.push denies this action/);
    fixture.config.memory.authority.push = 'ask';
    fixture.config.memory.authority.fetch = 'deny';
    fixture.saveConfig();
    await assert.rejects(command(fixture, 'push', ['fetch', 'push']), /memory\.authority\.fetch denies this action/);
  });

  // connect has no authority action in the validated memory schema and is covered separately above.
});
