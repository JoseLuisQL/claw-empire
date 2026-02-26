import path from "node:path";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

type CreateExecutionStartTaskToolsDeps = {
  nowMs: RuntimeContext["nowMs"];
  db: RuntimeContext["db"];
  logsDir: RuntimeContext["logsDir"];
  appendTaskLog: RuntimeContext["appendTaskLog"];
  broadcast: RuntimeContext["broadcast"];
  ensureTaskExecutionSession: RuntimeContext["ensureTaskExecutionSession"];
  resolveLang: RuntimeContext["resolveLang"];
  notifyTaskStatus: (...args: any[]) => any;
  resolveProjectPath: RuntimeContext["resolveProjectPath"];
  createWorktree: RuntimeContext["createWorktree"];
  getDeptRoleConstraint: RuntimeContext["getDeptRoleConstraint"];
  getRecentConversationContext: RuntimeContext["getRecentConversationContext"];
  getTaskContinuationContext: RuntimeContext["getTaskContinuationContext"];
  getRecentChanges: RuntimeContext["getRecentChanges"];
  ensureClaudeMd: RuntimeContext["ensureClaudeMd"];
  pickL: RuntimeContext["pickL"];
  l: RuntimeContext["l"];
  buildAvailableSkillsPromptBlock: RuntimeContext["buildAvailableSkillsPromptBlock"];
  buildTaskExecutionPrompt: RuntimeContext["buildTaskExecutionPrompt"];
  hasExplicitWarningFixRequest: RuntimeContext["hasExplicitWarningFixRequest"];
  getNextHttpAgentPid: RuntimeContext["getNextHttpAgentPid"];
  launchApiProviderAgent: RuntimeContext["launchApiProviderAgent"];
  launchHttpAgent: RuntimeContext["launchHttpAgent"];
  getProviderModelConfig: RuntimeContext["getProviderModelConfig"];
  spawnCliAgent: RuntimeContext["spawnCliAgent"];
  handleTaskRunComplete: RuntimeContext["handleTaskRunComplete"];
  notifyCeo: RuntimeContext["notifyCeo"];
  startProgressTimer: RuntimeContext["startProgressTimer"];
};

export function createExecutionStartTaskTools(deps: CreateExecutionStartTaskToolsDeps) {
  const {
    nowMs,
    db,
    logsDir,
    appendTaskLog,
    broadcast,
    ensureTaskExecutionSession,
    resolveLang,
    notifyTaskStatus,
    resolveProjectPath,
    createWorktree,
    getDeptRoleConstraint,
    getRecentConversationContext,
    getTaskContinuationContext,
    getRecentChanges,
    ensureClaudeMd,
    pickL,
    l,
    buildAvailableSkillsPromptBlock,
    buildTaskExecutionPrompt,
    hasExplicitWarningFixRequest,
    getNextHttpAgentPid,
    launchApiProviderAgent,
    launchHttpAgent,
    getProviderModelConfig,
    spawnCliAgent,
    handleTaskRunComplete,
    notifyCeo,
    startProgressTimer,
  } = deps;

function startTaskExecutionForAgent(
  taskId: string,
  execAgent: any,
  deptId: string | null,
  deptName: string,
): void {
  const execName = execAgent.name_ko || execAgent.name;
  const t = nowMs();
  db.prepare(
    "UPDATE tasks SET status = 'in_progress', assigned_agent_id = ?, started_at = ?, updated_at = ? WHERE id = ?",
  ).run(execAgent.id, t, t, taskId);
  db.prepare("UPDATE agents SET status = 'working', current_task_id = ? WHERE id = ?").run(taskId, execAgent.id);
  appendTaskLog(taskId, "system", `${execName} started (approved)`);

  broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
  broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(execAgent.id));

  const provider = execAgent.cli_provider || "claude";
  if (!["claude", "codex", "gemini", "opencode", "copilot", "antigravity", "api"].includes(provider)) return;
  const executionSession = ensureTaskExecutionSession(taskId, execAgent.id, provider);

  const taskData = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as
    | {
        title: string;
        description: string | null;
        project_id: string | null;
        project_path: string | null;
        base_branch: string | null;
      }
    | undefined;
  if (!taskData) return;
  const taskLang = resolveLang(taskData.description ?? taskData.title);
  notifyTaskStatus(taskId, taskData.title, "in_progress", taskLang);

  const projPath = resolveProjectPath(taskData);
  const worktreePath = createWorktree(projPath, taskId, execAgent.name, taskData.base_branch ?? undefined);
  const agentCwd = worktreePath || projPath;
  if (worktreePath) {
    appendTaskLog(taskId, "system", `Git worktree created: ${worktreePath} (branch: climpire/${taskId.slice(0, 8)})`);
  }
  const logFilePath = path.join(logsDir, `${taskId}.log`);
  const roleLabels: Record<string, string> = {
    team_leader: "Team Leader",
    senior: "Senior",
    junior: "Junior",
    intern: "Intern",
  };
  const roleLabel = roleLabels[execAgent.role] ?? execAgent.role;
  const deptConstraint = deptId ? getDeptRoleConstraint(deptId, deptName) : "";
  const deptPromptRaw = deptId
    ? (
        db.prepare("SELECT prompt FROM departments WHERE id = ?").get(deptId) as
          | { prompt?: string | null }
          | undefined
      )?.prompt
    : null;
  const deptPrompt = typeof deptPromptRaw === "string" ? deptPromptRaw.trim() : "";
  const deptPromptBlock = deptPrompt ? `[Department Shared Prompt]\n${deptPrompt}` : "";
  const conversationCtx = getRecentConversationContext(execAgent.id);
  const continuationCtx = getTaskContinuationContext(taskId);
  const recentChanges = getRecentChanges(projPath, taskId);
  if (worktreePath && provider === "claude") {
    ensureClaudeMd(projPath, worktreePath);
  }
  const continuationInstruction = continuationCtx
    ? pickL(
        l(
          ["연속 실행: 소유 컨텍스트를 유지하고 인사/착수 멘트 없이 미해결 검토 항목을 즉시 반영하세요."],
          [
            "Continuation run: keep ownership, skip greetings/kickoff narration, and execute unresolved review items immediately.",
          ],
          ["継続実行: オーナーシップを維持し、挨拶/開始ナレーションなしで未解決レビュー項目を即時反映してください。"],
          ["连续执行：保持责任上下文，跳过问候/开场说明，立即处理未解决评审项。"],
        ),
        taskLang,
      )
    : pickL(
        l(
          ["긴 서론 없이 바로 실행하고, 메시지는 간결하게 유지하세요."],
          ["Execute directly without long preamble and keep messages concise."],
          ["長い前置きなしで直ちに実行し、メッセージは簡潔にしてください。"],
          ["无需冗长前言，直接执行并保持消息简洁。"],
        ),
        taskLang,
      );
  const runInstruction = pickL(
    l(
      ["위 작업을 충분히 완수하세요. 필요 시 연속 실행 요약과 대화 맥락을 참고하세요."],
      [
        "Please complete the task above thoroughly. Use the continuation brief and conversation context above if relevant.",
      ],
      ["上記タスクを丁寧に完了してください。必要に応じて継続要約と会話コンテキストを参照してください。"],
      ["请完整地完成上述任务。可按需参考连续执行摘要与会话上下文。"],
      [
        "Completa la tarea de forma exhaustiva. Si aplica, usa el resumen de continuidad y el contexto de conversación. Responde y reporta estrictamente en español.",
      ],
    ),
    taskLang,
  );
  const availableSkillsPromptBlock = buildAvailableSkillsPromptBlock(provider);
  const spawnPrompt = buildTaskExecutionPrompt(
    [
      availableSkillsPromptBlock,
      `[Task Session] id=${executionSession.sessionId} owner=${executionSession.agentId} provider=${executionSession.provider}`,
      pickL(
        l(
          ["이 세션은 이 작업 전용입니다. 이 작업 안에서만 맥락 연속성을 유지하고 다른 프로젝트와 섞지 마세요."],
          [
            "This session is scoped to this task only. Keep context continuity inside this task session and do not mix with other projects.",
          ],
          ["このセッションは当該タスク専用です。このタスク内でのみ文脈の連続性を維持し、他プロジェクトと混在させないでください。"],
          ["此会话仅限当前任务。仅在该任务会话内保持上下文连续性，不要与其他项目混用。"],
          ["Esta sesión está limitada a esta tarea. Mantén continuidad solo dentro de esta sesión y no mezcles con otros proyectos."],
        ),
        taskLang,
      ),
      recentChanges ? `[Recent Changes]\n${recentChanges}` : "",
      `[Task] ${taskData.title}`,
      taskData.description ? `\n${taskData.description}` : "",
      continuationCtx,
      conversationCtx,
      `\n---`,
      `Agent: ${execAgent.name} (${roleLabel}, ${deptName})`,
      execAgent.personality ? `Personality: ${execAgent.personality}` : "",
      deptConstraint,
      deptPromptBlock,
      worktreePath
        ? pickL(
            l(
              [`참고: 격리된 Git worktree 브랜치(climpire/${taskId.slice(0, 8)})에서 작업 중입니다. 평소처럼 커밋하세요.`],
              [`NOTE: You are working in an isolated Git worktree branch (climpire/${taskId.slice(0, 8)}). Commit your changes normally.`],
              [`注記: 分離された Git worktree ブランチ (climpire/${taskId.slice(0, 8)}) で作業中です。通常どおりコミットしてください。`],
              [`注意：你正在隔离的 Git worktree 分支（climpire/${taskId.slice(0, 8)}）中工作。按常规提交即可。`],
              [`Nota: estás trabajando en una rama Git worktree aislada (climpire/${taskId.slice(0, 8)}). Haz commit de forma normal.`],
            ),
            taskLang,
          )
        : "",
      continuationInstruction,
      runInstruction,
    ],
    {
      allowWarningFix: hasExplicitWarningFixRequest(taskData.title, taskData.description),
    },
  );

  appendTaskLog(taskId, "system", `RUN start (agent=${execAgent.name}, provider=${provider})`);
  if (provider === "api") {
    const controller = new AbortController();
    const fakePid = getNextHttpAgentPid();
    launchApiProviderAgent(
      taskId,
      execAgent.api_provider_id ?? null,
      execAgent.api_model ?? null,
      spawnPrompt,
      agentCwd,
      logFilePath,
      controller,
      fakePid,
    );
  } else if (provider === "copilot" || provider === "antigravity") {
    const controller = new AbortController();
    const fakePid = getNextHttpAgentPid();
    launchHttpAgent(
      taskId,
      provider,
      spawnPrompt,
      agentCwd,
      logFilePath,
      controller,
      fakePid,
      execAgent.oauth_account_id ?? null,
    );
  } else {
    const modelConfig = getProviderModelConfig();
    const modelForProvider = modelConfig[provider]?.model || undefined;
    const reasoningLevel = modelConfig[provider]?.reasoningLevel || undefined;
    const child = spawnCliAgent(
      taskId,
      provider,
      spawnPrompt,
      agentCwd,
      logFilePath,
      modelForProvider,
      reasoningLevel,
    );
    child.on("close", (code: number | null) => {
      handleTaskRunComplete(taskId, code ?? 1);
    });
  }

  const worktreeNote = worktreePath
    ? pickL(
        l(
          [` (격리 브랜치: climpire/${taskId.slice(0, 8)})`],
          [` (isolated branch: climpire/${taskId.slice(0, 8)})`],
          [` (分離ブランチ: climpire/${taskId.slice(0, 8)})`],
          [`（隔离分支: climpire/${taskId.slice(0, 8)}）`],
          [` (rama aislada: climpire/${taskId.slice(0, 8)})`],
        ),
        taskLang,
      )
    : "";
  notifyCeo(
    pickL(
      l(
        [`${execName}가 '${taskData.title}' 작업을 시작했습니다.${worktreeNote}`],
        [`${execName} started work on '${taskData.title}'.${worktreeNote}`],
        [`${execName}が '${taskData.title}' の作業を開始しました。${worktreeNote}`],
        [`${execName} 已开始处理 '${taskData.title}'。${worktreeNote}`],
        [`${execName} comenzó a trabajar en '${taskData.title}'.${worktreeNote}`],
      ),
      taskLang,
    ),
    taskId,
  );
  startProgressTimer(taskId, taskData.title, deptId);
}

  return {
    startTaskExecutionForAgent,
  };
}
