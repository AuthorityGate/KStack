#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, findConfig, readKStackConfig } from './kstack-config.mjs';
import { assertOutboundSecretScan, claudeInvocationArgs, readCapped, runJointProcesses, runProcess, sanitize } from './kstack-provider-runner.mjs';
import { extractReview, groundingReviewResponseSchema, reviewResponseSchema, sha256 } from './kstack-review-schema.mjs';
import { buildDecisionPacket, frameDecisionPacket } from './kstack-citation-grounding.mjs';
import { canonicalJson, readCitationGroundingModeSelectorV1 } from './kstack-citation-state.mjs';
import { authorizeCitationProviderInputsV1, prepareCitationProviderStagingV1, qualifyOrdinaryCitationAdvisoryV1, sweepCitationStagingV1 } from './kstack-citation-runtime.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) throw new Error(`Unexpected argument: ${current}`);
    const key = current.slice(2);
    if (key === 'help') args.help = true;
    else args[key] = argv[++index];
  }
  return args;
}

function loadConfig(projectRoot, explicitPath) {
  const file = explicitPath ? path.resolve(explicitPath) : findConfig(projectRoot);
  if (!file) return { file: null, config: structuredClone(defaultConfig) };
  const config = readKStackConfig(file);
  return { file, config };
}

function reviewerPrompt(prompt, invocationId, designDigest, groundingMode) {
  const grounding = groundingMode === 'advisory'
    ? '\n- Use v2 {text, groundKind} items for citable content. Every declared assertion in a failed check, security finding, material dissent, recommendation, or present strongest objection must target at least one citation. quotedText must reproduce an exact contiguous excerpt from one source-content span; sourceId is optional. Citation grounding is an anchor-existence check, not semantic proof.'
    : '';
  return `You are one independent reviewer in a dual-model design decision.\n\nRules:\n- Use only the supplied decision packet. Do not inspect or edit files, call tools, commit, push, deploy, install software, or change external state.\n- Do not assume the other reviewer agrees.\n- Separate observed evidence from inference.\n- Identify objective conflicts, missing constraints, failure modes, security findings, material dissent, and verification needs.\n- Return only JSON matching the required schema. failedChecks, securityFindings, materialDissent, and unresolvedQuestions must describe current unresolved items only.\n- Confidence is an integer from 0 to 100 expressing readiness to implement this exact design.${grounding}\n\nInvocation: ${invocationId}\nDesign SHA-256: ${designDigest}\n\nDecision or review request:\n${prompt}`;
}

function writeRaw(outDir, name, raw, stderr, retainRaw, redact) {
  const clean = (value) => redact ? sanitize(value) : value;
  if (retainRaw) fs.writeFileSync(path.join(outDir, `${name}.md`), clean(raw), { mode: 0o600 });
  if (stderr) fs.writeFileSync(path.join(outDir, `${name}.stderr.log`), clean(stderr), { mode: 0o600 });
}

function bindEnvelope({ reviewer, review, rawOutput, invocationId, designDigest, packetBinding }) {
  const envelope = {
    schemaVersion: 1,
    reviewer,
    invocationId,
    designDigest,
    rawOutputSha256: sha256(rawOutput),
    review
  };
  if (packetBinding) {
    envelope.schemaVersion = 2;
    envelope.packetSha256 = packetBinding.packetSha256;
    envelope.packetCanonicalizationVersion = packetBinding.packetCanonicalizationVersion;
    envelope.packetSerializationVersion = packetBinding.packetSerializationVersion;
    envelope.packetFramingVersion = packetBinding.packetFramingVersion;
  }
  return envelope;
}

export async function runDualReview(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const modeSelection = readCitationGroundingModeSelectorV1(projectRoot);
  if (modeSelection === 'invalid') throw new Error('Invalid KStack config: workflow.designGate.citationGrounding must be off or advisory');
  const fixedConfigPath = path.join(projectRoot, '.kstack', 'config.json');
  const advisoryConfigPath = options.configPath && path.resolve(options.configPath) !== fixedConfigPath ? undefined : options.configPath;
  const { file: configPath, config } = loadConfig(projectRoot, modeSelection === 'candidate-advisory' ? advisoryConfigPath : options.configPath);
  const configBytes = configPath ? fs.readFileSync(configPath) : Buffer.from(JSON.stringify(config));
  const promptBytes = fs.readFileSync(path.resolve(options.promptFile));
  const prompt = promptBytes.toString('utf8');
  const designDigest = sha256(promptBytes);
  const invocationId = crypto.randomUUID();
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });

  if (config.models.mode === 'off') {
    const manifest = { schemaVersion: 1, status: 'disabled', configPath, projectRoot, invocationId, designDigest, createdAt: new Date().toISOString(), providers: {} };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return manifest;
  }

  let qualification = { effective: false, route: 'legacy_direct' };
  if (modeSelection === 'candidate-advisory' && config.workflow.designGate?.citationGrounding === 'advisory') {
    qualification = options.citationQualification ?? await qualifyOrdinaryCitationAdvisoryV1({
      projectRoot, config, configBytes, ...(options.citationRuntimeOptions ?? {})
    });
    if (!qualification.effective && qualification.line) {
      (options.onCitationDiagnostic ?? ((line) => process.stderr.write(`${line}\n`)))(qualification.line);
    }
    if (qualification.effective) sweepCitationStagingV1(projectRoot);
  }
  const groundingMode = qualification.effective ? 'advisory' : 'off';
  let packet = null;
  let frame = null;
  let reviewInput = prompt;
  if (groundingMode === 'advisory') {
    packet = buildDecisionPacket([{ sourceId: 'SRC-DESIGN', label: 'design under review', role: 'design-under-review', inclusion: 'full', content: promptBytes }]);
    frame = frameDecisionPacket(packet.packetBytes);
    reviewInput = frame.framedBytes.toString('utf8');
  }
  const fullPrompt = reviewerPrompt(reviewInput, invocationId, designDigest, groundingMode);
  const legacyPrompt = reviewerPrompt(prompt, invocationId, designDigest, 'off');
  const promptFile = path.join(outDir, '.review-prompt.tmp');
  fs.writeFileSync(promptFile, fullPrompt, { mode: 0o600 });
  const schemaFile = path.join(outDir, '.review-schema.tmp.json');
  fs.writeFileSync(schemaFile, `${JSON.stringify(groundingMode === 'advisory' ? groundingReviewResponseSchema : reviewResponseSchema)}\n`, { mode: 0o600 });
  const legacyPromptFile = path.join(outDir, '.legacy-review-prompt.tmp');
  fs.writeFileSync(legacyPromptFile, legacyPrompt, { mode: 0o600 });
  const legacySchemaFile = path.join(outDir, '.legacy-review-schema.tmp.json');
  fs.writeFileSync(legacySchemaFile, `${JSON.stringify(reviewResponseSchema)}\n`, { mode: 0o600 });
  const codexLast = path.join(outDir, '.codex-last.tmp');
  const codexStdout = path.join(outDir, '.codex-stdout.tmp');
  const codexStderr = path.join(outDir, '.codex-stderr.tmp');
  const opusStdout = path.join(outDir, '.opus-stdout.tmp');
  const opusStderr = path.join(outDir, '.opus-stderr.tmp');
  const codexArgs = [
    'exec', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only',
    '--skip-git-repo-check', '-C', projectRoot, '--output-schema', schemaFile,
    '--output-last-message', codexLast
  ];
  if (config.models.codex.model) codexArgs.push('--model', config.models.codex.model);
  if (config.models.codex.reasoningEffort) codexArgs.push('-c', `model_reasoning_effort="${config.models.codex.reasoningEffort}"`);

  const opusArgs = claudeInvocationArgs(config.models.opus, { defaultModel: 'opus', jsonSchema: groundingMode === 'advisory' ? groundingReviewResponseSchema : reviewResponseSchema });

  let codex;
  let opus;
  let staging;
  let jointStates = null;
  if (groundingMode === 'advisory') {
    const promptBuffer = Buffer.from(fullPrompt);
    let spawnInputs = null;
    try {
      assertOutboundSecretScan(promptBuffer);
      if (qualification.context?.providers && !qualification.context.providerAuthorizationInjected) {
        spawnInputs = await authorizeCitationProviderInputsV1(projectRoot, config, configBytes);
        if (canonicalJson(spawnInputs) !== canonicalJson(qualification.context.providers)) throw new Error('PROVIDER_INPUT_CHANGED');
      }
    }
    catch {
      qualification.route = 'legacy_fallback';
      [codex, opus] = await Promise.all([
        runProcess(config.models.codex.command, [...config.models.codex.args, ...codexArgs.map((value) => value === schemaFile ? legacySchemaFile : value)], { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: codexStdout, stderrFile: codexStderr, timeoutMs: config.models.codex.timeoutSeconds * 1000 }),
        runProcess(config.models.opus.command, claudeInvocationArgs(config.models.opus, { defaultModel: 'opus', jsonSchema: reviewResponseSchema }), { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: opusStdout, stderrFile: opusStderr, timeoutMs: config.models.opus.timeoutSeconds * 1000 })
      ]);
    }
    if (!codex && !opus) {
    const resolvedCommand = (providerId) => spawnInputs?.find((item) => item.providerId === providerId)?.executablePath ?? config.models[providerId].command;
    staging = prepareCitationProviderStagingV1(projectRoot, [promptBuffer, promptBuffer], qualification.context?.nativeContext);
    const joint = await runJointProcesses([
      { requestId: crypto.randomUUID(), command: resolvedCommand('codex'), args: [...config.models.codex.args, ...codexArgs], cwd: projectRoot, env: process.env, stdinFd: staging.files[0].fd, stdinPath: staging.files[0].file, stdoutFile: codexStdout, stderrFile: codexStderr, timeoutMs: config.models.codex.timeoutSeconds * 1000 },
      { requestId: crypto.randomUUID(), command: resolvedCommand('opus'), args: opusArgs, cwd: projectRoot, env: process.env, stdinFd: staging.files[1].fd, stdinPath: staging.files[1].file, stdoutFile: opusStdout, stderrFile: opusStderr, timeoutMs: config.models.opus.timeoutSeconds * 1000 }
    ]);
    jointStates = joint.states;
    [codex, opus] = joint.results;
    staging.cleanup();
    if (!joint.activated) {
      [codex, opus] = await Promise.all([
        runProcess(config.models.codex.command, [...config.models.codex.args, ...codexArgs.map((value) => value === schemaFile ? legacySchemaFile : value)], { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: codexStdout, stderrFile: codexStderr, timeoutMs: config.models.codex.timeoutSeconds * 1000 }),
        runProcess(config.models.opus.command, claudeInvocationArgs(config.models.opus, { defaultModel: 'opus', jsonSchema: reviewResponseSchema }), { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: opusStdout, stderrFile: opusStderr, timeoutMs: config.models.opus.timeoutSeconds * 1000 })
      ]);
      qualification.route = 'legacy_fallback';
    }
    }
  } else {
    [codex, opus] = await Promise.all([
      runProcess(config.models.codex.command, [...config.models.codex.args, ...codexArgs], { cwd: projectRoot, stdinFile: promptFile, stdoutFile: codexStdout, stderrFile: codexStderr, timeoutMs: config.models.codex.timeoutSeconds * 1000 }),
      runProcess(config.models.opus.command, opusArgs, { cwd: projectRoot, stdinFile: promptFile, stdoutFile: opusStdout, stderrFile: opusStderr, timeoutMs: config.models.opus.timeoutSeconds * 1000 })
    ]);
  }

  const rawOutputs = {
    codex: fs.existsSync(codexLast) ? readCapped(codexLast) : codex.stdout,
    opus: opus.stdout
  };
  const retainedOutputs = Object.fromEntries(Object.entries(rawOutputs).map(([name, raw]) => [name, config.persistence.redactSecrets ? sanitize(raw) : raw]));
  for (const [name, result] of Object.entries({ codex, opus })) {
    let route = groundingMode === 'advisory' ? 'grounding_v2' : qualification.route ?? 'legacy_direct';
    if (result.status === 'complete') {
      try {
        const review = extractReview(retainedOutputs[name]);
        const envelope = bindEnvelope({ reviewer: name, review, rawOutput: retainedOutputs[name], invocationId, designDigest, packetBinding: packet?.binding });
        fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
        result.envelopeSha256 = sha256(JSON.stringify(envelope));
      } catch (error) {
        if (groundingMode === 'advisory') {
          const recoveryStdout = path.join(outDir, `.${name}-recovery-stdout.tmp`);
          const recoveryStderr = path.join(outDir, `.${name}-recovery-stderr.tmp`);
          const recovery = name === 'codex'
            ? await runProcess(config.models.codex.command, [...config.models.codex.args, ...codexArgs.map((value) => value === schemaFile ? legacySchemaFile : value)], { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: recoveryStdout, stderrFile: recoveryStderr, timeoutMs: config.models.codex.timeoutSeconds * 1000 })
            : await runProcess(config.models.opus.command, claudeInvocationArgs(config.models.opus, { defaultModel: 'opus', jsonSchema: reviewResponseSchema }), { cwd: projectRoot, stdinFile: legacyPromptFile, stdoutFile: recoveryStdout, stderrFile: recoveryStderr, timeoutMs: config.models.opus.timeoutSeconds * 1000 });
          if (recovery.status === 'complete') {
            const recoveredRaw = name === 'codex' && fs.existsSync(codexLast) ? readCapped(codexLast) : recovery.stdout;
            try {
              const review = extractReview(recoveredRaw);
              const envelope = bindEnvelope({ reviewer: name, review, rawOutput: recoveredRaw, invocationId, designDigest });
              fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
              result.envelopeSha256 = sha256(JSON.stringify(envelope));
              retainedOutputs[name] = recoveredRaw;
              route = 'legacy_recovery';
            } catch (recoveryError) { result.status = 'malformed'; result.error = recoveryError.message; }
          } else { result.status = 'malformed'; result.error = error.message; }
          for (const temporary of [recoveryStdout, recoveryStderr]) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        } else { result.status = 'malformed'; result.error = error.message; }
      }
    }
    result.rawOutputSha256 = sha256(retainedOutputs[name] || '');
    result.configurationSha256 = sha256(JSON.stringify(config.models[name]));
    result.route = route;
    writeRaw(outDir, name, retainedOutputs[name], result.stderr, config.persistence.retainRawModelOutput, false);
  }

  for (const temporary of [promptFile, schemaFile, legacyPromptFile, legacySchemaFile, codexLast, codexStdout, codexStderr, opusStdout, opusStderr]) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }

  const complete = [codex, opus].filter((result) => result.status === 'complete').length;
  const manifest = {
    schemaVersion: 1,
    status: complete === 2 ? 'dual-complete' : complete === 1 ? 'single-model-fallback' : 'failed',
    mode: config.models.mode,
    onUnavailable: config.models.onUnavailable,
    configPath,
    projectRoot,
    invocationId,
    designDigest,
    ...(packet ? {
      citationGroundingMode: groundingMode,
      packet: { ...packet.binding, frameCounter: frame.counter, frameToken: frame.token }
    } : {}),
    citationGroundingRequestedMode: modeSelection === 'candidate-advisory' ? 'advisory' : 'off',
    citationGroundingEffectiveRoute: qualification.route ?? (groundingMode === 'advisory' ? 'grounding_v2' : 'legacy_direct'),
    ...(jointStates ? { citationGroundingJointActivation: 'committed' } : {}),
    createdAt: new Date().toISOString(),
    providers: Object.fromEntries(Object.entries({ codex, opus }).map(([name, result]) => [name, {
      status: result.status,
      exitCode: result.exitCode,
      signal: result.signal,
      error: result.error,
      startedAt: result.startedAt,
      durationMs: result.durationMs,
      rawOutputSha256: result.rawOutputSha256,
      envelopeSha256: result.envelopeSha256,
      configurationSha256: result.configurationSha256
      ,route: result.route
    }]))
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: kstack-dual-review --prompt-file FILE --project-root DIR --out-dir DIR [--config FILE]');
    return;
  }
  for (const required of ['prompt-file', 'project-root', 'out-dir']) if (!args[required]) throw new Error(`Missing --${required}`);
  const manifest = await runDualReview({
    promptFile: args['prompt-file'], projectRoot: args['project-root'], outDir: args['out-dir'], configPath: args.config
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  if (manifest.mode === 'required' && manifest.status !== 'dual-complete') process.exitCode = 2;
  if (manifest.status === 'failed') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.stack || error.message); process.exitCode = 2; });
}
