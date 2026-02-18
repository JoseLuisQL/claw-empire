import { useState, useEffect, useRef, useCallback } from "react";
import type { CompanySettings, CliStatusMap, CliProvider } from "../types";
import * as api from "../api";
import type { OAuthStatus, OAuthConnectProvider, DeviceCodeStart } from "../api";
import type { OAuthCallbackResult } from "../App";

interface SettingsPanelProps {
  settings: CompanySettings;
  cliStatus: CliStatusMap | null;
  onSave: (settings: CompanySettings) => void;
  onRefreshCli: () => void;
  oauthResult?: OAuthCallbackResult | null;
  onOauthResultClear?: () => void;
}

const CLI_INFO: Record<string, { label: string; icon: string }> = {
  claude: { label: "Claude Code", icon: "🟣" },
  codex: { label: "Codex CLI", icon: "🟢" },
  gemini: { label: "Gemini CLI", icon: "🔵" },
  opencode: { label: "OpenCode", icon: "⚪" },
  copilot: { label: "GitHub Copilot", icon: "⚫" },
  antigravity: { label: "Antigravity", icon: "🟡" },
};

const OAUTH_INFO: Record<string, { label: string }> = {
  "github-copilot": { label: "GitHub Copilot" },
  antigravity: { label: "Antigravity" },
};

// SVG Logo components for OAuth providers
function GitHubCopilotLogo({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function AntigravityLogo({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="#1a73e8">
      <path d="m19.94,20.59c1.09.82,2.73.27,1.23-1.23-4.5-4.36-3.55-16.36-9.14-16.36S7.39,15,2.89,19.36c-1.64,1.64.14,2.05,1.23,1.23,4.23-2.86,3.95-7.91,7.91-7.91s3.68,5.05,7.91,7.91Z"/>
    </svg>
  );
}

const CONNECTABLE_PROVIDERS: Array<{
  id: OAuthConnectProvider;
  label: string;
  Logo: ({ className }: { className?: string }) => JSX.Element;
  description: string;
}> = [
  { id: "github-copilot", label: "GitHub Copilot", Logo: GitHubCopilotLogo, description: "GitHub OAuth (Copilot)" },
  { id: "antigravity", label: "Antigravity", Logo: AntigravityLogo, description: "Google OAuth (Antigravity)" },
];

export default function SettingsPanel({
  settings,
  cliStatus,
  onSave,
  onRefreshCli,
  oauthResult,
  onOauthResultClear,
}: SettingsPanelProps) {
  const [form, setForm] = useState<CompanySettings>(settings);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"general" | "cli" | "oauth">(
    oauthResult ? "oauth" : "general"
  );
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // GitHub Device Code flow state
  const [deviceCode, setDeviceCode] = useState<DeviceCodeStart | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null); // "polling" | "complete" | "error" | "expired"
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  // Auto-switch to oauth tab when callback result arrives
  useEffect(() => {
    if (oauthResult) {
      setTab("oauth");
      setOauthStatus(null);
    }
  }, [oauthResult]);

  useEffect(() => {
    if (tab === "oauth" && !oauthStatus) {
      setOauthLoading(true);
      api.getOAuthStatus()
        .then(setOauthStatus)
        .catch(console.error)
        .finally(() => setOauthLoading(false));
    }
  }, [tab, oauthStatus]);

  // Auto-dismiss oauth result banner after 8 seconds
  useEffect(() => {
    if (oauthResult) {
      const timer = setTimeout(() => onOauthResultClear?.(), 8000);
      return () => clearTimeout(timer);
    }
  }, [oauthResult, onOauthResultClear]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  function handleSave() {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Antigravity: web redirect OAuth (Google OAuth works on any localhost port)
  function handleConnect(provider: OAuthConnectProvider) {
    const redirectTo = window.location.origin + window.location.pathname;
    window.location.assign(api.getOAuthStartUrl(provider, redirectTo));
  }

  // GitHub Copilot: Device Code flow
  const startDeviceCodeFlow = useCallback(async () => {
    setDeviceError(null);
    setDeviceStatus(null);
    try {
      const dc = await api.startGitHubDeviceFlow();
      setDeviceCode(dc);
      setDeviceStatus("polling");
      // Open verification URL
      window.open(dc.verificationUri, "_blank");
      // Start polling with expiration timeout
      const interval = Math.max((dc.interval || 5) * 1000, 5000);
      const expiresAt = Date.now() + (dc.expiresIn || 900) * 1000;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        if (Date.now() > expiresAt) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setDeviceStatus("expired");
          setDeviceCode(null);
          setDeviceError("코드가 만료되었습니다. 다시 시도하세요.");
          return;
        }
        try {
          const result = await api.pollGitHubDevice(dc.stateId);
          if (result.status === "complete") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setDeviceStatus("complete");
            setDeviceCode(null);
            // Refresh OAuth status
            const status = await api.getOAuthStatus();
            setOauthStatus(status);
          } else if (result.status === "expired" || result.status === "denied") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setDeviceStatus(result.status);
            setDeviceError(result.status === "expired" ? "코드가 만료되었습니다" : "인증이 거부되었습니다");
          } else if (result.status === "error") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setDeviceStatus("error");
            setDeviceError(result.error || "알 수 없는 오류");
          }
          // "pending" and "slow_down" → keep polling
        } catch {
          // Network error — keep polling
        }
      }, interval);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : String(err));
      setDeviceStatus("error");
    }
  }, []);

  async function handleDisconnect(provider: OAuthConnectProvider) {
    setDisconnecting(provider);
    try {
      await api.disconnectOAuth(provider);
      const status = await api.getOAuthStatus();
      setOauthStatus(status);
      // Reset device code state if disconnecting github-copilot
      if (provider === "github-copilot") {
        setDeviceCode(null);
        setDeviceStatus(null);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      }
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        ⚙️ 설정
      </h2>

      {/* Tab navigation */}
      <div className="flex border-b border-slate-700/50">
        {[
          { key: "general", label: "일반 설정", icon: "⚙️" },
          { key: "cli", label: "CLI 도구", icon: "🔧" },
          { key: "oauth", label: "OAuth 인증", icon: "🔑" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* General Settings Tab */}
      {tab === "general" && (
      <>
      <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          회사 정보
        </h3>

        <div>
          <label className="block text-xs text-slate-400 mb-1">회사명</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) =>
              setForm({ ...form, companyName: e.target.value })
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">CEO 이름</label>
          <input
            type="text"
            value={form.ceoName}
            onChange={(e) =>
              setForm({ ...form, ceoName: e.target.value })
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">자동 배정</label>
          <button
            onClick={() =>
              setForm({ ...form, autoAssign: !form.autoAssign })
            }
            className={`w-10 h-5 rounded-full transition-colors relative ${
              form.autoAssign ? "bg-blue-500" : "bg-slate-600"
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                form.autoAssign ? "left-5.5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            기본 CLI 프로바이더
          </label>
          <select
            value={form.defaultProvider}
            onChange={(e) =>
              setForm({
                ...form,
                defaultProvider: e.target.value as CliProvider,
              })
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
            <option value="gemini">Gemini CLI</option>
            <option value="opencode">OpenCode</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">언어</label>
          <select
            value={form.language}
            onChange={(e) =>
              setForm({
                ...form,
                language: e.target.value as "ko" | "en",
              })
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end gap-3">
        {saved && (
          <span className="text-green-400 text-sm self-center">
            ✅ 저장 완료
          </span>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          저장
        </button>
      </div>
      </>
      )}

      {/* CLI Status Tab */}
      {tab === "cli" && (
      <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            CLI 도구 상태
          </h3>
          <button
            onClick={onRefreshCli}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            🔄 새로고침
          </button>
        </div>

        {cliStatus ? (
          <div className="space-y-2">
            {Object.entries(cliStatus).map(([provider, status]) => {
              const info = CLI_INFO[provider];
              return (
                <div
                  key={provider}
                  className="flex items-center gap-3 bg-slate-700/30 rounded-lg p-3"
                >
                  <span className="text-lg">{info?.icon ?? "❓"}</span>
                  <div className="flex-1">
                    <div className="text-sm text-white">
                      {info?.label ?? provider}
                    </div>
                    <div className="text-xs text-slate-500">
                      {status.version ?? "미설치"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        status.installed
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-600/50 text-slate-400"
                      }`}
                    >
                      {status.installed ? "설치됨" : "미설치"}
                    </span>
                    {status.installed && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          status.authenticated
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {status.authenticated ? "인증됨" : "미인증"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-slate-500 text-sm">
            로딩 중...
          </div>
        )}

        <p className="text-xs text-slate-500">
          각 에이전트의 CLI 도구는 오피스에서 에이전트 클릭 후 변경할 수 있습니다.
        </p>
      </section>
      )}

      {/* OAuth Tab */}
      {tab === "oauth" && (
      <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            OAuth 인증 현황
          </h3>
          <button
            onClick={() => {
              setOauthStatus(null);
              setOauthLoading(true);
              api.getOAuthStatus()
                .then(setOauthStatus)
                .catch(console.error)
                .finally(() => setOauthLoading(false));
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            🔄 새로고침
          </button>
        </div>

        {/* OAuth callback result banner */}
        {oauthResult && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
            oauthResult.error
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}>
            <span>
              {oauthResult.error
                ? `OAuth 연결 실패: ${oauthResult.error}`
                : `${OAUTH_INFO[oauthResult.provider || ""]?.label || oauthResult.provider} 연결 완료!`}
            </span>
            <button
              onClick={() => onOauthResultClear?.()}
              className="text-xs opacity-60 hover:opacity-100 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Storage status */}
        {oauthStatus && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            oauthStatus.storageReady
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
          }`}>
            <span>{oauthStatus.storageReady ? "🔒" : "⚠️"}</span>
            <span>
              {oauthStatus.storageReady
                ? "OAuth 저장소 활성화됨 (암호화 키 설정됨)"
                : "OAUTH_ENCRYPTION_SECRET 환경변수가 설정되지 않았습니다"}
            </span>
          </div>
        )}

        {oauthLoading ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            로딩 중...
          </div>
        ) : oauthStatus ? (
          <>
            {/* Connected services section */}
            {(() => {
              const connected = Object.entries(oauthStatus.providers).filter(([, info]) => info.connected);
              if (connected.length === 0) return null;
              const logoMap: Record<string, ({ className }: { className?: string }) => JSX.Element> = {
                "github-copilot": GitHubCopilotLogo, antigravity: AntigravityLogo,
              };
              return (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    연결된 서비스
                  </div>
                  {connected.map(([provider, info]) => {
                    const oauthInfo = OAUTH_INFO[provider];
                    const LogoComp = logoMap[provider];
                    const expiresAt = info.expires_at ? new Date(info.expires_at) : null;
                    const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;
                    const isWebOAuth = info.source === "web-oauth";
                    const isFileDetected = info.source === "file-detected";
                    return (
                      <div key={provider} className="bg-slate-700/30 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {LogoComp ? <LogoComp className="w-5 h-5" /> : <span className="text-lg">🔑</span>}
                            <span className="text-sm font-medium text-white">
                              {oauthInfo?.label ?? provider}
                            </span>
                            {info.email && (
                              <span className="text-xs text-slate-400">{info.email}</span>
                            )}
                            {isFileDetected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                                CLI 감지
                              </span>
                            )}
                            {isWebOAuth && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                웹 OAuth
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              !isExpired
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}>
                              {!isExpired ? "연결됨" : "만료됨"}
                            </span>
                            {isWebOAuth && (
                              <button
                                onClick={() => handleDisconnect(provider as OAuthConnectProvider)}
                                disabled={disconnecting === provider}
                                className="text-xs px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {disconnecting === provider ? "해제 중..." : "연결 해제"}
                              </button>
                            )}
                          </div>
                        </div>
                        {(info.scope || expiresAt || (info.created_at > 0)) && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {info.scope && (
                              <div className="col-span-2">
                                <span className="text-slate-500">스코프: </span>
                                <span className="text-slate-300 font-mono text-[10px]">{info.scope}</span>
                              </div>
                            )}
                            {expiresAt && (
                              <div>
                                <span className="text-slate-500">만료: </span>
                                <span className={isExpired ? "text-red-400" : "text-slate-300"}>
                                  {expiresAt.toLocaleString("ko-KR")}
                                </span>
                              </div>
                            )}
                            {info.created_at > 0 && (
                              <div>
                                <span className="text-slate-500">등록: </span>
                                <span className="text-slate-300">
                                  {new Date(info.created_at).toLocaleString("ko-KR")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* New OAuth Connect section — provider cards */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                새 OAuth 연결
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CONNECTABLE_PROVIDERS.map(({ id, label, Logo, description }) => {
                  const providerInfo = oauthStatus.providers[id];
                  const isConnected = providerInfo?.connected;
                  const storageOk = oauthStatus.storageReady;
                  const isGitHub = id === "github-copilot";

                  return (
                    <div
                      key={id}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        isConnected
                          ? "bg-green-500/5 border-green-500/30"
                          : storageOk
                          ? "bg-slate-700/30 border-slate-600/50 hover:border-blue-400/50 hover:bg-slate-700/50"
                          : "bg-slate-800/30 border-slate-700/30 opacity-50"
                      }`}
                    >
                      <Logo className="w-8 h-8" />
                      <span className="text-sm font-medium text-white">{label}</span>
                      <span className="text-[10px] text-slate-400 text-center leading-tight">{description}</span>
                      {isConnected ? (
                        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 font-medium">
                          연결됨
                        </span>
                      ) : !storageOk ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                          암호화 키 필요
                        </span>
                      ) : isGitHub ? (
                        /* GitHub Copilot: Device Code flow */
                        deviceCode && deviceStatus === "polling" ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="text-xs text-slate-300 font-mono bg-slate-700/60 px-3 py-1.5 rounded-lg tracking-widest select-all">
                              {deviceCode.userCode}
                            </div>
                            <span className="text-[10px] text-blue-400 animate-pulse">
                              코드 입력 대기 중...
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={startDeviceCodeFlow}
                            className="text-[11px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                          >
                            연결하기
                          </button>
                        )
                      ) : (
                        /* Antigravity: Web redirect OAuth */
                        <button
                          onClick={() => handleConnect(id)}
                          className="text-[11px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                        >
                          연결하기
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Device Code flow status messages */}
              {deviceStatus === "complete" && (
                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
                  GitHub Copilot 연결 완료!
                </div>
              )}
              {deviceError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {deviceError}
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
      )}
    </div>
  );
}
